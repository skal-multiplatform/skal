//! setTimeout / setInterval / clearTimeout / clearInterval / queueMicrotask
//!
//! Wires JS-side timer calls to the EventLoop. Bun's reference impl:
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/runtime/timer/TimeoutObject.zig
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/runtime/timer/Timer.zig
//! When we port it in, we'll keep the same JS callback storage pattern
//! (protect JSValueRef, fire on EventLoop tick, unprotect on clear).

const std = @import("std");
const engine = @import("../engine/engine.zig");
const EventLoop = @import("../runtime/event_loop.zig").EventLoop;

const State = struct {
    loop: *EventLoop,
};

var state: State = undefined;

pub fn bind(ctx: *engine.Context, loop: *EventLoop) !void {
    state = .{ .loop = loop };
    try ctx.registerFunction("__skal_setTimeout", setTimeoutImpl, &state);
    try ctx.registerFunction("__skal_setInterval", setIntervalImpl, &state);
    try ctx.registerFunction("__skal_clearTimer", clearTimerImpl, &state);
    try ctx.registerFunction("__skal_queueMicrotask", queueMicrotaskImpl, &state);

    _ = ctx.evaluate(install_js, "skal:timers") catch {};
}

const install_js =
    \\globalThis.setTimeout = (cb, ms, ...args) =>
    \\  globalThis.__skal_setTimeout(() => cb(...args), ms || 0);
    \\globalThis.setInterval = (cb, ms, ...args) =>
    \\  globalThis.__skal_setInterval(() => cb(...args), ms || 0);
    \\globalThis.clearTimeout = (id) => globalThis.__skal_clearTimer(id);
    \\globalThis.clearInterval = (id) => globalThis.__skal_clearTimer(id);
    \\globalThis.setImmediate = (cb, ...args) =>
    \\  globalThis.__skal_setTimeout(() => cb(...args), 0);
    \\globalThis.queueMicrotask = (cb) => globalThis.__skal_queueMicrotask(cb);
;

// Stub host fns: real impls require JSValueRef-backed callbacks (protected
// across yields). Tracked alongside the JSC adapter port.

fn setTimeoutImpl(ctx: *engine.Context, args: []const engine.Value, ud: ?*anyopaque) engine.Error!engine.Value {
    _ = args;
    _ = ud;
    return ctx.globalThis();
}

fn setIntervalImpl(ctx: *engine.Context, args: []const engine.Value, ud: ?*anyopaque) engine.Error!engine.Value {
    _ = args;
    _ = ud;
    return ctx.globalThis();
}

fn clearTimerImpl(ctx: *engine.Context, args: []const engine.Value, ud: ?*anyopaque) engine.Error!engine.Value {
    _ = args;
    _ = ud;
    return ctx.globalThis();
}

fn queueMicrotaskImpl(ctx: *engine.Context, args: []const engine.Value, ud: ?*anyopaque) engine.Error!engine.Value {
    _ = args;
    _ = ud;
    return ctx.globalThis();
}
