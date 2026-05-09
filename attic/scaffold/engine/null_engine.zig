//! Zig-only stub engine. Implements the engine vtable so the rest of the
//! runtime + JNI bridge can be built and tested without a working JSC.
//! Cannot actually evaluate JS — `eval()` returns a string Value containing
//! the source unchanged so smoke tests can verify the round-trip.

const std = @import("std");
const engine = @import("engine.zig");

const Engine = engine.Engine;
const Context = engine.Context;
const Value = engine.Value;
const Error = engine.Error;

const StringBox = struct {
    buf: []u8,
    is_undefined: bool,
};

const Impl = struct {
    allocator: std.mem.Allocator,
    boxes: std.ArrayListUnmanaged(*StringBox),
};

pub fn init(allocator: std.mem.Allocator) !Engine {
    const impl = try allocator.create(Impl);
    impl.* = .{ .allocator = allocator, .boxes = .empty };
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

fn box_of(p: ?*anyopaque) *StringBox {
    return @ptrCast(@alignCast(p.?));
}

fn engineDeinit(e: *Engine) void {
    const i = impl_of(e);
    for (i.boxes.items) |b| {
        i.allocator.free(b.buf);
        i.allocator.destroy(b);
    }
    i.boxes.deinit(i.allocator);
    i.allocator.destroy(i);
}

fn contextCreate(e: *Engine) Error!Context {
    return .{ .engine = e, .impl = null };
}

fn contextDeinit(ctx: *Context) void {
    _ = ctx;
}

fn newBox(i: *Impl, ctx: *Context, contents: []const u8, undef: bool) Error!Value {
    const buf = i.allocator.dupe(u8, contents) catch return Error.OutOfMemory;
    const box = i.allocator.create(StringBox) catch {
        i.allocator.free(buf);
        return Error.OutOfMemory;
    };
    box.* = .{ .buf = buf, .is_undefined = undef };
    i.boxes.append(i.allocator, box) catch {
        i.allocator.free(buf);
        i.allocator.destroy(box);
        return Error.OutOfMemory;
    };
    return .{ .handle = box, .ctx = ctx };
}

fn eval(ctx: *Context, source: []const u8, url: ?[]const u8) Error!Value {
    _ = url;
    const i = impl_of(ctx.engine);
    return newBox(i, ctx, source, false);
}

fn registerFunction(ctx: *Context, name: []const u8, func: engine.HostFunction, user_data: ?*anyopaque) Error!void {
    _ = ctx;
    _ = name;
    _ = func;
    _ = user_data;
    // Null engine does not run JS, so registration is a no-op.
}

fn globalThis(ctx: *Context) Value {
    return .{ .handle = null, .ctx = ctx };
}

fn valueIsUndefined(ctx: *Context, val: Value) bool {
    _ = ctx;
    if (val.handle == null) return true;
    return box_of(val.handle).is_undefined;
}

fn valueToString(ctx: *Context, val: Value, allocator: std.mem.Allocator) Error![]u8 {
    _ = ctx;
    if (val.handle == null) return allocator.dupe(u8, "undefined") catch Error.OutOfMemory;
    const b = box_of(val.handle);
    return allocator.dupe(u8, b.buf) catch Error.OutOfMemory;
}
