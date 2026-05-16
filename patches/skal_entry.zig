//! Skal — embedded bun + JSC runtime, exposes JS to a host renderer.
//!
//! Architecture:
//!
//!   ┌─────────────┐    enqueueTaskConcurrent    ┌─────────────────────┐
//!   │ Host thread │ ─────────────────────────► │  Skal worker thread │
//!   │  (UI/main)  │                             │  owns VM, runs      │
//!   │             │ ◄───────  ResetEvent ────── │  tickPossiblyForever│
//!   └─────────────┘                             └─────────────────────┘
//!
//! Plus: an ultra-low-latency UI bridge built on a single 2 MiB shared
//! memory region. JS sees it as a `Uint8Array` (no copy via JSC's
//! `JSObjectMakeArrayBufferWithBytesNoCopy`); the host sees it via a
//! raw pointer + length returned by `skal_acquire_bridge`. Both sides
//! write/read through their own views of the same memory.
//!
//! Layout (see PROPS_PLAN.md § 2 for the full spec):
//!
//!   [ Header 64B ][ Op ring 1 MiB ][ String heap 512 KiB ][ Event ring 64 KiB ]
//!
//! Sync is a single atomic seq counter per direction. JS bumps op_seq
//! after writing a frame's worth of ops; the host bumps event_seq after
//! writing a touch event.

const std = @import("std");
const builtin = @import("builtin");
const bun = @import("bun");
const jsc = bun.jsc;

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
// gets a no-copy ArrayBuffer; the host gets a raw pointer view.
//
// Both sides agree on this layout, also documented in PROPS_PLAN.md § 2.
// ───────────────────────────────────────────────────────────────────────

const BRIDGE_SIZE: usize = 1024 * 1024 * 6; // 6 MiB total
const HEADER_SIZE: usize = 64;
const OP_RING_OFFSET: usize = HEADER_SIZE;
const OP_RING_SIZE: usize = 4 * 1024 * 1024;
const STRING_HEAP_OFFSET: usize = OP_RING_OFFSET + OP_RING_SIZE;
const STRING_HEAP_SIZE: usize = 1024 * 1024;
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

        // Long-lived event loop — mirrors bun's watcher-mode loop in
        // `src/bun.js.zig`. While the loop has work — pending timers,
        // I/O, queued tasks — tick *actively*: `autoTickActive` is the
        // tick that computes the next-timer timeout for the uSockets
        // sleep AND calls `timer.drainTimers`, so `setTimeout` /
        // `setInterval` callbacks actually fire. When the loop is
        // fully idle, block in `tickPossiblyForever` until a bridge
        // event (a concurrent task) wakes us.
        //
        // The previous code ran ONLY `tickPossiblyForever`, which does
        // neither — it sleeps on the uSockets loop with no timer
        // timeout and never drains the timer heap, so JS timers never
        // fired. Bridge events still worked only because
        // `enqueueTaskConcurrent` issues an explicit loop wakeup.
        while (true) {
            while (vm.isEventLoopAlive()) {
                vm.tick();
                vm.eventLoop().autoTickActive();
            }
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
// EvalRequest — posted from the host thread to bun's worker queue.
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
// EventDrainTask — scheduled by the host's wakeJs call. Runs on the JS
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
// C ABI exports — the surface dart:ffi binds against. Plain C signatures
// so any non-JS embedder (Flutter, an FFI client, a C test harness)
// can call into the runtime. See native/ios/skal.h for the contract.
// ───────────────────────────────────────────────────────────────────────

fn skal_create_runtime() callconv(.c) i64 {
    const rt = Runtime.init(skalAllocator()) catch return 0;
    return @intCast(@intFromPtr(rt));
}

fn skal_dispose_runtime(handle: i64) callconv(.c) void {
    _ = handle;
    // Intentional leak; bun's VM teardown is process-exit-only.
}

// libc malloc/free for the result buffer: skal_free_string only gets a
// pointer back (no length) so we use the standard C allocator that
// tracks size internally. The result buffer that EvalRequest produced
// (in rt.allocator) is copied into a malloc'd slot, then the original
// is freed.
extern "c" fn malloc(size: usize) ?*anyopaque;
extern "c" fn free(ptr: ?*anyopaque) void;

fn skal_evaluate(
    handle: i64,
    source_ptr: [*]const u8,
    source_len: usize,
    url_ptr: [*]const u8,
    url_len: usize,
    out_result: *?[*]u8,
    out_result_len: *usize,
    out_is_error: *c_int,
) callconv(.c) void {
    out_result.* = null;
    out_result_len.* = 0;
    out_is_error.* = 0;
    if (handle == 0) {
        out_is_error.* = 1;
        return;
    }
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));

    const source: []const u8 = source_ptr[0..source_len];
    const url: []const u8 = if (url_len > 0) url_ptr[0..url_len] else "skal:eval";

    var req: EvalRequest = .{ .rt = rt, .source = source, .url = url };
    req.runOnWorker();
    defer if (req.result_buf.len > 0) rt.allocator.free(req.result_buf);

    out_is_error.* = if (req.is_error) 1 else 0;

    if (req.result_buf.len > 0) {
        // Copy into a libc-malloc'd buffer so callers can free it with
        // a length-less call (skal_free_string → libc free).
        if (malloc(req.result_buf.len)) |p| {
            const dst: [*]u8 = @ptrCast(p);
            @memcpy(dst[0..req.result_buf.len], req.result_buf);
            out_result.* = dst;
            out_result_len.* = req.result_buf.len;
        } else {
            // libc malloc failed — most likely a real OOM. Don't drop
            // the request silently: surface a sentinel error string the
            // host can decode and turn into a runtime exception.
            // Use a small static literal so we don't need yet-another
            // allocator to report failure.
            const oom_msg = "skal: out of memory copying eval result";
            const buf = malloc(oom_msg.len);
            if (buf) |p| {
                const dst: [*]u8 = @ptrCast(p);
                @memcpy(dst[0..oom_msg.len], oom_msg);
                out_result.* = dst;
                out_result_len.* = oom_msg.len;
            }
            // If even the sentinel allocation fails, leave out_result
            // null but signal error — caller still sees out_is_error=1
            // and a null/empty body is treated as "OOM, no detail".
            out_is_error.* = 1;
        }
    }
}

fn skal_free_string(str: ?[*]u8) callconv(.c) void {
    if (str) |p| free(@ptrCast(p));
}

fn skal_acquire_bridge(
    handle: i64,
    out_ptr: *?*anyopaque,
    out_len: *usize,
) callconv(.c) void {
    out_ptr.* = null;
    out_len.* = 0;
    if (handle == 0) return;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));
    out_ptr.* = @ptrCast(rt.bridge.buffer.ptr);
    out_len.* = rt.bridge.buffer.len;
}

fn skal_wake_js(handle: i64) callconv(.c) void {
    if (handle == 0) return;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));

    const task = bun.default_allocator.create(EventDrainTask) catch return;
    task.* = .{ .rt = rt };
    task.any = bun.jsc.AnyTask.New(EventDrainTask, EventDrainTask.run).init(task);
    task.concurrent = .{ .task = task.any.task(), .next = .none };
    rt.vm.eventLoop().enqueueTaskConcurrent(&task.concurrent);
}

comptime {
    // C ABI exports — dart:ffi consumer.
    @export(&skal_create_runtime, .{ .name = "skal_create_runtime", .linkage = .strong });
    @export(&skal_dispose_runtime, .{ .name = "skal_dispose_runtime", .linkage = .strong });
    @export(&skal_evaluate, .{ .name = "skal_evaluate", .linkage = .strong });
    @export(&skal_free_string, .{ .name = "skal_free_string", .linkage = .strong });
    @export(&skal_acquire_bridge, .{ .name = "skal_acquire_bridge", .linkage = .strong });
    @export(&skal_wake_js, .{ .name = "skal_wake_js", .linkage = .strong });
}
