//! Skal JNI bridge — exposes bun's runtime to Android Java/Kotlin via JNI.
//!
//! Architecture (mirrors standalone bun):
//!
//!   ┌─────────────┐    enqueueTaskConcurrent    ┌─────────────────────┐
//!   │ Java thread │ ─────────────────────────► │  Skal worker thread │
//!   │   (UI/bg)   │                             │  owns VM, runs      │
//!   │             │ ◄───────  ResetEvent ────── │  tickPossiblyForever│
//!   └─────────────┘                             └─────────────────────┘
//!
//! The worker thread initializes a bun VirtualMachine and then runs bun's
//! standard "tick possibly forever" loop — the same loop that powers
//! `bun ./script.js`. JS execution, microtask draining, timers, fetch I/O
//! completions, all happen there.
//!
//! Java's `nativeEvaluate` posts an EvalRequest to bun's `concurrent_tasks`
//! queue via `enqueueTaskConcurrent` (same path bun uses for cross-thread
//! work). The worker thread wakes via uws's eventfd, runs the eval, and if
//! the result is a Promise calls `eventLoop.waitForPromise` (the same
//! mechanism that powers top-level `await` in standalone bun). The Java
//! thread blocks on a ResetEvent until the result is ready.

const std = @import("std");
const builtin = @import("builtin");
const bun = @import("bun");
const jsc = bun.jsc;

// ───────────────────────────────────────────────────────────────────────
// JNI ABI — minimal slot-indexed access to JNINativeInterface.
// ───────────────────────────────────────────────────────────────────────

const jint = i32;
const jlong = i64;
const jboolean = u8;
const jclass = ?*anyopaque;
const jstring = ?*anyopaque;
const JNIEnv = ?*const ?*const anyopaque;
const JavaVM = ?*const ?*const anyopaque;

const JNI_VERSION_1_6: jint = 0x00010006;

const JniSlot = struct {
    pub const NewStringUTF: usize = 167;
    pub const GetStringUTFChars: usize = 169;
    pub const ReleaseStringUTFChars: usize = 170;
};

inline fn jniFn(env: JNIEnv, comptime index: usize, comptime FnType: type) FnType {
    const tbl: [*]const ?*const anyopaque = @ptrCast(@alignCast(env.?.*));
    const fp = tbl[index] orelse @panic("JNI vtable slot is null");
    return @ptrCast(@alignCast(fp));
}

fn getStringUTFOwned(env: JNIEnv, allocator: std.mem.Allocator, s: jstring) !?[]u8 {
    if (s == null) return null;
    const Get = *const fn (JNIEnv, jstring, ?*jboolean) callconv(.c) ?[*:0]const u8;
    const Rel = *const fn (JNIEnv, jstring, ?[*:0]const u8) callconv(.c) void;
    const get = jniFn(env, JniSlot.GetStringUTFChars, Get);
    const rel = jniFn(env, JniSlot.ReleaseStringUTFChars, Rel);
    const ptr = get(env, s, null) orelse return null;
    defer rel(env, s, ptr);
    return try allocator.dupe(u8, std.mem.span(ptr));
}

fn newStringUTF(env: JNIEnv, bytes: [*:0]const u8) jstring {
    const F = *const fn (JNIEnv, [*:0]const u8) callconv(.c) jstring;
    return jniFn(env, JniSlot.NewStringUTF, F)(env, bytes);
}

// ───────────────────────────────────────────────────────────────────────
// Bun's REPL evaluation entry. Defined in
// vendor/bun/src/jsc/bindings/bindings.cpp:6370.
// ───────────────────────────────────────────────────────────────────────

extern fn Bun__REPL__evaluate(
    globalObject: *jsc.JSGlobalObject,
    sourcePtr: [*]const u8,
    sourceLen: usize,
    filenamePtr: [*]const u8,
    filenameLen: usize,
    exception_out: *jsc.JSValue,
) jsc.JSValue;

// ───────────────────────────────────────────────────────────────────────
// Skal Runtime — owns one bun VirtualMachine pinned to one worker thread.
// JS execution must happen on that thread (JSC VMs are thread-affined).
// ───────────────────────────────────────────────────────────────────────

const Runtime = struct {
    allocator: std.mem.Allocator,
    vm: *jsc.VirtualMachine = undefined,
    worker_thread: std.Thread = undefined,
    /// Signaled when the worker thread has initialized the VM and is ready
    /// to accept tasks. Java's nativeCreateRuntime blocks on this.
    ready: std.Thread.ResetEvent = .{},
    /// Set if VM init failed; nativeCreateRuntime returns 0 in that case.
    init_failed: std.atomic.Value(bool) = .{ .raw = false },

    fn init(allocator: std.mem.Allocator) !*Runtime {
        const self = try allocator.create(Runtime);
        errdefer allocator.destroy(self);

        self.* = .{ .allocator = allocator };
        self.worker_thread = try std.Thread.spawn(.{}, workerMain, .{self});
        self.ready.wait();
        if (self.init_failed.load(.acquire)) {
            return error.RuntimeInitFailed;
        }
        return self;
    }

    /// Worker thread main. Owns the VM for its lifetime. Runs bun's
    /// standard event loop until process exit.
    fn workerMain(self: *Runtime) void {
        // One-time JSC setup. Idempotent on subsequent calls (process-global).
        bun.jsc.initialize(false);

        const args = std.mem.zeroes(bun.schema.api.TransformOptions);
        const vm = jsc.VirtualMachine.init(.{
            .allocator = self.allocator,
            .args = args,
            .smol = true,
            .is_main_thread = true,
        }) catch {
            self.init_failed.store(true, .release);
            self.ready.set();
            return;
        };

        self.vm = vm;
        self.ready.set();

        // bun's standard tick-forever loop. uws's loop blocks on epoll
        // between events; enqueueTaskConcurrent + wakeup() (called from
        // any thread) breaks us out to process the new work.
        while (true) {
            vm.eventLoop().tickPossiblyForever();
        }
    }
};

// ───────────────────────────────────────────────────────────────────────
// EvalRequest — posted from Java thread to bun's concurrent queue.
// The Java thread blocks on `done` until the worker thread fills the
// result and signals. Lives on the Java thread's stack frame; the worker
// thread holds a pointer to it for the duration of run().
// ───────────────────────────────────────────────────────────────────────

const EvalRequest = struct {
    rt: *Runtime,
    source: []const u8,
    url: []const u8,

    /// Output. `result_buf` is allocated by the worker via rt.allocator;
    /// the Java thread frees it after copying into a jstring.
    result_buf: []u8 = "",
    /// Set if the JS threw (in which case result_buf holds the formatted
    /// exception message instead of the success value).
    is_error: bool = false,
    /// Synchronization. Worker calls `done.set()` when run() finishes.
    done: std.Thread.ResetEvent = .{},

    /// Task wrapper machinery — kept inline so we don't heap-allocate.
    any: bun.jsc.AnyTask = undefined,
    concurrent: bun.jsc.ConcurrentTask = undefined,

    /// Post to bun's concurrent task queue. Blocks the caller until the
    /// worker thread runs the eval and signals `done`. Safe to call from
    /// any thread.
    fn runOnWorker(self: *EvalRequest) void {
        self.any = bun.jsc.AnyTask.New(EvalRequest, runOnVmThread).init(self);
        self.concurrent = .{ .task = self.any.task(), .next = .none };
        self.rt.vm.eventLoop().enqueueTaskConcurrent(&self.concurrent);
        self.done.wait();
    }

    /// Runs on the worker (VM) thread, dispatched by bun's event loop.
    fn runOnVmThread(self: *EvalRequest) bun.JSError!void {
        defer self.done.set();

        const global = self.rt.vm.global;
        var exception: jsc.JSValue = .js_undefined;
        const result = Bun__REPL__evaluate(
            global,
            self.source.ptr,
            self.source.len,
            self.url.ptr,
            self.url.len,
            &exception,
        );

        // If the eval threw synchronously, exception is set.
        if (exception != .js_undefined) {
            self.is_error = true;
            self.result_buf = exception.toUTF8Bytes(global, self.rt.allocator) catch
                self.rt.allocator.dupe(u8, "<exception (toString failed)>") catch return;
            return;
        }

        // If the result is a pending Promise (top-level await, async IIFE,
        // direct fetch().then(...) etc.), pump the event loop until it
        // resolves. This is exactly what bun does for top-level await in
        // standalone mode.
        var final = result;
        if (result.asAnyPromise()) |promise| {
            self.rt.vm.eventLoop().waitForPromise(promise);
            final = promise.result(global.vm());
            // A rejection is also a "settled" promise; surface the reason
            // as the result for now (matches bun REPL behavior).
            if (promise.status() == .rejected) {
                self.is_error = true;
            }
        }

        self.result_buf = final.toUTF8Bytes(global, self.rt.allocator) catch
            self.rt.allocator.dupe(u8, "<toString failed>") catch return;
    }
};

fn skalAllocator() std.mem.Allocator {
    return bun.default_allocator;
}

// ───────────────────────────────────────────────────────────────────────
// JNI exports
// ───────────────────────────────────────────────────────────────────────

fn jniOnLoad(_: JavaVM, _: ?*anyopaque) callconv(.c) jint {
    return JNI_VERSION_1_6;
}

fn nativeCreateRuntime(_: JNIEnv, _: jclass) callconv(.c) jlong {
    const rt = Runtime.init(skalAllocator()) catch return 0;
    return @intCast(@intFromPtr(rt));
}

fn nativeDisposeRuntime(_: JNIEnv, _: jclass, handle: jlong) callconv(.c) void {
    _ = handle;
    // Intentional leak: bun's VM teardown is wired for process-exit cleanup,
    // and the worker thread is non-cancelable while inside uws::Loop. The
    // process dying will reclaim everything.
}

fn nativeEvaluate(env: JNIEnv, _: jclass, handle: jlong, j_source: jstring, j_url: jstring) callconv(.c) jstring {
    if (handle == 0) return null;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));

    var arena = std.heap.ArenaAllocator.init(rt.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    const source = (getStringUTFOwned(env, a, j_source) catch return null) orelse return null;
    const url = (getStringUTFOwned(env, a, j_url) catch null) orelse "skal:eval";

    var req: EvalRequest = .{ .rt = rt, .source = source, .url = url };
    req.runOnWorker();

    // result_buf is owned by rt.allocator (worker thread allocated it).
    defer if (req.result_buf.len > 0) rt.allocator.free(req.result_buf);

    const utf8z = a.dupeZ(u8, req.result_buf) catch return null;
    return newStringUTF(env, utf8z.ptr);
}

comptime {
    @export(&jniOnLoad, .{ .name = "JNI_OnLoad", .linkage = .strong });
    @export(&nativeCreateRuntime, .{ .name = "Java_com_skal_Skal_nativeCreateRuntime", .linkage = .strong });
    @export(&nativeDisposeRuntime, .{ .name = "Java_com_skal_Skal_nativeDisposeRuntime", .linkage = .strong });
    @export(&nativeEvaluate, .{ .name = "Java_com_skal_Skal_nativeEvaluate", .linkage = .strong });
}
