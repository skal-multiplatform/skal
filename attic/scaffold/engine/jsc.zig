//! JavaScriptCore C API bindings + adapter to engine.zig vtable.
//!
//! Bound against WebKit's public C API:
//!   - <JavaScriptCore/JSContextRef.h>
//!   - <JavaScriptCore/JSStringRef.h>
//!   - <JavaScriptCore/JSValueRef.h>
//!   - <JavaScriptCore/JSObjectRef.h>
//!
//! These are stable across WebKit versions and ship in any WebKit/JSC
//! build. We use the C API rather than reaching into WebKit's C++
//! internals (as bun does) so the binding stays stable across WebKit
//! versions and works against any JSC build, including future ports.

const std = @import("std");
const engine = @import("engine.zig");

// ---------- JSC C API: opaque types ----------
pub const JSContextGroupRef = *opaque {};
pub const JSContextRef = *opaque {};
pub const JSGlobalContextRef = *opaque {};
pub const JSStringRef = *opaque {};
pub const JSClassRef = *opaque {};
pub const JSValueRef = *opaque {};
pub const JSObjectRef = *opaque {};

pub const JSType = enum(c_uint) {
    undefined = 0,
    null = 1,
    boolean = 2,
    number = 3,
    string = 4,
    object = 5,
    symbol = 6,
    big_int = 7,
};

pub const JSPropertyAttributes_None: c_uint = 0;
pub const JSPropertyAttributes_ReadOnly: c_uint = 1 << 1;
pub const JSPropertyAttributes_DontEnum: c_uint = 1 << 2;
pub const JSPropertyAttributes_DontDelete: c_uint = 1 << 3;

// ---------- JSC C API: extern functions ----------

pub extern fn JSContextGroupCreate() JSContextGroupRef;
pub extern fn JSContextGroupRelease(group: JSContextGroupRef) void;
pub extern fn JSGlobalContextCreateInGroup(group: ?JSContextGroupRef, global_object_class: ?JSClassRef) JSGlobalContextRef;
pub extern fn JSGlobalContextRelease(ctx: JSGlobalContextRef) void;
pub extern fn JSContextGetGlobalObject(ctx: JSContextRef) JSObjectRef;

pub extern fn JSStringCreateWithUTF8CString(str: [*:0]const u8) JSStringRef;
pub extern fn JSStringRetain(str: JSStringRef) JSStringRef;
pub extern fn JSStringRelease(str: JSStringRef) void;
pub extern fn JSStringGetMaximumUTF8CStringSize(str: JSStringRef) usize;
pub extern fn JSStringGetUTF8CString(str: JSStringRef, buffer: [*]u8, buffer_size: usize) usize;
pub extern fn JSStringGetLength(str: JSStringRef) usize;

pub extern fn JSEvaluateScript(
    ctx: JSContextRef,
    script: JSStringRef,
    this_object: ?JSObjectRef,
    source_url: ?JSStringRef,
    starting_line_number: c_int,
    exception: ?*?JSValueRef,
) ?JSValueRef;

pub extern fn JSValueIsUndefined(ctx: JSContextRef, value: JSValueRef) bool;
pub extern fn JSValueIsNull(ctx: JSContextRef, value: JSValueRef) bool;
pub extern fn JSValueIsString(ctx: JSContextRef, value: JSValueRef) bool;
pub extern fn JSValueIsNumber(ctx: JSContextRef, value: JSValueRef) bool;
pub extern fn JSValueIsBoolean(ctx: JSContextRef, value: JSValueRef) bool;
pub extern fn JSValueGetType(ctx: JSContextRef, value: JSValueRef) JSType;
pub extern fn JSValueToStringCopy(ctx: JSContextRef, value: JSValueRef, exception: ?*?JSValueRef) ?JSStringRef;
pub extern fn JSValueProtect(ctx: JSContextRef, value: JSValueRef) void;
pub extern fn JSValueUnprotect(ctx: JSContextRef, value: JSValueRef) void;
pub extern fn JSValueMakeUndefined(ctx: JSContextRef) JSValueRef;

pub const JSObjectCallAsFunctionCallback = *const fn (
    ctx: JSContextRef,
    function: JSObjectRef,
    this_object: JSObjectRef,
    argument_count: usize,
    arguments: [*]const JSValueRef,
    exception: ?*?JSValueRef,
) callconv(.c) ?JSValueRef;

pub extern fn JSObjectMakeFunctionWithCallback(
    ctx: JSContextRef,
    name: ?JSStringRef,
    callback: JSObjectCallAsFunctionCallback,
) JSObjectRef;

pub extern fn JSObjectSetProperty(
    ctx: JSContextRef,
    object: JSObjectRef,
    property_name: JSStringRef,
    value: JSValueRef,
    attributes: c_uint,
    exception: ?*?JSValueRef,
) void;

pub extern fn JSObjectSetPrivate(object: JSObjectRef, data: ?*anyopaque) bool;
pub extern fn JSObjectGetPrivate(object: JSObjectRef) ?*anyopaque;

// ---------- engine.VTable adapter ----------

const Engine = engine.Engine;
const Context = engine.Context;
const Value = engine.Value;
const Error = engine.Error;

const Impl = struct {
    allocator: std.mem.Allocator,
    /// Multiple Skal Contexts share one JSC ContextGroup so values can move
    /// between them. For now we create a single group per Engine.
    group: JSContextGroupRef,
    /// Tracks every host function we've registered, keyed by the JSObjectRef
    /// callback wrapper. Used to bridge JSC's C callback signature to our
    /// engine.HostFunction signature with user_data.
    host_funcs: std.AutoHashMapUnmanaged(JSObjectRef, *HostBinding) = .empty,
};

const HostBinding = struct {
    func: engine.HostFunction,
    user_data: ?*anyopaque,
    ctx_ref: *Context,
};

/// One JSC global context per Skal Context.
const ContextImpl = struct {
    global: JSGlobalContextRef,
    /// Bindings owned by this context — freed when the context dies.
    bindings: std.ArrayListUnmanaged(*HostBinding) = .empty,
};

pub fn init(allocator: std.mem.Allocator) Error!Engine {
    const impl = allocator.create(Impl) catch return Error.OutOfMemory;
    impl.* = .{
        .allocator = allocator,
        .group = JSContextGroupCreate(),
    };
    return .{
        .vtable = &vtable,
        .impl = impl,
        .allocator = allocator,
    };
}

const vtable: engine.VTable = .{
    .deinit = engineDeinit,
    .context_create = contextCreate,
    .context_deinit = contextDeinit,
    .eval = eval,
    .register_function = registerFunction,
    .global_this = globalThis,
    .value_is_undefined = valueIsUndefined,
    .value_to_string = valueToString,
};

fn impl_of(e: *Engine) *Impl {
    return @ptrCast(@alignCast(e.impl.?));
}

fn ctx_of(c: *Context) *ContextImpl {
    return @ptrCast(@alignCast(c.impl.?));
}

fn engineDeinit(e: *Engine) void {
    const i = impl_of(e);
    i.host_funcs.deinit(i.allocator);
    JSContextGroupRelease(i.group);
    i.allocator.destroy(i);
}

fn contextCreate(e: *Engine) Error!Context {
    const i = impl_of(e);
    const c_impl = i.allocator.create(ContextImpl) catch return Error.OutOfMemory;
    c_impl.* = .{
        .global = JSGlobalContextCreateInGroup(i.group, null),
    };
    return .{ .engine = e, .impl = c_impl };
}

fn contextDeinit(ctx: *Context) void {
    const i = impl_of(ctx.engine);
    const c = ctx_of(ctx);
    for (c.bindings.items) |b| i.allocator.destroy(b);
    c.bindings.deinit(i.allocator);
    JSGlobalContextRelease(c.global);
    i.allocator.destroy(c);
}

/// JSC C-API callback that fans out to the Zig host fn via the binding map.
fn cCallback(
    js_ctx: JSContextRef,
    function: JSObjectRef,
    this_object: JSObjectRef,
    argument_count: usize,
    arguments: [*]const JSValueRef,
    exception: ?*?JSValueRef,
) callconv(.c) ?JSValueRef {
    _ = this_object;
    _ = exception;

    // Recover the engine's Impl via the JSC global context's user-data slot.
    // We stashed a pointer to ContextImpl when the function was registered.
    const private_ud = JSObjectGetPrivate(function) orelse {
        return JSValueMakeUndefined(js_ctx);
    };
    const binding: *HostBinding = @ptrCast(@alignCast(private_ud));

    // Allocate a temporary slice of engine.Value for the host fn.
    const ctx = binding.ctx_ref;
    const i = impl_of(ctx.engine);
    const vals = i.allocator.alloc(Value, argument_count) catch return JSValueMakeUndefined(js_ctx);
    defer i.allocator.free(vals);
    for (vals, 0..) |*v, k| v.* = .{ .handle = @ptrCast(@constCast(arguments[k])), .ctx = ctx };

    const result = binding.func(ctx, vals, binding.user_data) catch {
        return JSValueMakeUndefined(js_ctx);
    };
    return @ptrCast(result.handle);
}

fn registerFunction(
    ctx: *Context,
    name: []const u8,
    func: engine.HostFunction,
    user_data: ?*anyopaque,
) Error!void {
    const i = impl_of(ctx.engine);
    const c = ctx_of(ctx);

    // Z-terminate the name for JSStringCreateWithUTF8CString.
    const name_z = i.allocator.dupeZ(u8, name) catch return Error.OutOfMemory;
    defer i.allocator.free(name_z);

    const js_name = JSStringCreateWithUTF8CString(name_z.ptr);
    defer JSStringRelease(js_name);

    const fn_obj = JSObjectMakeFunctionWithCallback(@ptrCast(c.global), js_name, cCallback);

    // Stash a HostBinding on the function object's private data so cCallback
    // can recover it.
    const binding = i.allocator.create(HostBinding) catch return Error.OutOfMemory;
    binding.* = .{ .func = func, .user_data = user_data, .ctx_ref = ctx };
    _ = JSObjectSetPrivate(fn_obj, binding);
    c.bindings.append(i.allocator, binding) catch return Error.OutOfMemory;

    // Attach the function as a property on globalThis.
    const global = JSContextGetGlobalObject(@ptrCast(c.global));
    JSObjectSetProperty(@ptrCast(c.global), global, js_name, @ptrCast(fn_obj), JSPropertyAttributes_DontEnum, null);
}

fn eval(ctx: *Context, source: []const u8, url: ?[]const u8) Error!Value {
    const i = impl_of(ctx.engine);
    const c = ctx_of(ctx);

    const src_z = i.allocator.dupeZ(u8, source) catch return Error.OutOfMemory;
    defer i.allocator.free(src_z);
    const js_src = JSStringCreateWithUTF8CString(src_z.ptr);
    defer JSStringRelease(js_src);

    var js_url: ?JSStringRef = null;
    if (url) |u| {
        const u_z = i.allocator.dupeZ(u8, u) catch return Error.OutOfMemory;
        defer i.allocator.free(u_z);
        js_url = JSStringCreateWithUTF8CString(u_z.ptr);
    }
    defer if (js_url) |s| JSStringRelease(s);

    var exception: ?JSValueRef = null;
    const result = JSEvaluateScript(@ptrCast(c.global), js_src, null, js_url, 1, &exception);
    if (result == null or exception != null) return Error.EvalFailed;
    return .{ .handle = @ptrCast(@constCast(result.?)), .ctx = ctx };
}

fn globalThis(ctx: *Context) Value {
    const c = ctx_of(ctx);
    const obj = JSContextGetGlobalObject(@ptrCast(c.global));
    return .{ .handle = @ptrCast(obj), .ctx = ctx };
}

fn valueIsUndefined(ctx: *Context, val: Value) bool {
    const c = ctx_of(ctx);
    if (val.handle == null) return true;
    return JSValueIsUndefined(@ptrCast(c.global), @ptrCast(val.handle.?));
}

fn valueToString(ctx: *Context, val: Value, allocator: std.mem.Allocator) Error![]u8 {
    const c = ctx_of(ctx);
    if (val.handle == null) return allocator.dupe(u8, "undefined") catch Error.OutOfMemory;

    const js_str = JSValueToStringCopy(@ptrCast(c.global), @ptrCast(val.handle.?), null) orelse {
        return Error.EvalFailed;
    };
    defer JSStringRelease(js_str);

    const max = JSStringGetMaximumUTF8CStringSize(js_str);
    const buf = allocator.alloc(u8, max) catch return Error.OutOfMemory;
    const n = JSStringGetUTF8CString(js_str, buf.ptr, buf.len);
    // n includes the trailing NUL — strip it.
    const len = if (n > 0) n - 1 else 0;
    if (len < buf.len) {
        return allocator.realloc(buf, len) catch buf[0..len];
    }
    return buf[0..len];
}
