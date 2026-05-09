//! JNI bindings — only the subset Skal calls.
//!
//! The JNINativeInterface vtable has ~230 function pointers in a stable
//! order. Rather than redeclare all of them, we index into the table by
//! slot number using helpers below. Slot indices come from the canonical
//! NDK jni.h ordering:
//!   $NDK/toolchains/llvm/prebuilt/<host>/sysroot/usr/include/jni.h

const std = @import("std");

pub const jint = i32;
pub const jlong = i64;
pub const jboolean = u8;
pub const jbyte = i8;
pub const jchar = u16;
pub const jshort = i16;
pub const jfloat = f32;
pub const jdouble = f64;
pub const jsize = jint;

pub const jobject = ?*anyopaque;
pub const jclass = ?*anyopaque;
pub const jthrowable = ?*anyopaque;
pub const jstring = ?*anyopaque;
pub const jarray = ?*anyopaque;
pub const jbyteArray = ?*anyopaque;
pub const jobjectArray = ?*anyopaque;

pub const JNI_FALSE: jboolean = 0;
pub const JNI_TRUE: jboolean = 1;
pub const JNI_OK: jint = 0;
pub const JNI_ERR: jint = -1;
pub const JNI_VERSION_1_6: jint = 0x00010006;

/// JNIEnv is a pointer to a pointer to the function table.
/// Treat as [*]?*const anyopaque indexed by JNI slot number.
pub const JNIEnv = ?*const ?*const anyopaque;
pub const JavaVM = ?*const ?*const anyopaque;

pub const JavaVMAttachArgs = extern struct {
    version: jint,
    name: ?[*:0]const u8,
    group: jobject,
};

// ── Slot indices in JNINativeInterface (from NDK jni.h, in declaration order)
// Reserved slots 0-3, then GetVersion=4. The struct counts every individual
// function pointer field.
pub const slot = struct {
    pub const ExceptionOccurred: usize = 15;
    pub const ExceptionDescribe: usize = 16;
    pub const ExceptionClear: usize = 17;
    pub const DeleteLocalRef: usize = 23;
    pub const NewStringUTF: usize = 167;
    pub const GetStringUTFLength: usize = 168;
    pub const GetStringUTFChars: usize = 169;
    pub const ReleaseStringUTFChars: usize = 170;
};

/// Read function pointer at `index` in the JNI vtable.
fn vtableFn(env: JNIEnv, comptime index: usize, comptime FnType: type) FnType {
    const tbl: [*]const ?*const anyopaque = @ptrCast(@alignCast(env.?.*));
    const fp = tbl[index] orelse @panic("JNI vtable slot is null");
    return @ptrCast(@alignCast(fp));
}

pub fn getStringUTFChars(env: JNIEnv, s: jstring) ?[*:0]const u8 {
    const F = *const fn (JNIEnv, jstring, ?*jboolean) callconv(.c) ?[*:0]const u8;
    const f = vtableFn(env, slot.GetStringUTFChars, F);
    return f(env, s, null);
}

pub fn releaseStringUTFChars(env: JNIEnv, s: jstring, chars: ?[*:0]const u8) void {
    const F = *const fn (JNIEnv, jstring, ?[*:0]const u8) callconv(.c) void;
    const f = vtableFn(env, slot.ReleaseStringUTFChars, F);
    f(env, s, chars);
}

pub fn newStringUTF(env: JNIEnv, bytes: [*:0]const u8) jstring {
    const F = *const fn (JNIEnv, [*:0]const u8) callconv(.c) jstring;
    const f = vtableFn(env, slot.NewStringUTF, F);
    return f(env, bytes);
}

pub fn exceptionOccurred(env: JNIEnv) jthrowable {
    const F = *const fn (JNIEnv) callconv(.c) jthrowable;
    const f = vtableFn(env, slot.ExceptionOccurred, F);
    return f(env);
}

pub fn exceptionClear(env: JNIEnv) void {
    const F = *const fn (JNIEnv) callconv(.c) void;
    const f = vtableFn(env, slot.ExceptionClear, F);
    f(env);
}

pub fn deleteLocalRef(env: JNIEnv, obj: jobject) void {
    const F = *const fn (JNIEnv, jobject) callconv(.c) void;
    const f = vtableFn(env, slot.DeleteLocalRef, F);
    f(env, obj);
}

/// Fetches a Zig-owned UTF-8 copy of the jstring. Releases the JNI
/// borrowed buffer immediately.
pub fn jstringToOwned(env: JNIEnv, allocator: std.mem.Allocator, s: jstring) !?[]u8 {
    if (s == null) return null;
    const ptr = getStringUTFChars(env, s) orelse return null;
    defer releaseStringUTFChars(env, s, ptr);
    const slice = std.mem.span(ptr);
    return try allocator.dupe(u8, slice);
}
