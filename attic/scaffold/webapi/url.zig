//! URL / URLSearchParams
//!
//! Bun uses Ada (https://github.com/ada-url/ada) for WHATWG URL parsing.
//! Reference impls:
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/jsc/URL.zig
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/jsc/URLSearchParams.zig
//!
//! Plan: vendor Ada (it's a single C++ amalgamation, builds cleanly under
//! NDK), expose its parse/serialize through host fns. Until then this
//! shipping a stub bind() is fine — JS code that imports URL will throw
//! ReferenceError and the user can polyfill or skip.

const std = @import("std");
const engine = @import("../engine/engine.zig");

pub fn bind(ctx: *engine.Context) !void {
    _ = ctx;
    // TODO: wire Ada-backed URL/URLSearchParams.
}
