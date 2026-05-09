//! fetch / Request / Response / Headers / Blob / FormData / AbortSignal
//!
//! This is the largest web API by surface. Bun's reference impls live in
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/runtime/webcore/
//!     fetch.zig, Request.zig, Response.zig, Blob.zig, FormData.zig, ...
//! and route HTTP through the bundled BoringSSL + lshpack/lsquic stack.
//!
//! For Android we have two viable paths:
//!   1. Port bun's HTTP stack as-is (BoringSSL, c-ares, lshpack, lsquic).
//!      All of these have Android NDK build paths already configured in
//!      bun (see scripts/build/deps/*.ts). Most code-reuse, biggest binary.
//!   2. Bridge fetch() through Java's OkHttp via JNI. Smallest binary,
//!      reuses Android's TLS/network stack, but loses fetch-on-host parity.
//!
//! Decision: option 1 for parity. Stubbed until ported.

const std = @import("std");
const engine = @import("../engine/engine.zig");
const EventLoop = @import("../runtime/event_loop.zig").EventLoop;

pub fn bind(ctx: *engine.Context, loop: *EventLoop) !void {
    _ = ctx;
    _ = loop;
    // TODO: port bun's webcore/fetch.zig + dependencies.
}
