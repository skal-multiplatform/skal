//! console.{log,info,warn,error,debug,trace}
//!
//! Routes formatted output to the platform log (logcat on Android, stderr
//! elsewhere). Bun's full ConsoleObject lives at
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/jsc/ConsoleObject.zig
//! and includes inspect-style formatting (groups, tables, %c, etc.). When
//! we port it in we'll route its writeOutput sink through `platform/log.zig`
//! so the same formatting code works on Android.

const std = @import("std");
const engine = @import("../engine/engine.zig");
const log = @import("../platform/log.zig");

pub fn bind(ctx: *engine.Context) !void {
    try ctx.registerFunction("__skal_console_log", logImpl, @ptrFromInt(@intFromEnum(log.Level.info)));
    try ctx.registerFunction("__skal_console_info", logImpl, @ptrFromInt(@intFromEnum(log.Level.info)));
    try ctx.registerFunction("__skal_console_warn", logImpl, @ptrFromInt(@intFromEnum(log.Level.warn)));
    try ctx.registerFunction("__skal_console_error", logImpl, @ptrFromInt(@intFromEnum(log.Level.err)));
    try ctx.registerFunction("__skal_console_debug", logImpl, @ptrFromInt(@intFromEnum(log.Level.debug)));

    // Install JS-side console object that forwards to the host functions.
    // Once the JSC adapter is online this evaluate becomes the real wiring.
    _ = ctx.evaluate(install_js, "skal:console") catch {};
}

const install_js =
    \\globalThis.console = globalThis.console || {};
    \\const fwd = (level) => (...args) => {
    \\  const parts = args.map(a => {
    \\    if (typeof a === 'string') return a;
    \\    try { return JSON.stringify(a); } catch { return String(a); }
    \\  });
    \\  globalThis['__skal_console_' + level](parts.join(' '));
    \\};
    \\console.log = fwd('log');
    \\console.info = fwd('info');
    \\console.warn = fwd('warn');
    \\console.error = fwd('error');
    \\console.debug = fwd('debug');
    \\console.trace = fwd('log');
;

fn logImpl(ctx: *engine.Context, args: []const engine.Value, user_data: ?*anyopaque) engine.Error!engine.Value {
    const level: log.Level = @enumFromInt(@as(c_int, @intCast(@intFromPtr(user_data))));
    var arena = std.heap.ArenaAllocator.init(ctx.engine.allocator);
    defer arena.deinit();
    const a = arena.allocator();

    var buf: std.ArrayListUnmanaged(u8) = .empty;
    for (args, 0..) |arg, i| {
        if (i > 0) try buf.append(a, ' ');
        const s = arg.toString(a) catch "?";
        try buf.appendSlice(a, s);
    }
    log.write(level, null, buf.items);
    return ctx.globalThis(); // returns globalThis as a stand-in for `undefined`
}
