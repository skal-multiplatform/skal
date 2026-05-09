//! Pluggable JS engine interface.
//!
//! Skal targets JavaScriptCore (mirroring bun's choice), but the engine is
//! pluggable so the rest of the runtime — event loop, web APIs, JNI bridge —
//! can be developed and unit-tested without a working JSC build for every
//! target. Two implementations exist:
//!
//!   - `null`: a Zig-only stub that satisfies the interface but cannot
//!     actually evaluate JS. Used to verify the build pipeline.
//!   - `jsc`:  binds to JavaScriptCore's public C API. See engine/jsc.zig.
//!
//! We use the JSC C API rather than reaching into WebKit's C++ internals
//! (as bun does). Trade-off: we can't drive bun's C++ webcore bindings
//! directly, but we get a stable ABI that ships with any WebKit/JSC build.
//! Web API impls live in `webapi/*` and talk to the engine through this
//! interface.

const std = @import("std");
const env = @import("../env.zig");

pub const Error = error{
    EngineUnavailable,
    EvalFailed,
    OutOfMemory,
    InvalidArgument,
};

pub const Value = struct {
    handle: ?*anyopaque,
    ctx: *Context,

    pub fn isUndefined(self: Value) bool {
        return self.ctx.engine.vtable.value_is_undefined(self.ctx, self);
    }
    pub fn toString(self: Value, allocator: std.mem.Allocator) ![]u8 {
        return self.ctx.engine.vtable.value_to_string(self.ctx, self, allocator);
    }
};

pub const HostFunction = *const fn (ctx: *Context, args: []const Value, user_data: ?*anyopaque) Error!Value;

pub const Context = struct {
    engine: *Engine,
    impl: ?*anyopaque,

    pub fn evaluate(self: *Context, source: []const u8, url: ?[]const u8) !Value {
        return self.engine.vtable.eval(self, source, url);
    }

    pub fn registerFunction(
        self: *Context,
        name: []const u8,
        func: HostFunction,
        user_data: ?*anyopaque,
    ) !void {
        return self.engine.vtable.register_function(self, name, func, user_data);
    }

    pub fn globalThis(self: *Context) Value {
        return self.engine.vtable.global_this(self);
    }

    pub fn deinit(self: *Context) void {
        self.engine.vtable.context_deinit(self);
    }
};

pub const VTable = struct {
    deinit: *const fn (engine: *Engine) void,

    context_create: *const fn (engine: *Engine) Error!Context,
    context_deinit: *const fn (ctx: *Context) void,

    eval: *const fn (ctx: *Context, source: []const u8, url: ?[]const u8) Error!Value,
    register_function: *const fn (
        ctx: *Context,
        name: []const u8,
        func: HostFunction,
        user_data: ?*anyopaque,
    ) Error!void,

    global_this: *const fn (ctx: *Context) Value,

    value_is_undefined: *const fn (ctx: *Context, val: Value) bool,
    value_to_string: *const fn (ctx: *Context, val: Value, allocator: std.mem.Allocator) Error![]u8,
};

pub const Engine = struct {
    vtable: *const VTable,
    impl: ?*anyopaque,
    allocator: std.mem.Allocator,

    pub fn init(allocator: std.mem.Allocator) !Engine {
        return switch (env.engine) {
            .@"null" => @import("null_engine.zig").init(allocator),
            .jsc => @import("jsc.zig").init(allocator),
        };
    }

    pub fn deinit(self: *Engine) void {
        self.vtable.deinit(self);
    }

    pub fn createContext(self: *Engine) !Context {
        return self.vtable.context_create(self);
    }
};
