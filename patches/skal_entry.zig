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
//! Plus: an ultra-low-latency UI bridge built on a single 1 MiB shared
//! memory region. JS sees it as a `Uint8Array` (no copy via JSC's
//! `JSObjectMakeArrayBufferWithBytesNoCopy`); Kotlin sees it as a
//! `DirectByteBuffer` (no copy via JNI's `NewDirectByteBuffer`). Both
//! sides write/read through their own views of the same memory.
//!
//! Layout (see patches/SKAL_WIRE.md for the full spec):
//!
//!   [ Header 64B ][ Op ring 1 MiB ][ String heap 512 KiB ][ Event ring 64 KiB ]
//!
//! Sync is a single atomic seq counter per direction. JS bumps op_seq
//! after writing a frame's worth of ops; Compose bumps event_seq after
//! writing a touch event.

const std = @import("std");
const builtin = @import("builtin");
const bun = @import("bun");
const jsc = bun.jsc;

// ───────────────────────────────────────────────────────────────────────
// JNI ABI — slot-indexed access to JNINativeInterface.
// ───────────────────────────────────────────────────────────────────────

const jint = i32;
const jlong = i64;
const jboolean = u8;
const jclass = ?*anyopaque;
const jstring = ?*anyopaque;
const jobject = ?*anyopaque;
const JNIEnv = ?*const ?*const anyopaque;
const JavaVM = ?*const ?*const anyopaque;

const JNI_VERSION_1_6: jint = 0x00010006;

const JniSlot = struct {
    pub const NewStringUTF: usize = 167;
    pub const GetStringUTFChars: usize = 169;
    pub const ReleaseStringUTFChars: usize = 170;
    pub const NewDirectByteBuffer: usize = 229;
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

fn newDirectByteBuffer(env: JNIEnv, addr: *anyopaque, capacity: jlong) jobject {
    const F = *const fn (JNIEnv, *anyopaque, jlong) callconv(.c) jobject;
    return jniFn(env, JniSlot.NewDirectByteBuffer, F)(env, addr, capacity);
}

// ───────────────────────────────────────────────────────────────────────
// JSC C API — minimal subset for registering a native global function and
// for creating no-copy ArrayBuffers wrapping our shared region.
// All these symbols are exported by libJavaScriptCore.a; they're stable
// public ABI.
// ───────────────────────────────────────────────────────────────────────

const JSContextRef = *anyopaque;
const JSObjectRef = *anyopaque;
const JSValueRef = *anyopaque;
const JSStringRef = *anyopaque;

const JSObjectCallAsFunctionCallback = *const fn (
    ctx: JSContextRef,
    function: JSObjectRef,
    thisObject: JSObjectRef,
    argumentCount: usize,
    arguments: [*]const JSValueRef,
    exception: ?*?JSValueRef,
) callconv(.c) ?JSValueRef;

const JSTypedArrayBytesDeallocator = ?*const fn (bytes: ?*anyopaque, deallocator_ctx: ?*anyopaque) callconv(.c) void;

extern fn JSStringCreateWithUTF8CString(string: [*:0]const u8) JSStringRef;
extern fn JSStringRelease(string: JSStringRef) void;

extern fn JSContextGetGlobalObject(ctx: JSContextRef) JSObjectRef;
extern fn JSObjectMakeFunctionWithCallback(
    ctx: JSContextRef,
    name: ?JSStringRef,
    callAsFunction: JSObjectCallAsFunctionCallback,
) JSObjectRef;
extern fn JSObjectSetProperty(
    ctx: JSContextRef,
    object: JSObjectRef,
    propertyName: JSStringRef,
    value: JSValueRef,
    attributes: u32,
    exception: ?*?JSValueRef,
) void;
extern fn JSObjectMakeArrayBufferWithBytesNoCopy(
    ctx: JSContextRef,
    bytes: ?*anyopaque,
    byteLength: usize,
    bytesDeallocator: JSTypedArrayBytesDeallocator,
    deallocatorContext: ?*anyopaque,
    exception: ?*?JSValueRef,
) JSObjectRef;
extern fn JSValueMakeNumber(ctx: JSContextRef, number: f64) JSValueRef;
extern fn JSValueIsObject(ctx: JSContextRef, value: JSValueRef) bool;
extern fn JSValueProtect(ctx: JSContextRef, value: JSValueRef) void;
extern fn JSObjectGetProperty(
    ctx: JSContextRef,
    object: JSObjectRef,
    propertyName: JSStringRef,
    exception: ?*?JSValueRef,
) JSValueRef;
extern fn JSObjectCallAsFunction(
    ctx: JSContextRef,
    object: JSObjectRef,
    thisObject: ?JSObjectRef,
    argumentCount: usize,
    arguments: ?[*]const JSValueRef,
    exception: ?*?JSValueRef,
) ?JSValueRef;

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
// Shared bridge buffer.
//
// One contiguous 1.5 MiB region pinned for the life of the runtime. JS
// gets a no-copy ArrayBuffer; Kotlin gets a no-copy DirectByteBuffer.
//
// Both sides agree on this layout, also documented in patches/SKAL_WIRE.md.
// ───────────────────────────────────────────────────────────────────────

const BRIDGE_SIZE: usize = 1024 * 1024 * 2; // 2 MiB total
const HEADER_SIZE: usize = 64;
const OP_RING_OFFSET: usize = HEADER_SIZE; // bytes 64..1MB+64
const OP_RING_SIZE: usize = 1024 * 1024;
const STRING_HEAP_OFFSET: usize = OP_RING_OFFSET + OP_RING_SIZE;
const STRING_HEAP_SIZE: usize = 512 * 1024;
const EVENT_RING_OFFSET: usize = STRING_HEAP_OFFSET + STRING_HEAP_SIZE;
const EVENT_RING_SIZE: usize = BRIDGE_SIZE - EVENT_RING_OFFSET;

const Bridge = struct {
    buffer: []align(64) u8,
    allocator: std.mem.Allocator,

    fn init(allocator: std.mem.Allocator) !*Bridge {
        const self = try allocator.create(Bridge);
        // Page-aligned alloc keeps the header on its own cache line.
        const buf = try allocator.alignedAlloc(u8, .@"64", BRIDGE_SIZE);
        @memset(buf, 0);
        self.* = .{ .buffer = buf, .allocator = allocator };
        return self;
    }
};

// ───────────────────────────────────────────────────────────────────────
// Skal Runtime — owns one bun VirtualMachine pinned to one worker thread,
// plus the bridge buffer.
// ───────────────────────────────────────────────────────────────────────

const Runtime = struct {
    allocator: std.mem.Allocator,
    vm: *jsc.VirtualMachine = undefined,
    bridge: *Bridge = undefined,
    worker_thread: std.Thread = undefined,
    /// Signaled when the worker thread has initialized the VM and is ready
    /// to accept tasks.
    ready: std.Thread.ResetEvent = .{},
    init_failed: std.atomic.Value(bool) = .{ .raw = false },
    /// Cached `__skal_drainEvents` JS function reference. Lazily resolved on
    /// the first wake (after the user JS has installed the global) and
    /// `JSValueProtect`'d so JSC's GC doesn't reclaim it. EventDrainTask
    /// calls it directly via `JSObjectCallAsFunction`, which avoids the
    /// per-click parse + compile cost of `Bun__REPL__evaluate` against a
    /// source string. Saves ~50 µs per click on the JS thread.
    drain_fn: ?JSObjectRef = null,

    fn init(allocator: std.mem.Allocator) !*Runtime {
        const self = try allocator.create(Runtime);
        errdefer allocator.destroy(self);
        self.* = .{
            .allocator = allocator,
            .bridge = try Bridge.init(allocator),
        };
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

        // Install the bridge globals before any user JS runs. Stores a
        // pointer to *this* Runtime in a thread-local so the JSC host fn
        // can find us back. There's only one VM per Runtime per thread.
        active_runtime = self;
        installBridgeGlobals(vm);

        self.ready.set();

        // bun's standard tick-forever loop.
        while (true) {
            vm.eventLoop().tickPossiblyForever();
        }
    }
};

/// Set in workerMain before any host fn can be called. Used by
/// `acquireBridgeBuffer_jsCallback` to find the live Runtime.
threadlocal var active_runtime: ?*Runtime = null;

/// JSC host function — called from JS as `globalThis.__skal_acquireBridge()`.
/// Returns the bridge buffer as a no-copy `ArrayBuffer`.
fn acquireBridgeBuffer_jsCallback(
    ctx: JSContextRef,
    _: JSObjectRef,
    _: JSObjectRef,
    _: usize,
    _: [*]const JSValueRef,
    _: ?*?JSValueRef,
) callconv(.c) ?JSValueRef {
    const rt = active_runtime orelse return null;
    const ab = JSObjectMakeArrayBufferWithBytesNoCopy(
        ctx,
        rt.bridge.buffer.ptr,
        rt.bridge.buffer.len,
        null, // we own the deallocation; never freed for runtime lifetime
        null,
        null,
    );
    return @ptrCast(ab);
}

fn installBridgeGlobals(vm: *jsc.VirtualMachine) void {
    const ctx: JSContextRef = @ptrCast(vm.global);
    const global_obj = JSContextGetGlobalObject(ctx);

    // __skal_acquireBridge() -> ArrayBuffer (no-copy view of bridge buffer)
    const name = JSStringCreateWithUTF8CString("__skal_acquireBridge");
    defer JSStringRelease(name);
    const fn_obj = JSObjectMakeFunctionWithCallback(ctx, name, acquireBridgeBuffer_jsCallback);
    JSObjectSetProperty(ctx, global_obj, name, @ptrCast(fn_obj), 0, null);
}

// ───────────────────────────────────────────────────────────────────────
// EvalRequest — same as before, posted from Java thread to bun's queue.
// ───────────────────────────────────────────────────────────────────────

const EvalRequest = struct {
    rt: *Runtime,
    source: []const u8,
    url: []const u8,

    result_buf: []u8 = "",
    is_error: bool = false,
    done: std.Thread.ResetEvent = .{},

    any: bun.jsc.AnyTask = undefined,
    concurrent: bun.jsc.ConcurrentTask = undefined,

    fn runOnWorker(self: *EvalRequest) void {
        self.any = bun.jsc.AnyTask.New(EvalRequest, runOnVmThread).init(self);
        self.concurrent = .{ .task = self.any.task(), .next = .none };
        self.rt.vm.eventLoop().enqueueTaskConcurrent(&self.concurrent);
        self.done.wait();
    }

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

        if (exception != .js_undefined) {
            self.is_error = true;
            self.result_buf = exception.toUTF8Bytes(global, self.rt.allocator) catch
                self.rt.allocator.dupe(u8, "<exception (toString failed)>") catch return;
            return;
        }

        var final = result;
        if (result.asAnyPromise()) |promise| {
            self.rt.vm.eventLoop().waitForPromise(promise);
            final = promise.result(global.vm());
            if (promise.status() == .rejected) self.is_error = true;
        }

        self.result_buf = final.toUTF8Bytes(global, self.rt.allocator) catch
            self.rt.allocator.dupe(u8, "<toString failed>") catch return;
    }
};

// ───────────────────────────────────────────────────────────────────────
// EventDrainTask — scheduled by Compose's nativeWakeJs. Runs on the JS
// thread; calls into JS land which reads the event ring and dispatches
// to JS handlers. JS-side dispatcher is `globalThis.__skal_drainEvents`,
// installed by the JS bridge module.
//
// Hot path: cached JSObjectRef + JSObjectCallAsFunction. The first wake
// resolves `globalThis.__skal_drainEvents` and protects it; subsequent
// wakes call directly with no parse, no compile, no string interning.
// Fallback to source-eval is kept only for the (unreachable) case where
// the user JS hasn't installed the global before the first wake.
// ───────────────────────────────────────────────────────────────────────

const drain_source = "globalThis.__skal_drainEvents && globalThis.__skal_drainEvents();";

const EventDrainTask = struct {
    rt: *Runtime,
    any: bun.jsc.AnyTask = undefined,
    concurrent: bun.jsc.ConcurrentTask = undefined,

    fn run(self: *EventDrainTask) bun.JSError!void {
        defer bun.default_allocator.destroy(self);

        const global = self.rt.vm.global;
        const ctx: JSContextRef = @ptrCast(global);

        // Lazy-cache the drain function on the first wake. Functions are
        // objects in JSC; once protected, the JS GC won't collect it.
        if (self.rt.drain_fn == null) {
            const global_obj = JSContextGetGlobalObject(ctx);
            const name = JSStringCreateWithUTF8CString("__skal_drainEvents");
            defer JSStringRelease(name);
            const value = JSObjectGetProperty(ctx, global_obj, name, null);
            if (JSValueIsObject(ctx, value)) {
                JSValueProtect(ctx, value);
                // JSObjectRef and JSValueRef are both `*anyopaque`; functions
                // ARE objects in JSC, so the cast is safe once IsObject passed.
                self.rt.drain_fn = value;
            }
        }

        if (self.rt.drain_fn) |fn_obj| {
            const global_obj = JSContextGetGlobalObject(ctx);
            var exception: ?JSValueRef = null;
            _ = JSObjectCallAsFunction(ctx, fn_obj, global_obj, 0, null, &exception);
            // Microtasks queued by Solid's effect flush will be drained by
            // bun's tick() loop after we return — we're called from inside
            // tickWithCount, which calls drainMicrotasksWithGlobal at the
            // end of its inner while loop. Manually draining here re-enters
            // the loop and hangs the worker.
            return;
        }

        // Fallback: __skal_drainEvents wasn't installed yet. Eval the source
        // form so we still drain the event. On subsequent wakes the cache
        // path will succeed.
        var exception: jsc.JSValue = .js_undefined;
        _ = Bun__REPL__evaluate(global, drain_source.ptr, drain_source.len, "skal:drain".ptr, "skal:drain".len, &exception);
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
    // Intentional leak; bun's VM teardown is process-exit-only.
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

    defer if (req.result_buf.len > 0) rt.allocator.free(req.result_buf);

    const utf8z = a.dupeZ(u8, req.result_buf) catch return null;
    return newStringUTF(env, utf8z.ptr);
}

/// Returns a DirectByteBuffer over the shared bridge memory (no copy).
/// Called once at startup by the Kotlin side.
fn nativeAcquireBridge(env: JNIEnv, _: jclass, handle: jlong) callconv(.c) jobject {
    if (handle == 0) return null;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));
    return newDirectByteBuffer(env, rt.bridge.buffer.ptr, @intCast(rt.bridge.buffer.len));
}

/// Compose has written one or more events into the event ring and
/// incremented event_seq. Wake the JS thread so it drains the ring.
/// Called from the Compose thread.
fn nativeWakeJs(_: JNIEnv, _: jclass, handle: jlong) callconv(.c) void {
    if (handle == 0) return;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));

    // Heap-alloc a one-shot drain task. Must outlive enqueue → run.
    const task = bun.default_allocator.create(EventDrainTask) catch return;
    task.* = .{ .rt = rt };
    task.any = bun.jsc.AnyTask.New(EventDrainTask, EventDrainTask.run).init(task);
    task.concurrent = .{ .task = task.any.task(), .next = .none };
    rt.vm.eventLoop().enqueueTaskConcurrent(&task.concurrent);
}

comptime {
    @export(&jniOnLoad, .{ .name = "JNI_OnLoad", .linkage = .strong });
    @export(&nativeCreateRuntime, .{ .name = "Java_com_skal_Skal_nativeCreateRuntime", .linkage = .strong });
    @export(&nativeDisposeRuntime, .{ .name = "Java_com_skal_Skal_nativeDisposeRuntime", .linkage = .strong });
    @export(&nativeEvaluate, .{ .name = "Java_com_skal_Skal_nativeEvaluate", .linkage = .strong });
    @export(&nativeAcquireBridge, .{ .name = "Java_com_skal_Skal_nativeAcquireBridge", .linkage = .strong });
    @export(&nativeWakeJs, .{ .name = "Java_com_skal_Skal_nativeWakeJs", .linkage = .strong });
}
