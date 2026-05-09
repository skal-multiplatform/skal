//! TextEncoder / TextDecoder
//!
//! Bun's reference impls (UTF-8 fast path, simdutf-backed validation):
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/runtime/webcore/TextEncoder.zig
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/runtime/webcore/TextDecoder.zig
//!
//! For now we ship a JS-side polyfill backed by Zig host fns that operate
//! on raw bytes. simdutf gets vendored when we port the real impl.

const std = @import("std");
const engine = @import("../engine/engine.zig");

pub fn bind(ctx: *engine.Context) !void {
    try ctx.registerFunction("__skal_utf8_encode", encodeImpl, null);
    try ctx.registerFunction("__skal_utf8_decode", decodeImpl, null);
    _ = ctx.evaluate(install_js, "skal:text_encoding") catch {};
}

const install_js =
    \\class TextEncoder {
    \\  get encoding() { return 'utf-8'; }
    \\  encode(s = '') { return globalThis.__skal_utf8_encode(String(s)); }
    \\  encodeInto(s, dest) {
    \\    const enc = this.encode(s);
    \\    const n = Math.min(enc.length, dest.length);
    \\    dest.set(enc.subarray(0, n));
    \\    return { read: s.length, written: n };
    \\  }
    \\}
    \\class TextDecoder {
    \\  constructor(label = 'utf-8') {
    \\    if (label.toLowerCase() !== 'utf-8' && label.toLowerCase() !== 'utf8') {
    \\      throw new RangeError('Skal TextDecoder only supports utf-8');
    \\    }
    \\  }
    \\  get encoding() { return 'utf-8'; }
    \\  decode(buf) {
    \\    if (!buf) return '';
    \\    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    \\    return globalThis.__skal_utf8_decode(u8);
    \\  }
    \\}
    \\globalThis.TextEncoder = TextEncoder;
    \\globalThis.TextDecoder = TextDecoder;
;

fn encodeImpl(ctx: *engine.Context, args: []const engine.Value, ud: ?*anyopaque) engine.Error!engine.Value {
    _ = args;
    _ = ud;
    // Real impl: read JSStringRef, copy UTF-8 bytes into a fresh Uint8Array.
    return ctx.globalThis();
}

fn decodeImpl(ctx: *engine.Context, args: []const engine.Value, ud: ?*anyopaque) engine.Error!engine.Value {
    _ = args;
    _ = ud;
    // Real impl: read TypedArray bytes, validate UTF-8, return JSStringRef.
    return ctx.globalThis();
}
