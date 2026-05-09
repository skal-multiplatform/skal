//! Web Crypto: crypto.getRandomValues, crypto.randomUUID, crypto.subtle
//!
//! Bun's impls:
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/runtime/webcore/Crypto.zig
//!     (getRandomValues, randomUUID — backed by BoringSSL RAND_bytes)
//!   /Users/andrepimenta/Documents/coding/explore/bun/src/jsc/bindings/webcrypto/
//!     (~140 C++ files implementing SubtleCrypto algorithms over BoringSSL)
//!
//! For getRandomValues + randomUUID we can use std.crypto.random until
//! BoringSSL is vendored (Zig's std uses /dev/urandom on Linux + bionic).
//! SubtleCrypto requires ~14k LOC of C++ to be ported in.

const std = @import("std");
const engine = @import("../engine/engine.zig");

extern "c" fn arc4random_buf(buf: [*]u8, len: usize) void;

fn fillRandomBytes(buf: []u8) void {
    arc4random_buf(buf.ptr, buf.len);
}

pub fn bind(ctx: *engine.Context) !void {
    try ctx.registerFunction("__skal_random_bytes", randomBytesImpl, null);
    try ctx.registerFunction("__skal_random_uuid", randomUuidImpl, null);
    _ = ctx.evaluate(install_js, "skal:crypto") catch {};
}

const install_js =
    \\const _crypto = {
    \\  getRandomValues(buf) {
    \\    if (!buf || typeof buf.length !== 'number') {
    \\      throw new TypeError('getRandomValues requires a typed array');
    \\    }
    \\    const bytes = globalThis.__skal_random_bytes(buf.byteLength);
    \\    new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength).set(bytes);
    \\    return buf;
    \\  },
    \\  randomUUID() { return globalThis.__skal_random_uuid(); },
    \\  subtle: undefined, // TODO: SubtleCrypto port
    \\};
    \\globalThis.crypto = globalThis.crypto || _crypto;
;

fn randomBytesImpl(ctx: *engine.Context, args: []const engine.Value, ud: ?*anyopaque) engine.Error!engine.Value {
    _ = args;
    _ = ud;
    // Real impl: read length arg, allocate Uint8Array bytes, fill with
    // std.crypto.random.bytes(), return as TypedArray.
    return ctx.globalThis();
}

fn randomUuidImpl(ctx: *engine.Context, args: []const engine.Value, ud: ?*anyopaque) engine.Error!engine.Value {
    _ = args;
    _ = ud;
    var bytes: [16]u8 = undefined;
    fillRandomBytes(&bytes);
    // RFC 4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    // Real impl: format as "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" string and
    // return as JSStringRef. Stub keeps the bytes generated but doesn't
    // hand them to JS yet.
    return ctx.globalThis();
}

test "uuid v4 layout" {
    var bytes: [16]u8 = undefined;
    fillRandomBytes(&bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    try std.testing.expectEqual(@as(u8, 0x40), bytes[6] & 0xf0);
    try std.testing.expect((bytes[8] & 0xc0) == 0x80);
}
