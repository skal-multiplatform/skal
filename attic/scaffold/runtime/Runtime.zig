//! Runtime — composes engine + event loop + registered web APIs.
//!
//! A Runtime owns one Engine and one Context. The web APIs are bound on
//! `init()`. Consumers call `evaluate()` or `runScript()` to execute JS,
//! then `runEventLoop()` to drain pending microtasks/timers. The JNI
//! bridge owns one Runtime per Java handle.

const std = @import("std");
const engine_mod = @import("../engine/engine.zig");
const EventLoop = @import("event_loop.zig").EventLoop;
const console = @import("../webapi/console.zig");
const timers = @import("../webapi/timers.zig");
const text_encoding = @import("../webapi/text_encoding.zig");
const url_api = @import("../webapi/url.zig");
const fetch_api = @import("../webapi/fetch.zig");
const crypto_api = @import("../webapi/crypto.zig");

const Runtime = @This();

allocator: std.mem.Allocator,
engine: engine_mod.Engine,
context: engine_mod.Context,
loop: EventLoop,

pub fn init(allocator: std.mem.Allocator) !*Runtime {
    const self = try allocator.create(Runtime);
    errdefer allocator.destroy(self);

    self.* = .{
        .allocator = allocator,
        .engine = try engine_mod.Engine.init(allocator),
        .context = undefined,
        .loop = EventLoop.init(allocator),
    };
    self.context = try self.engine.createContext();

    try self.bindWebApis();
    return self;
}

pub fn deinit(self: *Runtime) void {
    self.context.deinit();
    self.engine.deinit();
    self.loop.deinit();
    const allocator = self.allocator;
    allocator.destroy(self);
}

fn bindWebApis(self: *Runtime) !void {
    try console.bind(&self.context);
    try timers.bind(&self.context, &self.loop);
    try text_encoding.bind(&self.context);
    try url_api.bind(&self.context);
    try fetch_api.bind(&self.context, &self.loop);
    try crypto_api.bind(&self.context);
}

pub fn evaluate(self: *Runtime, source: []const u8, url: ?[]const u8) !engine_mod.Value {
    return self.context.evaluate(source, url);
}

/// Convenience: evaluate, drain microtasks, then run the loop until idle.
pub fn runScript(self: *Runtime, source: []const u8, url: ?[]const u8) !engine_mod.Value {
    const result = try self.evaluate(source, url);
    self.loop.drainMicrotasks();
    return result;
}

pub fn runEventLoop(self: *Runtime) void {
    self.loop.run();
}
