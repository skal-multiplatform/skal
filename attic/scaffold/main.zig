//! CLI entry — host build only. Reads a JS file and evaluates it through
//! the runtime. Useful as a smoke test of the build pipeline + web API
//! bindings without involving Android/JNI.

const std = @import("std");
const skal = @import("skal");

const help_text =
    \\skal — embeddable JS runtime (host smoke-test build)
    \\
    \\usage: skal <script.js>
    \\       skal -e '<inline source>'
    \\       skal -                (read from stdin)
    \\
;

pub fn main(init: std.process.Init.Minimal) !void {
    var gpa: std.heap.DebugAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var iter = try std.process.Args.Iterator.initAllocator(init.args, allocator);
    defer iter.deinit();

    const stderr: std.c.fd_t = std.c.STDERR_FILENO;
    const stdout: std.c.fd_t = std.c.STDOUT_FILENO;

    _ = iter.next(); // program name
    const first = iter.next() orelse {
        _ = std.c.write(stderr, help_text.ptr, help_text.len);
        return;
    };

    var url_buf: [256]u8 = undefined;
    var source: []u8 = undefined;
    var url: []const u8 = undefined;
    var owns_source = false;

    if (std.mem.eql(u8, first, "-e")) {
        const inline_src = iter.next() orelse {
            const m = "skal: -e requires a string argument\n";
            _ = std.c.write(stderr, m.ptr, m.len);
            std.process.exit(1);
        };
        source = try allocator.dupe(u8, inline_src);
        owns_source = true;
        url = "inline";
    } else if (std.mem.eql(u8, first, "-")) {
        source = try readAllFd(allocator, std.c.STDIN_FILENO);
        owns_source = true;
        url = "stdin";
    } else {
        const path = try allocator.dupe(u8, first);
        defer allocator.free(path);
        source = try readAllPath(allocator, path);
        owns_source = true;
        url = std.fmt.bufPrint(&url_buf, "{s}", .{path}) catch path;
    }
    defer if (owns_source) allocator.free(source);

    var rt = try skal.Runtime.init(allocator);
    defer rt.deinit();

    const result = rt.runScript(source, url) catch |e| {
        var msg_buf: [128]u8 = undefined;
        const msg = std.fmt.bufPrint(&msg_buf, "skal: eval failed: {s}\n", .{@errorName(e)}) catch "skal: eval failed\n";
        _ = std.c.write(stderr, msg.ptr, msg.len);
        std.process.exit(1);
    };

    rt.runEventLoop();

    var arena = std.heap.ArenaAllocator.init(allocator);
    defer arena.deinit();
    const s = result.toString(arena.allocator()) catch "?";
    _ = std.c.write(stdout, s.ptr, s.len);
    _ = std.c.write(stdout, "\n", 1);
}

fn readAllPath(allocator: std.mem.Allocator, path: []const u8) ![]u8 {
    const c_path = try allocator.dupeZ(u8, path);
    defer allocator.free(c_path);
    const fd = std.c.open(c_path.ptr, .{ .ACCMODE = .RDONLY });
    if (fd < 0) return error.OpenFailed;
    defer _ = std.c.close(fd);
    return readAllFd(allocator, fd);
}

fn readAllFd(allocator: std.mem.Allocator, fd: std.c.fd_t) ![]u8 {
    var buf: std.ArrayListUnmanaged(u8) = .empty;
    defer buf.deinit(allocator);
    var tmp: [4096]u8 = undefined;
    while (true) {
        const n = std.c.read(fd, &tmp, tmp.len);
        if (n == 0) break;
        if (n < 0) return error.ReadFailed;
        try buf.appendSlice(allocator, tmp[0..@as(usize, @intCast(n))]);
    }
    return buf.toOwnedSlice(allocator);
}
