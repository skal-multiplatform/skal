//! JNI bridge — exposes the Skal Runtime to Java/Kotlin.
//!
//! Java side lives in android/java/com/skal/Skal.java and binds these
//! symbols via System.loadLibrary("skal"). Symbol mangling follows the
//! standard JNI rule: Java_<package>_<class>_<method> with periods
//! replaced by underscores.
//!
//! Pattern: Java holds an opaque long handle returned by createRuntime,
//! and passes it back on every call. The handle is the *Runtime pointer
//! (cast to jlong). dispose frees it.

const std = @import("std");
const builtin = @import("builtin");
const env_mod = @import("../env.zig");
const Runtime = @import("../runtime/Runtime.zig");
const log = @import("../platform/log.zig");
const jni = @import("jni_h.zig");

const expose = env_mod.is_android;

fn allocator() std.mem.Allocator {
    // Long-lived runtimes; page allocator is fine. A real port should
    // mirror bun's BunAllocator (mimalloc) once we vendor mimalloc.
    return std.heap.page_allocator;
}

fn createRuntime(j_env: jni.JNIEnv, this_class: jni.jclass) callconv(.c) jni.jlong {
    _ = j_env;
    _ = this_class;
    const rt = Runtime.init(allocator()) catch |e| {
        log.err("Skal.createRuntime failed: {s}", .{@errorName(e)});
        return 0;
    };
    return @intCast(@intFromPtr(rt));
}

fn disposeRuntime(j_env: jni.JNIEnv, this_class: jni.jclass, handle: jni.jlong) callconv(.c) void {
    _ = j_env;
    _ = this_class;
    if (handle == 0) return;
    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));
    rt.deinit();
}

fn evaluateScript(
    j_env: jni.JNIEnv,
    this_class: jni.jclass,
    handle: jni.jlong,
    j_source: jni.jstring,
    j_url: jni.jstring,
) callconv(.c) jni.jstring {
    _ = this_class;
    if (handle == 0) return null;
    if (j_source == null) return null;

    const rt: *Runtime = @ptrFromInt(@as(usize, @intCast(handle)));

    // We use an arena for transient strings on this call boundary.
    var arena = std.heap.ArenaAllocator.init(allocator());
    defer arena.deinit();
    const a = arena.allocator();

    const source = (jni.jstringToOwned(j_env, a, j_source) catch null) orelse return null;
    const url = jni.jstringToOwned(j_env, a, j_url) catch null;

    const result = rt.runScript(source, url) catch |e| {
        log.err("Skal.evaluate failed: {s}", .{@errorName(e)});
        return null;
    };

    rt.runEventLoop();

    const utf8 = result.toString(a) catch return null;
    // NewStringUTF needs a NUL-terminated buffer.
    const z = a.dupeZ(u8, utf8) catch return null;
    return jni.newStringUTF(j_env, z.ptr);
}

fn onLoad(vm: jni.JavaVM, reserved: ?*anyopaque) callconv(.c) jni.jint {
    _ = vm;
    _ = reserved;
    log.info("Skal loaded (engine={s})", .{@tagName(env_mod.engine)});
    return jni.JNI_VERSION_1_6;
}

// JNI symbol mangling: Java_<package>_<class>_<method>, dots → underscores.
//   class: com.skal.Skal
//   methods:
//     private static native long   nativeCreateRuntime();
//     private static native void   nativeDisposeRuntime(long handle);
//     private static native String nativeEvaluate(long handle, String source, String url);
comptime {
    if (expose) {
        @export(&onLoad, .{ .name = "JNI_OnLoad", .linkage = .strong });
        @export(&createRuntime, .{ .name = "Java_com_skal_Skal_nativeCreateRuntime", .linkage = .strong });
        @export(&disposeRuntime, .{ .name = "Java_com_skal_Skal_nativeDisposeRuntime", .linkage = .strong });
        @export(&evaluateScript, .{ .name = "Java_com_skal_Skal_nativeEvaluate", .linkage = .strong });
    }
}
