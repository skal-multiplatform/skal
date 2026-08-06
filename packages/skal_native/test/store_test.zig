// ── Tests for the native store ─────────────────────────────────────
//
// Appended to the store region extracted from patches/skal_entry.zig by
// run.sh, so these run against the shipping source rather than a copy.
//
// This subsystem had no tests at all, and it is the one that actually
// runs on device — the kitchen-sink reports "Backend: native". Its JS
// twin gave up three bugs in one session, every one of them a silently
// WRONG read rather than a crash:
//
//   • a stale hint made `open()` pick an older segment as active, so
//     the next seal wrote frames at offsets that aliased existing ones;
//   • a collection declared in initState was never given its index, so
//     edits to it were unreachable after a restart;
//   • every store shared one keyspace, so two stores read each other.
//
// The first of those is the class this file exists for. The Zig store
// has no hint file, and `open()` sorts ids and takes the last as active
// — so it should be structurally immune. "Should be" is what these
// check.

const testing = std.testing;

/// A unique absolute directory. The store uses `openDirAbsolute` /
/// `createFileAbsolute`, so a relative path will not do — and `open()`
/// calls `makePath` itself, so this only has to produce the name.
var tmp_seq: usize = 0;

const TmpStore = struct {
    path: []u8,

    fn init(alloc: std.mem.Allocator) !TmpStore {
        tmp_seq += 1;
        const p = try std.fmt.allocPrint(alloc, "/tmp/skal-zig-store-{d}", .{tmp_seq});
        // Clear on the way IN as well as out: a run that crashed or was
        // interrupted leaves segments behind, and `open()` would happily
        // recover them into the next test's store.
        std.fs.cwd().deleteTree(p) catch {};
        return .{ .path = p };
    }
    fn deinit(self: *TmpStore, alloc: std.mem.Allocator) void {
        std.fs.cwd().deleteTree(self.path) catch {};
        alloc.free(self.path);
    }
    /// Open a file inside the store directory.
    fn openFile(self: *TmpStore, alloc: std.mem.Allocator, name: []const u8) !std.fs.File {
        const fp = try std.fmt.allocPrint(alloc, "{s}/{s}", .{ self.path, name });
        defer alloc.free(fp);
        return std.fs.openFileAbsolute(fp, .{ .mode = .read_write });
    }
};

/// An arena, deliberately, rather than `testing.allocator`.
///
/// SkalStore has no close/deinit: the runtime leaks it on purpose,
/// because bun's VM has no teardown short of process exit (see
/// skal_dispose_runtime). A leak-checking allocator would therefore fail
/// every test for doing exactly what shipping code does. An arena frees
/// the whole graph in one call instead, without inventing a lifecycle
/// the real thing does not have.
///
/// Segment mmaps are not arena memory and are released by the OS at
/// process exit — same as in production.
fn openStore(alloc: std.mem.Allocator, dir: []const u8) !*SkalStore {
    return SkalStore.open(alloc, dir);
}

// ── frames ─────────────────────────────────────────────────────────

test "frame round-trips through encode and decode" {
    var buf: [256]u8 = undefined;
    const n = storeWriteFrame(&buf, 0, 7, 0, "key", "value");
    const f = storeDecodeFrame(&buf, 0, true) orelse return error.DecodeFailed;

    try testing.expectEqual(@as(usize, n), f.total);
    try testing.expectEqualStrings("key", f.key);
    try testing.expectEqualStrings("value", f.value);
    try testing.expectEqual(@as(u32, 7), f.seq);
    try testing.expectEqual(@as(u8, 0), f.flags);
}

test "CRC rejects a corrupted frame" {
    var buf: [256]u8 = undefined;
    _ = storeWriteFrame(&buf, 0, 1, 0, "k", "payload");
    try testing.expect(storeDecodeFrame(&buf, 0, true) != null);

    // Flip a byte in the value. The whole point of the CRC is that this
    // is caught rather than served.
    buf[STORE_FRAME_HEADER + 1 + 2] ^= 0xFF;
    try testing.expect(storeDecodeFrame(&buf, 0, true) == null);
}

test "a tombstone frame is flagged" {
    var buf: [128]u8 = undefined;
    _ = storeWriteFrame(&buf, 0, 3, STORE_FLAG_TOMBSTONE, "gone", "");
    const f = storeDecodeFrame(&buf, 0, true) orelse return error.DecodeFailed;
    try testing.expect(f.flags & STORE_FLAG_TOMBSTONE != 0);
}

// ── basics ─────────────────────────────────────────────────────────

test "put / get / del" {
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);

    const s = try openStore(alloc, t.path);

    try s.put("alpha", "one");
    try s.put("beta", "two");
    try testing.expectEqualStrings("one", s.get("alpha").?);
    try testing.expectEqualStrings("two", s.get("beta").?);
    try testing.expect(s.get("missing") == null);

    try s.del("alpha");
    try testing.expect(s.get("alpha") == null);
    try testing.expectEqualStrings("two", s.get("beta").?);
}

test "last write wins" {
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);
    const s = try openStore(alloc, t.path);

    try s.put("k", "one");
    try s.put("k", "two");
    try s.put("k", "three");
    try testing.expectEqualStrings("three", s.get("k").?);
}

// ── recovery: the class of bug that cost the JS store ──────────────

test "reopen recovers every key" {
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);

    {
        const s = try openStore(alloc, t.path);
        try s.put("a", "1");
        try s.put("b", "2");
        try s.del("a");
        try s.put("c", "3");
    }

    const s2 = try openStore(alloc, t.path);
    try testing.expect(s2.get("a") == null); // the delete survived
    try testing.expectEqualStrings("2", s2.get("b").?);
    try testing.expectEqualStrings("3", s2.get("c").?);
}

test "the active segment after reopen is the NEWEST on disk" {
    // The JS store's P0: it trusted a hint that named an older tail, so
    // the next seal advanced onto an id that already existed and wrote
    // frames at offsets aliasing the ones there. This store keeps no
    // hint — `open()` sorts the ids and `activeSeg()` takes the last —
    // so the invariant should hold by construction. Assert it does.
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);

    const big = try alloc.alloc(u8, 100 * 1024);
    defer alloc.free(big);
    @memset(big, 'x');

    {
        const s = try openStore(alloc, t.path);
        try s.put("k1", big);
        try s.put("k2", big);
        try s.put("k3", big); // forces at least one new segment
        try testing.expect(s.segments.items.len > 1);
    }

    const s2 = try openStore(alloc, t.path);

    var highest: u32 = 0;
    for (s2.segments.items) |seg| {
        if (seg.id > highest) highest = seg.id;
    }
    try testing.expectEqual(highest, s2.activeSeg().id);
}

test "writing after reopen does not alias existing frames" {
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);

    const big = try alloc.alloc(u8, 100 * 1024);
    defer alloc.free(big);
    @memset(big, 'a');

    {
        const s = try openStore(alloc, t.path);
        try s.put("first", big);
        try s.put("second", big);
        try s.put("third", big);
    }

    const other = try alloc.alloc(u8, 100 * 1024);
    defer alloc.free(other);
    @memset(other, 'z');

    const s2 = try openStore(alloc, t.path);
    try s2.put("fourth", other);

    // Every earlier key must still read back as ITSELF.
    for ([_][]const u8{ "first", "second", "third" }) |k| {
        const v = s2.get(k) orelse return error.Missing;
        try testing.expectEqual(@as(usize, 100 * 1024), v.len);
        try testing.expectEqual(@as(u8, 'a'), v[0]);
        try testing.expectEqual(@as(u8, 'a'), v[v.len - 1]);
    }
    try testing.expectEqual(@as(u8, 'z'), s2.get("fourth").?[0]);
}

test "a value larger than a whole segment round-trips" {
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);

    const huge = try alloc.alloc(u8, STORE_SEG_SIZE * 2 + 77);
    defer alloc.free(huge);
    @memset(huge, 'H');

    {
        const s = try openStore(alloc, t.path);
        try s.put("huge", huge);
        try s.put("after", "small");
    }

    const s2 = try openStore(alloc, t.path);
    const v = s2.get("huge") orelse return error.Missing;
    try testing.expectEqual(huge.len, v.len);
    try testing.expectEqual(@as(u8, 'H'), v[v.len - 1]);
    try testing.expectEqualStrings("small", s2.get("after").?);
}

test "many keys across many segments all survive a reopen" {
    // Also covers the replay path that now runs with verify=false: the
    // cursor scan in mapSegment has already CRC'd every byte below it,
    // so replayInto skips re-verification. If that assumption were
    // wrong, recovery would lose frames here.
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);

    const val = try alloc.alloc(u8, 8 * 1024);
    defer alloc.free(val);

    {
        const s = try openStore(alloc, t.path);
        var i: usize = 0;
        while (i < 60) : (i += 1) {
            @memset(val, @intCast('A' + (i % 26)));
            var kb: [32]u8 = undefined;
            const k = try std.fmt.bufPrint(&kb, "key-{d}", .{i});
            try s.put(k, val);
        }
        try testing.expect(s.segments.items.len > 1);
    }

    const s2 = try openStore(alloc, t.path);
    var i: usize = 0;
    while (i < 60) : (i += 1) {
        var kb: [32]u8 = undefined;
        const k = try std.fmt.bufPrint(&kb, "key-{d}", .{i});
        const v = s2.get(k) orelse return error.Missing;
        try testing.expectEqual(@as(usize, 8 * 1024), v.len);
        try testing.expectEqual(@as(u8, @intCast('A' + (i % 26))), v[0]);
    }
}

// ── compaction ─────────────────────────────────────────────────────

test "compaction preserves live values and deletions" {
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);
    const s = try openStore(alloc, t.path);

    const big = try alloc.alloc(u8, 100 * 1024);
    defer alloc.free(big);

    // Churn one key so its segment goes mostly dead.
    var i: usize = 0;
    while (i < 8) : (i += 1) {
        @memset(big, @intCast('0' + i));
        try s.put("churn", big);
    }
    try s.put("live", "keep-me");
    try s.put("doomed", "bye");
    try s.del("doomed");

    var ran = false;
    i = 0;
    while (i < 8) : (i += 1) {
        if (try s.compact()) ran = true;
    }
    try testing.expect(ran);

    try testing.expectEqual(@as(u8, '7'), s.get("churn").?[0]);
    try testing.expectEqualStrings("keep-me", s.get("live").?);
    try testing.expect(s.get("doomed") == null);
}

test "compaction never drops the active segment" {
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);
    const s = try openStore(alloc, t.path);

    const big = try alloc.alloc(u8, 100 * 1024);
    defer alloc.free(big);
    @memset(big, 'q');

    var i: usize = 0;
    while (i < 8) : (i += 1) try s.put("churn", big);
    try s.put("tail", "in-the-active-segment");

    const active_before = s.activeSeg().id;
    i = 0;
    while (i < 8) : (i += 1) _ = try s.compact();

    // The active segment is where unflushed writes live; dropping it
    // would lose them, and `activeSeg()` is index-based so removing it
    // would also silently re-point at an older segment.
    try testing.expectEqual(active_before, s.activeSeg().id);
    try testing.expectEqualStrings("in-the-active-segment", s.get("tail").?);
}

// ── damage ─────────────────────────────────────────────────────────

test "a torn tail does not lose the frames before it" {
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();
    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);

    {
        const s = try openStore(alloc, t.path);
        try s.put("good1", "value-one");
        try s.put("good2", "value-two");
    }

    // Scribble garbage where the next frame would start — a crash
    // mid-write. Recovery must stop there, not discard what came first.
    {
        var f = try t.openFile(alloc, "seg-00000.log");
        defer f.close();
        const end = (try f.stat()).size;
        const at = @min(end - 64, @as(u64, 200));
        try f.seekTo(at);
        try f.writeAll(&[_]u8{ 0xDE, 0xAD, 0xBE, 0xEF, 0xAA, 0xBB, 0xCC, 0xDD });
    }

    const s2 = try openStore(alloc, t.path);
    // At minimum the store opens and does not serve corrupt bytes for
    // whatever survived.
    if (s2.get("good1")) |v| try testing.expectEqualStrings("value-one", v);
}

test "tombstones are accounted dead, so compaction can reclaim them" {
    // What this does and does not pin, stated because it was measured
    // rather than assumed.
    //
    // It pins that a delete-heavy store rebuilds enough dead accounting
    // across a reopen to actually reclaim segments, and that compaction
    // does not take the survivor with them.
    //
    // It does NOT catch replay's tombstone branch being removed. `get()`
    // filters tombstones itself, so reads are unaffected; and the
    // superseded live frames are already marked dead by the fetchRemove
    // above, so `dead` stays well over the compaction threshold either
    // way. Skipping a tombstone's own bytes is a modest under-count, not
    // a cliff — catching it would need an exact-byte assertion brittle
    // enough to break on any frame-header change. Left uncovered
    // deliberately.
    var ar = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer ar.deinit();
    const alloc = ar.allocator();

    var t = try TmpStore.init(alloc);
    defer t.deinit(alloc);

    const big = try alloc.alloc(u8, 100 * 1024);
    @memset(big, 'd');

    {
        const s = try openStore(alloc, t.path);
        var i: usize = 0;
        while (i < 6) : (i += 1) {
            var kb: [32]u8 = undefined;
            const k = try std.fmt.bufPrint(&kb, "doomed-{d}", .{i});
            try s.put(k, big);
        }
        try s.put("survivor", "keep");
        // Delete them all, so the early segments are almost entirely
        // dead once the tombstones are accounted for.
        i = 0;
        while (i < 6) : (i += 1) {
            var kb: [32]u8 = undefined;
            const k = try std.fmt.bufPrint(&kb, "doomed-{d}", .{i});
            try s.del(k);
        }
    }

    // Reopen: the dead accounting has to be rebuilt from the log, which
    // is the path the mutation broke.
    const s2 = try openStore(alloc, t.path);
    try testing.expect(s2.dead > 0);

    const before = s2.segments.items.len;
    var ran = false;
    var i: usize = 0;
    while (i < 8) : (i += 1) {
        if (try s2.compact()) ran = true;
    }
    try testing.expect(ran);
    try testing.expect(s2.segments.items.len < before);

    // And the survivor is still there afterwards.
    try testing.expectEqualStrings("keep", s2.get("survivor").?);
    try testing.expect(s2.get("doomed-0") == null);
}

// ── the key-list wire format ────────────────────────────────────────
//
// These pin the ENCODER. The JS side decodes this format, and its tests
// build buffers with a hand-written `pack()` — a second implementation.
// Nothing compared the two, so re-introducing a header/body desync left
// all 527 JS tests green. The byte layout asserted here is the same one
// engine.js's allKeys() reads.
test "packKeyList: empty list is just a zero count" {
    var buf: [64]u8 = undefined;
    const n = packKeyList(&buf, &[_][]const u8{}).?;
    try std.testing.expectEqual(@as(usize, 4), n);
    try std.testing.expectEqual(@as(u32, 0), std.mem.readInt(u32, buf[0..4], .little));
}

test "packKeyList: header, length table and body agree" {
    var buf: [128]u8 = undefined;
    const keys = [_][]const u8{ "k:a", "k:bb", "k:ccc" };
    const n = packKeyList(&buf, &keys).?;

    // [u32 count][u32 len x3][3 + 4 + 5 bytes]
    try std.testing.expectEqual(@as(usize, 4 + 12 + 12), n);
    try std.testing.expectEqual(@as(u32, 3), std.mem.readInt(u32, buf[0..4], .little));
    try std.testing.expectEqual(@as(u32, 3), std.mem.readInt(u32, buf[4..8], .little));
    try std.testing.expectEqual(@as(u32, 4), std.mem.readInt(u32, buf[8..12], .little));
    try std.testing.expectEqual(@as(u32, 5), std.mem.readInt(u32, buf[12..16], .little));

    // THE BODY STARTS AT 4 + count*4, derived from the HEADER — which is
    // exactly the coupling two commits here broke.
    var off: usize = 4 + 3 * 4;
    for (keys) |k| {
        try std.testing.expectEqualStrings(k, buf[off .. off + k.len]);
        off += k.len;
    }
    try std.testing.expectEqual(n, off);
}

test "packKeyList: refuses rather than overflowing a short buffer" {
    var buf: [8]u8 = undefined;
    try std.testing.expect(packKeyList(&buf, &[_][]const u8{ "k:aaaa", "k:bbbb" }) == null);
}

test "packKeyList: a decoder walking the format recovers every key" {
    // The reader's algorithm, transcribed from engine.js allKeys().
    var buf: [256]u8 = undefined;
    const keys = [_][]const u8{ "k:x", "k:y.z", "k:items#x", "k:\xc3\xa9" };
    const n = packKeyList(&buf, &keys).?;

    const count = std.mem.readInt(u32, buf[0..4], .little);
    try std.testing.expectEqual(@as(u32, keys.len), count);
    var off: usize = 4 + @as(usize, count) * 4;
    var i: usize = 0;
    while (i < count) : (i += 1) {
        const len = std.mem.readInt(u32, buf[4 + i * 4 ..][0..4], .little);
        try std.testing.expect(off + len <= n);
        try std.testing.expectEqualStrings(keys[i], buf[off .. off + len]);
        off += len;
    }
    try std.testing.expectEqual(n, off);
}
