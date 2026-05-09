//! Skal JNI bridge — exports JNI symbols that wire Java to bun's actual
//! VirtualMachine + JSGlobalObject + JSValue. This file is compiled as part
//! of bun's normal Zig build (via comptime import in main.zig); the
//! resulting symbols land in one of the bun-zig.*.o objects.
//!
//! Symbols (as resolved by Java's System.loadLibrary):
//!   JNI_OnLoad
//!   Java_com_skal_Skal_nativeCreateRuntime() -> jlong
//!   Java_com_skal_Skal_nativeDisposeRuntime(jlong)
//!   Java_com_skal_Skal_nativeEvaluate(jlong, jstring, jstring) -> jstring

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
// vendor/bun/src/jsc/bindings/bindings.cpp:6370. Returns the result
// JSValue, or undefined when an exception was thrown (the exception is
// stored in *exception_out).
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
// Skal Runtime — owns one bun VirtualMachine.
// ───────────────────────────────────────────────────────────────────────

const Runtime = struct {
    allocator: std.mem.Allocator,
    vm: *jsc.VirtualMachine,

    fn init(allocator: std.mem.Allocator) !*Runtime {
        // One-time JSC setup. Idempotent on subsequent calls.
        bun.jsc.initialize(false);

        // TransformOptions has many required fields; zero-init mirrors what
        // bun's JSTranspiler does for `default_transform_options`.
        const args: bun.schema.api.TransformOptions = std.mem.zeroes(bun.schema.api.TransformOptions);
        const vm = try jsc.VirtualMachine.init(.{
            .allocator = allocator,
            .args = args,
            .smol = true,
            .is_main_thread = true,
        });

        const rt = try allocator.create(Runtime);
        rt.* = .{ .allocator = allocator, .vm = vm };
        return rt;
    }

    fn deinit(self: *Runtime) void {
        // bun's VM tear-down is non-trivial and hardcoded for process
        // shutdown; for an embedded Java consumer it's safer to leak the
        // VM until the process exits. Just free the holder.
        self.allocator.destroy(self);
    }

    fn evaluate(self: *Runtime, source: []const u8, filename: []const u8) ![]u8 {
        const global = self.vm.global;
        var exception: jsc.JSValue = .js_undefined;
        const result = Bun__REPL__evaluate(
            global,
            source.ptr,
            source.len,
            filename.ptr,
            filename.len,
            &exception,
        );

        if (exception != .js_undefined) {
            const exc_str = exception.toUTF8Bytes(global, self.allocator) catch
                return self.allocator.dupe(u8, "<exception (toString failed)>");
            defer self.allocator.free(exc_str);
            return std.fmt.allocPrint(self.allocator, "Error: {s}", .{exc_str});
        }

        return result.toUTF8Bytes(global, self.allocator) catch
            self.allocator.dupe(u8, "<toString failed>");
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
    if (handle == 0) return;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));
    rt.deinit();
}

fn nativeEvaluate(env: JNIEnv, _: jclass, handle: jlong, j_source: jstring, j_url: jstring) callconv(.c) jstring {
    if (handle == 0) return null;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));

    var arena = std.heap.ArenaAllocator.init(rt.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    const source = (getStringUTFOwned(env, a, j_source) catch return null) orelse return null;
    const url = (getStringUTFOwned(env, a, j_url) catch null) orelse "skal:eval";

    const utf8 = rt.evaluate(source, url) catch |e| {
        var buf: [256]u8 = undefined;
        const msg = std.fmt.bufPrintZ(&buf, "skal: evaluate failed: {s}", .{@errorName(e)}) catch return null;
        return newStringUTF(env, msg.ptr);
    };
    defer rt.allocator.free(utf8);

    const utf8z = a.dupeZ(u8, utf8) catch return null;
    return newStringUTF(env, utf8z.ptr);
}

comptime {
    @export(&jniOnLoad, .{ .name = "JNI_OnLoad", .linkage = .strong });
    @export(&nativeCreateRuntime, .{ .name = "Java_com_skal_Skal_nativeCreateRuntime", .linkage = .strong });
    @export(&nativeDisposeRuntime, .{ .name = "Java_com_skal_Skal_nativeDisposeRuntime", .linkage = .strong });
    @export(&nativeEvaluate, .{ .name = "Java_com_skal_Skal_nativeEvaluate", .linkage = .strong });
}
