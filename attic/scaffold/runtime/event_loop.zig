//! Minimal microtask + timer event loop.
//!
//! This is the placeholder loop. Bun's real event loop lives in
//! /Users/andrepimenta/Documents/coding/explore/bun/src/jsc/event_loop.zig
//! and /Users/andrepimenta/Documents/coding/explore/bun/src/event_loop/*
//! and uses kqueue/epoll for I/O. For Android we'd port the epoll path
//! (bionic supports epoll). For now this loop only knows about timers
//! and microtasks queued from JS — enough to verify the JNI/engine wiring.

const std = @import("std");

const Timespec = extern struct {
    sec: c_long,
    nsec: c_long,
};
const CLOCK_MONOTONIC: c_int = 6;
extern "c" fn clock_gettime(clk: c_int, ts: *Timespec) c_int;
extern "c" fn nanosleep(req: *const Timespec, rem: ?*Timespec) c_int;

fn nowMs() i64 {
    var ts: Timespec = undefined;
    _ = clock_gettime(CLOCK_MONOTONIC, &ts);
    return @as(i64, ts.sec) * 1000 + @divFloor(@as(i64, ts.nsec), 1_000_000);
}

fn sleepMs(ms: i64) void {
    if (ms <= 0) return;
    const sec = @divFloor(ms, 1000);
    const nsec = (ms - sec * 1000) * 1_000_000;
    const req: Timespec = .{ .sec = @intCast(sec), .nsec = @intCast(nsec) };
    _ = nanosleep(&req, null);
}

pub const Microtask = struct {
    callback: *const fn (user_data: ?*anyopaque) void,
    user_data: ?*anyopaque,
};

pub const Timer = struct {
    id: u32,
    deadline_ms: i64,
    interval_ms: ?i64,
    callback: *const fn (user_data: ?*anyopaque) void,
    user_data: ?*anyopaque,
};

pub const EventLoop = struct {
    allocator: std.mem.Allocator,
    microtasks: std.ArrayListUnmanaged(Microtask),
    timers: std.ArrayListUnmanaged(Timer),
    next_timer_id: u32,
    running: bool,

    pub fn init(allocator: std.mem.Allocator) EventLoop {
        return .{
            .allocator = allocator,
            .microtasks = .empty,
            .timers = .empty,
            .next_timer_id = 1,
            .running = false,
        };
    }

    pub fn deinit(self: *EventLoop) void {
        self.microtasks.deinit(self.allocator);
        self.timers.deinit(self.allocator);
    }

    pub fn enqueueMicrotask(self: *EventLoop, mt: Microtask) !void {
        try self.microtasks.append(self.allocator, mt);
    }

    pub fn setTimeout(
        self: *EventLoop,
        delay_ms: i64,
        callback: *const fn (?*anyopaque) void,
        user_data: ?*anyopaque,
    ) !u32 {
        return self.scheduleTimer(delay_ms, null, callback, user_data);
    }

    pub fn setInterval(
        self: *EventLoop,
        interval_ms: i64,
        callback: *const fn (?*anyopaque) void,
        user_data: ?*anyopaque,
    ) !u32 {
        return self.scheduleTimer(interval_ms, interval_ms, callback, user_data);
    }

    fn scheduleTimer(
        self: *EventLoop,
        delay_ms: i64,
        interval_ms: ?i64,
        callback: *const fn (?*anyopaque) void,
        user_data: ?*anyopaque,
    ) !u32 {
        const id = self.next_timer_id;
        self.next_timer_id +%= 1;
        try self.timers.append(self.allocator, .{
            .id = id,
            .deadline_ms = nowMs() + delay_ms,
            .interval_ms = interval_ms,
            .callback = callback,
            .user_data = user_data,
        });
        return id;
    }

    pub fn clearTimer(self: *EventLoop, id: u32) void {
        var i: usize = 0;
        while (i < self.timers.items.len) {
            if (self.timers.items[i].id == id) {
                _ = self.timers.swapRemove(i);
                return;
            }
            i += 1;
        }
    }

    /// Drain microtasks until none remain. Microtasks may queue more
    /// microtasks, all of which run before returning.
    pub fn drainMicrotasks(self: *EventLoop) void {
        while (self.microtasks.items.len > 0) {
            const mt = self.microtasks.orderedRemove(0);
            mt.callback(mt.user_data);
        }
    }

    /// Process timers whose deadline has passed. Returns the time-until-next
    /// remaining timer in ms, or null if none scheduled.
    pub fn tickTimers(self: *EventLoop) ?i64 {
        const now = nowMs();
        var i: usize = 0;
        while (i < self.timers.items.len) {
            var t = self.timers.items[i];
            if (t.deadline_ms <= now) {
                t.callback(t.user_data);
                if (t.interval_ms) |iv| {
                    self.timers.items[i].deadline_ms = now + iv;
                    i += 1;
                } else {
                    _ = self.timers.swapRemove(i);
                }
            } else {
                i += 1;
            }
        }
        var soonest: ?i64 = null;
        for (self.timers.items) |t| {
            const wait = t.deadline_ms - now;
            if (soonest == null or wait < soonest.?) soonest = wait;
        }
        return soonest;
    }

    pub fn hasWork(self: *const EventLoop) bool {
        return self.microtasks.items.len > 0 or self.timers.items.len > 0;
    }

    /// Pump the loop until idle. Sleeps between timer firings.
    pub fn run(self: *EventLoop) void {
        self.running = true;
        while (self.running and self.hasWork()) {
            self.drainMicrotasks();
            const next = self.tickTimers() orelse break;
            if (next > 0) sleepMs(next);
        }
        self.running = false;
    }

    pub fn stop(self: *EventLoop) void {
        self.running = false;
    }
};

test "microtasks drain in fifo order" {
    const Counter = struct {
        var n: u32 = 0;
        fn cb(_: ?*anyopaque) void {
            n +%= 1;
        }
    };
    var loop = EventLoop.init(std.testing.allocator);
    defer loop.deinit();
    try loop.enqueueMicrotask(.{ .callback = Counter.cb, .user_data = null });
    try loop.enqueueMicrotask(.{ .callback = Counter.cb, .user_data = null });
    loop.drainMicrotasks();
    try std.testing.expectEqual(@as(u32, 2), Counter.n);
}
