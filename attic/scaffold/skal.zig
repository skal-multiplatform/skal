//! Skal — embeddable JS runtime with web API compatibility, targeting Android.
//!
//! Public surface re-exported from this module. A consumer (CLI, JNI shim,
//! or downstream Zig code) should import `skal` and use these types.

const std = @import("std");

pub const env = @import("env.zig");
pub const log = @import("platform/log.zig");

pub const engine = @import("engine/engine.zig");
pub const Engine = engine.Engine;
pub const JsContext = engine.Context;
pub const JsValue = engine.Value;

pub const Runtime = @import("runtime/Runtime.zig");
pub const EventLoop = @import("runtime/event_loop.zig").EventLoop;

pub const webapi = struct {
    pub const console = @import("webapi/console.zig");
    pub const timers = @import("webapi/timers.zig");
    pub const text_encoding = @import("webapi/text_encoding.zig");
    pub const url = @import("webapi/url.zig");
    pub const fetch = @import("webapi/fetch.zig");
    pub const crypto = @import("webapi/crypto.zig");
};

// Pull in the JNI entry-point file so the `comptime` block inside
// (which conditionally `@export`s JNI symbols when targeting Android)
// is actually evaluated. On non-Android builds the exports are gated
// off and become dead-code-eliminated.
comptime {
    _ = @import("jni/entry.zig");
}

test {
    std.testing.refAllDecls(@This());
}
