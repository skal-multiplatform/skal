//! Cross-platform logging.
//!
//! On Android, routes to logcat via __android_log_print (NDK liblog).
//! On host, writes to stderr.
//!
//! Uses the Android NDK <android/log.h> ABI directly; the function is
//! provided by liblog (linked via -llog in build.zig when targeting Android).

const std = @import("std");
const env = @import("../env.zig");

pub const Level = enum(c_int) {
    debug = 3,
    info = 4,
    warn = 5,
    err = 6,
    fatal = 7,
};

const default_tag = "Skal";

extern "log" fn __android_log_write(prio: c_int, tag: [*:0]const u8, text: [*:0]const u8) c_int;

pub fn write(level: Level, tag: ?[*:0]const u8, msg: []const u8) void {
    if (comptime env.is_android) {
        var buf: [4096]u8 = undefined;
        const trimmed = if (msg.len >= buf.len) msg[0 .. buf.len - 1] else msg;
        @memcpy(buf[0..trimmed.len], trimmed);
        buf[trimmed.len] = 0;
        const t: [*:0]const u8 = tag orelse default_tag;
        _ = __android_log_write(@intFromEnum(level), t, @ptrCast(&buf));
    } else {
        const prefix = switch (level) {
            .debug => "[D]",
            .info => "[I]",
            .warn => "[W]",
            .err => "[E]",
            .fatal => "[F]",
        };
        const t: []const u8 = if (tag) |x| std.mem.span(x) else default_tag;
        var line_buf: [4224]u8 = undefined;
        const line = std.fmt.bufPrint(&line_buf, "{s} {s}: {s}\n", .{ prefix, t, msg }) catch return;
        _ = std.c.write(std.c.STDERR_FILENO, line.ptr, line.len);
    }
}

pub fn writef(level: Level, comptime fmt: []const u8, args: anytype) void {
    var buf: [4096]u8 = undefined;
    const formatted = std.fmt.bufPrint(&buf, fmt, args) catch buf[0..buf.len];
    write(level, null, formatted);
}

pub fn info(comptime fmt: []const u8, args: anytype) void {
    writef(.info, fmt, args);
}

pub fn warn(comptime fmt: []const u8, args: anytype) void {
    writef(.warn, fmt, args);
}

pub fn err(comptime fmt: []const u8, args: anytype) void {
    writef(.err, fmt, args);
}
