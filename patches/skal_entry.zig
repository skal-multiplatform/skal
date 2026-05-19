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

// Extra JSC C API used by the native store host functions — reading
// arguments (numbers, strings, typed arrays) and producing results
// (numbers, ArrayBuffers, null).
extern fn JSValueMakeNull(ctx: JSContextRef) JSValueRef;
extern fn JSValueMakeUndefined(ctx: JSContextRef) JSValueRef;
extern fn JSValueToNumber(ctx: JSContextRef, value: JSValueRef, exception: ?*?JSValueRef) f64;
extern fn JSValueToStringCopy(ctx: JSContextRef, value: JSValueRef, exception: ?*?JSValueRef) ?JSStringRef;
extern fn JSStringGetMaximumUTF8CStringSize(string: JSStringRef) usize;
extern fn JSStringGetUTF8CString(string: JSStringRef, buffer: [*]u8, bufferSize: usize) usize;
extern fn JSValueToObject(ctx: JSContextRef, value: JSValueRef, exception: ?*?JSValueRef) ?JSObjectRef;
extern fn JSObjectGetTypedArrayBytesPtr(ctx: JSContextRef, object: JSObjectRef, exception: ?*?JSValueRef) ?*anyopaque;
extern fn JSObjectGetTypedArrayLength(ctx: JSContextRef, object: JSObjectRef, exception: ?*?JSValueRef) usize;

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
    /// Optional prewarmed store. The host calls `skal_prewarm_store` at
    /// launch so the native segment scan overlaps JS VM init + bundle
    /// eval; `__skal_store_open` then picks up the result. Null when the
    /// host didn't prewarm (other platforms / fallback).
    prewarm: ?*StorePrewarm = null,

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

    // __skal_store_* — the native log-structured store engine.
    installStoreGlobals(ctx, global_obj);
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

// ═══════════════════════════════════════════════════════════════════════
// Native store engine — a log-structured key/value store in Zig, exposed
// to JS as globalThis.__skal_store_* host functions. js-app's engine.js
// uses it as the NativeLogStore backend when present. Value bytes are
// opaque (the JS codec owns encoding). Frame format matches frame.js:
//   crc u32 · seq u32 · flags u8 · keyLen u16 · valLen u32 · key · value
// Segments are 256 KiB fixed-size mmap'd files; the keydir maps a key to
// its newest frame; keydir keys are slices into the segment mappings
// (stable — v1 never unmaps or compacts).
// ═══════════════════════════════════════════════════════════════════════

// Default (minimum) segment size. A segment is normally this big and
// holds many frames; a single frame larger than this gets its own
// segment sized exactly to it — so a value of any size is storable,
// bounded only by device storage, never rejected.
const STORE_SEG_SIZE: usize = 256 * 1024;
const STORE_FRAME_HEADER: usize = 15;
const STORE_FLAG_TOMBSTONE: u8 = 1;

const store_crc32_table: [256]u32 = blk: {
    @setEvalBranchQuota(20000);
    var t: [256]u32 = undefined;
    for (0..256) |n| {
        var c: u32 = @intCast(n);
        for (0..8) |_| {
            c = if (c & 1 != 0) 0xEDB88320 ^ (c >> 1) else c >> 1;
        }
        t[n] = c;
    }
    break :blk t;
};

fn storeCrc32(bytes: []const u8) u32 {
    var c: u32 = 0xFFFFFFFF;
    for (bytes) |b| c = store_crc32_table[(c ^ b) & 0xFF] ^ (c >> 8);
    return c ^ 0xFFFFFFFF;
}

const StoreFrame = struct {
    seq: u32,
    flags: u8,
    total: usize,
    key: []const u8,
    value: []const u8,
};

// Decode the frame at `off`. `verify` re-checks the CRC (recovery scan
// needs it to stop at zero padding; the keydir-located read path skips
// it). Returns null on a torn / zero / corrupt frame.
fn storeDecodeFrame(bytes: []const u8, off: usize, verify: bool) ?StoreFrame {
    if (off + STORE_FRAME_HEADER > bytes.len) return null;
    const crc = std.mem.readInt(u32, bytes[off..][0..4], .little);
    const seq = std.mem.readInt(u32, bytes[off + 4 ..][0..4], .little);
    const flags = bytes[off + 8];
    const key_len = std.mem.readInt(u16, bytes[off + 9 ..][0..2], .little);
    const val_len = std.mem.readInt(u32, bytes[off + 11 ..][0..4], .little);
    const total = STORE_FRAME_HEADER + @as(usize, key_len) + @as(usize, val_len);
    if (off + total > bytes.len) return null;
    if (verify and storeCrc32(bytes[off + 4 .. off + total]) != crc) return null;
    const ks = off + STORE_FRAME_HEADER;
    const vs = ks + key_len;
    return .{
        .seq = seq,
        .flags = flags,
        .total = total,
        .key = bytes[ks..vs],
        .value = bytes[vs .. off + total],
    };
}

// Encode a frame directly into `dst` at `off`. `dst` must have room.
fn storeWriteFrame(dst: []u8, off: usize, seq: u32, flags: u8, key: []const u8, value: []const u8) usize {
    const total = STORE_FRAME_HEADER + key.len + value.len;
    std.mem.writeInt(u32, dst[off + 4 ..][0..4], seq, .little);
    dst[off + 8] = flags;
    std.mem.writeInt(u16, dst[off + 9 ..][0..2], @intCast(key.len), .little);
    std.mem.writeInt(u32, dst[off + 11 ..][0..4], @intCast(value.len), .little);
    @memcpy(dst[off + STORE_FRAME_HEADER ..][0..key.len], key);
    @memcpy(dst[off + STORE_FRAME_HEADER + key.len ..][0..value.len], value);
    std.mem.writeInt(u32, dst[off..][0..4], storeCrc32(dst[off + 4 .. off + total]), .little);
    return total;
}

const StoreEntry = struct { seg: u32, off: u32, len: u32, seq: u32 };

const StoreSegment = struct {
    id: u32,
    mapped: []u8,
    cursor: usize,
    capacity: usize,
    dead: usize = 0, // reclaimable bytes (superseded frames + tombstones)
};

const SkalStore = struct {
    allocator: std.mem.Allocator,
    dir: []u8,
    keydir: std.StringHashMapUnmanaged(StoreEntry) = .{},
    segments: std.ArrayListUnmanaged(StoreSegment) = .{},
    // segment id → index into `segments` — compaction drops segments
    // from the middle, so ids are not dense and can't index directly.
    seg_index: std.AutoHashMapUnmanaged(u32, usize) = .{},
    seq: u32 = 0,
    dead: u64 = 0,
    // Reusable scratch for get() results — grown on demand, never freed;
    // JS consumes each result synchronously before the next get.
    get_scratch: []u8 = &[_]u8{},

    // Map segment `id`. When `create`, the file is made `capacity` bytes
    // (caller passes max(SEG_SIZE, frameTotal) so an oversized frame
    // gets a segment sized to fit). For an existing segment `capacity`
    // is ignored — the on-disk file size IS the capacity.
    fn mapSegment(self: *SkalStore, id: u32, capacity: usize, create: bool) !StoreSegment {
        var pbuf: [1024]u8 = undefined;
        const path = try std.fmt.bufPrint(&pbuf, "{s}/seg-{d:0>5}.log", .{ self.dir, id });
        const file = if (create)
            try std.fs.createFileAbsolute(path, .{ .read = true, .truncate = false })
        else
            try std.fs.openFileAbsolute(path, .{ .mode = .read_write });
        defer file.close();
        const fsize: usize = @intCast((try file.stat()).size);
        // For an existing segment the on-disk size is the capacity — but
        // grow a truncated / zero-byte file (a crash between create and
        // setEndPos) back to SEG_SIZE so mmap never sees a 0-length file.
        const want = if (create) capacity else @max(fsize, STORE_SEG_SIZE);
        if (fsize < want) try file.setEndPos(want);
        const mapped = try std.posix.mmap(
            null,
            want,
            std.posix.PROT.READ | std.posix.PROT.WRITE,
            .{ .TYPE = .SHARED },
            file.handle,
            0,
        );
        var cursor: usize = 0;
        while (cursor < want) {
            const f = storeDecodeFrame(mapped, cursor, true) orelse break;
            cursor += f.total;
        }
        return .{ .id = id, .mapped = mapped, .cursor = cursor, .capacity = want, .dead = 0 };
    }

    // Resolve a segment id to its (live) StoreSegment, or null if dropped.
    fn segById(self: *SkalStore, id: u32) ?*StoreSegment {
        const idx = self.seg_index.get(id) orelse return null;
        return &self.segments.items[idx];
    }

    // Account `n` reclaimable bytes against segment `seg_id` (and the
    // store total) — drives compaction's "worst segment" pick.
    fn markDead(self: *SkalStore, seg_id: u32, n: usize) void {
        if (self.segById(seg_id)) |seg| seg.dead += n;
        self.dead += n;
    }

    fn rebuildSegIndex(self: *SkalStore) void {
        self.seg_index.clearRetainingCapacity();
        for (self.segments.items, 0..) |seg, i| {
            self.seg_index.put(self.allocator, seg.id, i) catch {};
        }
    }

    fn replayInto(self: *SkalStore, idx: usize) !void {
        const seg_id = self.segments.items[idx].id;
        const mapped = self.segments.items[idx].mapped;
        const limit = self.segments.items[idx].cursor;
        var off: usize = 0;
        while (off < limit) {
            const f = storeDecodeFrame(mapped, off, true) orelse break;
            // Remove any prior entry first — its frame is now dead, and
            // dropping it also discards the stale key slice so the
            // keydir key always points into the newest frame's segment.
            if (self.keydir.fetchRemove(f.key)) |prev| {
                self.markDead(prev.value.seg, prev.value.len);
            }
            if (f.flags & STORE_FLAG_TOMBSTONE != 0) {
                self.markDead(seg_id, f.total);
            } else {
                try self.keydir.put(self.allocator, f.key, .{
                    .seg = seg_id,
                    .off = @intCast(off),
                    .len = @intCast(f.total),
                    .seq = f.seq,
                });
            }
            if (f.seq > self.seq) self.seq = f.seq;
            off += f.total;
        }
    }

    fn open(allocator: std.mem.Allocator, dir: []const u8) !*SkalStore {
        const self = try allocator.create(SkalStore);
        errdefer allocator.destroy(self);
        self.* = .{ .allocator = allocator, .dir = try allocator.dupe(u8, dir) };
        try std.fs.cwd().makePath(dir);

        var ids = std.ArrayListUnmanaged(u32){};
        defer ids.deinit(allocator);
        {
            var d = try std.fs.openDirAbsolute(dir, .{ .iterate = true });
            defer d.close();
            var it = d.iterate();
            while (try it.next()) |ent| {
                if (ent.name.len == 13 and
                    std.mem.startsWith(u8, ent.name, "seg-") and
                    std.mem.endsWith(u8, ent.name, ".log"))
                {
                    const n = std.fmt.parseInt(u32, ent.name[4..9], 10) catch continue;
                    try ids.append(allocator, n);
                }
            }
        }
        std.mem.sort(u32, ids.items, {}, std.sort.asc(u32));

        // Map every segment (on-disk size = capacity) and index it, then
        // replay in id order so the newest frame for a key wins. An
        // empty store starts with no segment — writeRaw creates segment
        // 0 on the first write, sized to that first frame.
        for (ids.items) |id| {
            const seg = try self.mapSegment(id, 0, false);
            try self.segments.append(allocator, seg);
            try self.seg_index.put(allocator, id, self.segments.items.len - 1);
        }
        for (0..self.segments.items.len) |i| try self.replayInto(i);
        return self;
    }

    fn activeSeg(self: *SkalStore) *StoreSegment {
        return &self.segments.items[self.segments.items.len - 1];
    }

    fn writeRaw(self: *SkalStore, flags: u8, key: []const u8, value: []const u8) !StoreEntry {
        self.seq += 1;
        const total = STORE_FRAME_HEADER + key.len + value.len;
        // A new segment is needed when there is none yet, or the frame
        // doesn't fit the active one. The new segment is sized to
        // max(SEG_SIZE, total) — so a frame of any size always fits.
        const need_new = self.segments.items.len == 0 or
            (self.activeSeg().cursor + total > self.activeSeg().capacity);
        if (need_new) {
            const new_id: u32 = if (self.segments.items.len == 0)
                0
            else
                self.activeSeg().id + 1;
            const ns = try self.mapSegment(new_id, @max(STORE_SEG_SIZE, total), true);
            try self.segments.append(self.allocator, ns);
            try self.seg_index.put(self.allocator, new_id, self.segments.items.len - 1);
        }
        const seg = self.activeSeg();
        const off = seg.cursor;
        _ = storeWriteFrame(seg.mapped, off, self.seq, flags, key, value);
        seg.cursor += total;
        return .{ .seg = seg.id, .off = @intCast(off), .len = @intCast(total), .seq = self.seq };
    }

    fn put(self: *SkalStore, key: []const u8, value: []const u8) !void {
        const e = try self.writeRaw(0, key, value);
        const seg = self.segById(e.seg) orelse return error.SegmentMissing;
        const kslice = seg.mapped[e.off + STORE_FRAME_HEADER .. e.off + STORE_FRAME_HEADER + key.len];
        // Remove the prior entry, THEN insert — so the keydir key is
        // always a slice into the *current* frame's segment. (fetchPut
        // would keep the stale first-inserted key, which can point into
        // a segment compaction later drops → a dangling pointer.)
        if (self.keydir.fetchRemove(key)) |old| {
            self.markDead(old.value.seg, old.value.len);
        }
        try self.keydir.put(self.allocator, kslice, e);
    }

    fn del(self: *SkalStore, key: []const u8) !void {
        if (self.keydir.fetchRemove(key)) |kv| {
            self.markDead(kv.value.seg, kv.value.len);   // superseded frame
            const te = try self.writeRaw(STORE_FLAG_TOMBSTONE, key, "");
            self.markDead(te.seg, te.len);               // tombstone is reclaimable
        }
    }

    // Returns the value slice (into a segment mapping) or null.
    fn get(self: *SkalStore, key: []const u8) ?[]const u8 {
        const e = self.keydir.get(key) orelse return null;
        const seg = self.segById(e.seg) orelse return null;
        const f = storeDecodeFrame(seg.mapped, e.off, false) orelse return null;
        if (f.flags & STORE_FLAG_TOMBSTONE != 0) return null;
        return f.value;
    }

    // Reclaim the worst dead-heavy sealed segment: copy its live frames
    // forward into the active segment, then unmap + delete it. One
    // segment per call — bounded, incremental. Re-putting a live frame
    // re-keys it with a slice into the *new* segment, so once the loop
    // finishes nothing references `worst` and it is safe to drop.
    fn compact(self: *SkalStore) !bool {
        if (self.segments.items.len < 2) return false;
        const active_id = self.activeSeg().id;
        var worst_idx: ?usize = null;
        var worst_dead: usize = 0;
        for (self.segments.items, 0..) |seg, i| {
            if (seg.id == active_id) continue;
            if (seg.dead > worst_dead) {
                worst_dead = seg.dead;
                worst_idx = i;
            }
        }
        const wi = worst_idx orelse return false;
        const worst = self.segments.items[wi]; // value copy — stable across puts
        if (worst.dead * 5 < worst.capacity * 2) return false; // <40% dead — skip
        // `segments` is kept id-ascending, so index 0 is the oldest
        // segment. A tombstone may only be DROPPED when no older segment
        // could still hold a pre-delete frame for its key — i.e. when
        // `worst` is the oldest. Otherwise the tombstone is forwarded so
        // a reopen still sees the deletion (no resurrection).
        const worst_is_oldest = (wi == 0);

        var off: usize = 0;
        while (off < worst.cursor) {
            const f = storeDecodeFrame(worst.mapped, off, false) orelse break;
            if (f.flags & STORE_FLAG_TOMBSTONE != 0) {
                // Forward the tombstone only when the deletion must be
                // preserved: an older segment may still hold a
                // pre-delete frame (`!worst_is_oldest`) AND the key was
                // not re-added since (keydir miss). An obsolete
                // tombstone — key oldest, or key re-added — is dropped.
                if (!worst_is_oldest and self.keydir.get(f.key) == null) {
                    const te = try self.writeRaw(STORE_FLAG_TOMBSTONE, f.key, "");
                    self.markDead(te.seg, te.len); // forwarded — itself reclaimable
                }
            } else if (self.keydir.get(f.key)) |e| {
                if (e.seg == worst.id and e.off == off) {
                    _ = self.keydir.remove(f.key); // drop the slice into `worst`
                    try self.put(f.key, f.value);  // re-key into a live segment
                }
            }
            off += f.total;
        }

        if (self.dead >= worst.dead) self.dead -= worst.dead;
        std.posix.munmap(@alignCast(worst.mapped));
        var pbuf: [1024]u8 = undefined;
        const path = std.fmt.bufPrint(&pbuf, "{s}/seg-{d:0>5}.log", .{ self.dir, worst.id }) catch unreachable;
        std.fs.deleteFileAbsolute(path) catch {};
        _ = self.segments.orderedRemove(wi);
        self.rebuildSegIndex();
        return true;
    }
};

// ── Store prewarm ──────────────────────────────────────────────────
// Opening the store (segment scan → keydir) is native, schema-free and
// thread-independent. The host kicks it off on a background thread at
// launch via skal_prewarm_store — overlapping JS VM init + bundle eval.
// __skal_store_open picks up the prewarmed handle, blocking only on the
// tail of the scan if it hasn't finished.
const StorePrewarm = struct {
    allocator: std.mem.Allocator,
    dir: []u8,
    done: std.Thread.ResetEvent = .{},
    store: ?*SkalStore = null,
};

fn prewarmThreadMain(pw: *StorePrewarm) void {
    pw.store = SkalStore.open(pw.allocator, pw.dir) catch null;
    pw.done.set();
}

// C ABI — begin opening the native store on a background thread. Call
// once, right after skal_create_runtime, with the directory the JS side
// will request. Best-effort: any failure just means __skal_store_open
// opens synchronously instead.
fn skal_prewarm_store(handle: i64, dir_ptr: [*]const u8, dir_len: usize) callconv(.c) void {
    if (handle == 0 or dir_len == 0) return;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));
    if (rt.prewarm != null) return; // already prewarming
    const alloc = skalAllocator();
    const pw = alloc.create(StorePrewarm) catch return;
    pw.* = .{
        .allocator = alloc,
        .dir = alloc.dupe(u8, dir_ptr[0..dir_len]) catch {
            alloc.destroy(pw);
            return;
        },
    };
    rt.prewarm = pw;
    const t = std.Thread.spawn(.{}, prewarmThreadMain, .{pw}) catch {
        pw.done.set(); // no background thread — open lazily on first use
        return;
    };
    t.detach();
}

fn skalStoreFromArg(ctx: JSContextRef, v: JSValueRef) ?*SkalStore {
    const n = JSValueToNumber(ctx, v, null);
    if (!(n > 0)) return null;
    return @ptrFromInt(@as(usize, @intFromFloat(n)));
}

// Copy a JS string argument into a freshly allocated buffer (caller frees).
fn skalStoreArgString(ctx: JSContextRef, v: JSValueRef) ?[]u8 {
    const js_str = JSValueToStringCopy(ctx, v, null) orelse return null;
    defer JSStringRelease(js_str);
    const max = JSStringGetMaximumUTF8CStringSize(js_str);
    const buf = bun.default_allocator.alloc(u8, max) catch return null;
    const n = JSStringGetUTF8CString(js_str, buf.ptr, max); // includes NUL
    return buf[0 .. if (n > 0) n - 1 else 0];
}

// View the bytes of a JS Uint8Array argument (no copy).
fn skalStoreArgBytes(ctx: JSContextRef, v: JSValueRef) []const u8 {
    const obj = JSValueToObject(ctx, v, null) orelse return "";
    const ptr = JSObjectGetTypedArrayBytesPtr(ctx, obj, null) orelse return "";
    const len = JSObjectGetTypedArrayLength(ctx, obj, null);
    const p: [*]const u8 = @ptrCast(ptr);
    return p[0..len];
}

fn skalStoreFreeDeallocator(bytes: ?*anyopaque, _: ?*anyopaque) callconv(.c) void {
    if (bytes) |b| free(b);
}

// __skal_store_open(dir: string) -> handle number (0 on failure)
fn store_open_cb(ctx: JSContextRef, _: JSObjectRef, _: JSObjectRef, argc: usize, args: [*]const JSValueRef, _: ?*?JSValueRef) callconv(.c) ?JSValueRef {
    if (argc < 1) return JSValueMakeNumber(ctx, 0);
    const dir = skalStoreArgString(ctx, args[0]) orelse return JSValueMakeNumber(ctx, 0);
    defer bun.default_allocator.free(dir);
    // Use the host's prewarmed store when it matches this directory —
    // blocking only on the tail of the background scan if still running.
    if (active_runtime) |rt| {
        if (rt.prewarm) |pw| {
            if (std.mem.eql(u8, pw.dir, dir)) {
                rt.prewarm = null; // consume — a later open is independent
                pw.done.wait();
                const store = pw.store orelse
                    (SkalStore.open(bun.default_allocator, dir) catch
                    return JSValueMakeNumber(ctx, 0));
                return JSValueMakeNumber(ctx, @floatFromInt(@intFromPtr(store)));
            }
        }
    }
    const store = SkalStore.open(bun.default_allocator, dir) catch return JSValueMakeNumber(ctx, 0);
    return JSValueMakeNumber(ctx, @floatFromInt(@intFromPtr(store)));
}

// __skal_store_put(handle, key: string, value: Uint8Array)
fn store_put_cb(ctx: JSContextRef, _: JSObjectRef, _: JSObjectRef, argc: usize, args: [*]const JSValueRef, _: ?*?JSValueRef) callconv(.c) ?JSValueRef {
    if (argc >= 3) {
        if (skalStoreFromArg(ctx, args[0])) |store| {
            if (skalStoreArgString(ctx, args[1])) |key| {
                defer bun.default_allocator.free(key);
                store.put(key, skalStoreArgBytes(ctx, args[2])) catch {};
            }
        }
    }
    return JSValueMakeUndefined(ctx);
}

// __skal_store_del(handle, key: string)
fn store_del_cb(ctx: JSContextRef, _: JSObjectRef, _: JSObjectRef, argc: usize, args: [*]const JSValueRef, _: ?*?JSValueRef) callconv(.c) ?JSValueRef {
    if (argc >= 2) {
        if (skalStoreFromArg(ctx, args[0])) |store| {
            if (skalStoreArgString(ctx, args[1])) |key| {
                defer bun.default_allocator.free(key);
                store.del(key) catch {};
            }
        }
    }
    return JSValueMakeUndefined(ctx);
}

// __skal_store_get(handle, key: string) -> ArrayBuffer | null
fn store_get_cb(ctx: JSContextRef, _: JSObjectRef, _: JSObjectRef, argc: usize, args: [*]const JSValueRef, _: ?*?JSValueRef) callconv(.c) ?JSValueRef {
    if (argc < 2) return JSValueMakeNull(ctx);
    const store = skalStoreFromArg(ctx, args[0]) orelse return JSValueMakeNull(ctx);
    const key = skalStoreArgString(ctx, args[1]) orelse return JSValueMakeNull(ctx);
    defer bun.default_allocator.free(key);
    const value = store.get(key) orelse return JSValueMakeNull(ctx);
    // Copy the value out of the mapping into the store's reusable scratch
    // buffer (grown on demand), then hand JS a no-copy ArrayBuffer over
    // it — no deallocator, no per-read malloc/free. Safe because JS
    // decodeValue() consumes the result synchronously before the next
    // get() can overwrite the scratch.
    if (store.get_scratch.len < value.len) {
        if (store.get_scratch.len > 0) bun.default_allocator.free(store.get_scratch);
        store.get_scratch = bun.default_allocator.alloc(u8, value.len) catch {
            store.get_scratch = &[_]u8{};
            return JSValueMakeNull(ctx);
        };
    }
    @memcpy(store.get_scratch[0..value.len], value);
    const ab = JSObjectMakeArrayBufferWithBytesNoCopy(ctx, store.get_scratch.ptr, value.len, null, null, null);
    return @ptrCast(ab);
}

// __skal_store_compact(handle) -> 1 if a segment was reclaimed, else 0
fn store_compact_cb(ctx: JSContextRef, _: JSObjectRef, _: JSObjectRef, argc: usize, args: [*]const JSValueRef, _: ?*?JSValueRef) callconv(.c) ?JSValueRef {
    if (argc < 1) return JSValueMakeNumber(ctx, 0);
    const store = skalStoreFromArg(ctx, args[0]) orelse return JSValueMakeNumber(ctx, 0);
    const did = store.compact() catch false;
    return JSValueMakeNumber(ctx, if (did) 1 else 0);
}

// __skal_store_stats(handle) -> ArrayBuffer of 4×u32 [records, segments, dead, seq]
fn store_stats_cb(ctx: JSContextRef, _: JSObjectRef, _: JSObjectRef, argc: usize, args: [*]const JSValueRef, _: ?*?JSValueRef) callconv(.c) ?JSValueRef {
    if (argc < 1) return JSValueMakeNull(ctx);
    const store = skalStoreFromArg(ctx, args[0]) orelse return JSValueMakeNull(ctx);
    const buf = malloc(16) orelse return JSValueMakeNull(ctx);
    const dst: [*]u8 = @ptrCast(buf);
    std.mem.writeInt(u32, dst[0..4], @intCast(store.keydir.count()), .little);
    std.mem.writeInt(u32, dst[4..8], @intCast(store.segments.items.len), .little);
    std.mem.writeInt(u32, dst[8..12], @truncate(store.dead), .little);
    std.mem.writeInt(u32, dst[12..16], store.seq, .little);
    const ab = JSObjectMakeArrayBufferWithBytesNoCopy(ctx, buf, 16, skalStoreFreeDeallocator, null, null);
    return @ptrCast(ab);
}

fn installStoreFn(ctx: JSContextRef, global_obj: JSObjectRef, name_z: [*:0]const u8, cb: JSObjectCallAsFunctionCallback) void {
    const name = JSStringCreateWithUTF8CString(name_z);
    defer JSStringRelease(name);
    const fn_obj = JSObjectMakeFunctionWithCallback(ctx, name, cb);
    JSObjectSetProperty(ctx, global_obj, name, @ptrCast(fn_obj), 0, null);
}

fn installStoreGlobals(ctx: JSContextRef, global_obj: JSObjectRef) void {
    installStoreFn(ctx, global_obj, "__skal_store_open", store_open_cb);
    installStoreFn(ctx, global_obj, "__skal_store_put", store_put_cb);
    installStoreFn(ctx, global_obj, "__skal_store_get", store_get_cb);
    installStoreFn(ctx, global_obj, "__skal_store_del", store_del_cb);
    installStoreFn(ctx, global_obj, "__skal_store_compact", store_compact_cb);
    installStoreFn(ctx, global_obj, "__skal_store_stats", store_stats_cb);
}

comptime {
    // C ABI exports — dart:ffi consumer.
    @export(&skal_create_runtime, .{ .name = "skal_create_runtime", .linkage = .strong });
    @export(&skal_dispose_runtime, .{ .name = "skal_dispose_runtime", .linkage = .strong });
    @export(&skal_evaluate, .{ .name = "skal_evaluate", .linkage = .strong });
    @export(&skal_free_string, .{ .name = "skal_free_string", .linkage = .strong });
    @export(&skal_acquire_bridge, .{ .name = "skal_acquire_bridge", .linkage = .strong });
    @export(&skal_wake_js, .{ .name = "skal_wake_js", .linkage = .strong });
    @export(&skal_prewarm_store, .{ .name = "skal_prewarm_store", .linkage = .strong });
}
