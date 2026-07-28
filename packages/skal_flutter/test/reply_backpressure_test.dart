// What happens when the reply heap fills up.
//
// The reply heap is 256 KiB of Dart-write / JS-read scratch that
// carries every string, JSON and tuple payload leaving the host. It is
// a bump allocator: the cursor only rewinds once JS has read past
// everything in flight.
//
// The old wraparound path spin-waited on `DateTime.now()` for up to
// 50 ms on the UI thread and then rewound anyway when the deadline
// passed — so it could freeze the app AND still clobber a string JS had
// not read. On Flutter Web it could not even work in principle: Dart's
// view of the heap is a mirror refreshed only at pump boundaries and JS
// shares the thread, so the loop re-read one stale word until it timed
// out. The comment on it said "a ms or two".
//
// It now reports "no room" instead, and `dispatchEvent` queues the
// event — payload still in Dart — behind the same overflow queue a full
// event ring uses. These tests pin the three properties that matters:
// the thread does not block, nothing is lost, and order is preserved.

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

void main() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  setUp(() {
    js = FakeSkalRuntime();
    bridge = SkalBridge(js);
  });

  // A payload big enough that four of them overrun the 256 KiB heap.
  String chunk(int n, String tag) => tag * n;
  final big = 80 * 1024; // ~80 KiB per string, 3 fit, the 4th does not

  group('reply heap back-pressure', () {
    test('a payload that does not fit is queued, not dropped', () {
      for (var i = 0; i < 4; i++) {
        bridge.dispatchEventStr(100 + i, chunk(big, '$i'));
      }

      // Three made it into the ring; the fourth is held in Dart.
      var seen = js.drainEvents(advanceReplyCursor: false);
      expect(seen.length, 3);
      expect(seen.map((e) => e.id), [100, 101, 102]);

      // JS now finishes with those strings and the host pumps.
      for (final e in seen) {
        expect(e.payload!.length, big);
      }
      js.consumeReplyHeap();

      bridge.pumpOps();

      seen = js.drainEvents();
      expect(seen.length, 1, reason: 'the queued reply must arrive');
      expect(seen.single.id, 103);
      expect(seen.single.payload, chunk(big, '3'));
    });

    test('does not block the calling thread', () {
      // 40 oversized payloads with a JS side that never drains. The old
      // code paid up to 50 ms per wraparound here.
      final sw = Stopwatch()..start();
      for (var i = 0; i < 40; i++) {
        bridge.dispatchEventStr(200 + i, chunk(big, 'x'));
      }
      sw.stop();

      // Generous by three orders of magnitude against the old 50 ms ×
      // ~37 wraparounds (~1.8 s), tight enough that any reintroduced
      // spin trips it.
      expect(sw.elapsedMilliseconds, lessThan(250),
          reason: 'dispatch must never wait on the JS side');
    });

    test('nothing is lost and order is preserved across many rounds', () {
      const total = 24;
      for (var i = 0; i < total; i++) {
        bridge.dispatchEventStr(300 + i, '$i:${chunk(big, 'y')}');
      }

      final received = <FakeEvent>[];
      // Pump until the queue drains, with JS consuming as it goes.
      for (var round = 0; round < total + 5; round++) {
        received.addAll(js.drainEvents());
        bridge.pumpOps();
      }
      received.addAll(js.drainEvents());

      expect(received.length, total, reason: 'every reply must arrive once');
      expect(received.map((e) => e.id).toList(),
          [for (var i = 0; i < total; i++) 300 + i]);
      for (var i = 0; i < total; i++) {
        expect(received[i].payload!.startsWith('$i:'), isTrue,
            reason: 'payload ${received[i].id} carries the wrong string');
      }
    });

    test('a small event queued behind a big one does not overtake it', () {
      // Fill the heap so the next payload cannot be placed.
      for (var i = 0; i < 4; i++) {
        bridge.dispatchEventStr(400 + i, chunk(big, 'z'));
      }
      // This one would fit in the ring immediately if ordering were not
      // enforced — it carries no payload at all.
      bridge.dispatchEventBool(500, true);

      js.drainEvents(advanceReplyCursor: false);
      js.consumeReplyHeap();
      bridge.pumpOps();

      final tail = js.drainEvents();
      expect(tail.map((e) => e.id), [403, 500],
          reason: 'the payload-less event must stay behind the queued one');
    });

    test('a payload larger than the whole heap arrives INTACT, in chunks', () {
      // It used to be truncated — loudly, but truncated. An event record
      // carries one (offset, length) into a 256 KiB region, so a single
      // larger value had no representation at all. It is now split into
      // eventArgStrChunk parts plus a final record with the real type.
      final huge = 'A' * (kReplyHeapSize * 3 + 517);
      bridge.dispatchEventStr(900, huge);

      // Drain across pumps: each chunk has to fit the heap, so later
      // ones queue behind the ones JS has not read yet.
      final parts = <FakeEvent>[];
      for (var round = 0; round < 40; round++) {
        parts.addAll(js.drainEvents());
        bridge.pumpOps();
      }
      parts.addAll(js.drainEvents());

      expect(parts.length, greaterThan(1), reason: 'must have been split');
      // Every record but the last announces itself as a part.
      for (var i = 0; i < parts.length - 1; i++) {
        expect(parts[i].argType, eventArgStrChunk);
      }
      expect(parts.last.argType, eventArgStr);

      final joined = parts.map((e) => e.payload!).join();
      expect(joined.length, huge.length);
      expect(joined, huge);
    });

    test('a multi-byte payload splits on codepoint boundaries', () {
      // Load-bearing, not tidiness. JS does NOT reassemble bytes:
      // `readReplyString` runs a TextDecoder over each part as it lands
      // and only then joins the strings, so a part that ended
      // mid-sequence would decode to U+FFFD on both sides of the seam —
      // silently, because that decoder is non-fatal.
      final huge = '€' * kReplyHeapSize;    // 3 bytes each
      bridge.dispatchEventStr(901, huge);

      final parts = <FakeEvent>[];
      for (var round = 0; round < 40; round++) {
        parts.addAll(js.drainEvents());
        bridge.pumpOps();
      }
      parts.addAll(js.drainEvents());

      // drainEvents utf8-decodes each part INDIVIDUALLY, with
      // allowMalformed off — a split sequence throws FormatException
      // there, so reaching this line is half the assertion. (That is
      // also the one way this fake is stricter than the browser, which
      // substitutes instead of throwing.)
      expect(parts.length, greaterThan(1), reason: 'must have been split');
      expect(parts.map((e) => e.payload!).join(), huge);
    });

    test('an oversize payload still chunks when the queue is NOT empty', () {
      // The ordering gate used to come first, so a payload larger than
      // the heap that arrived while anything was queued spilled WHOLE
      // and reached _flushEventOverflow — which truncates it to 256 KiB.
      // Chunking skipped itself in the exact condition it exists for:
      // back-pressure. A stream emitting two big values back to back is
      // all it takes.
      final big = 'b' * (80 * 1024);
      for (var i = 0; i < 4; i++) {
        bridge.dispatchEventStr(600 + i, big);   // the 4th spills
      }
      expect(bridge.queuedReplyChars, greaterThan(0),
          reason: 'the queue has to be non-empty for this to test anything');

      final huge = 'H' * (kReplyHeapSize * 2 + 91);
      bridge.dispatchEventStr(650, huge);

      final parts = <FakeEvent>[];
      for (var round = 0; round < 60; round++) {
        parts.addAll(js.drainEvents());
        bridge.pumpOps();
      }
      parts.addAll(js.drainEvents());

      final mine = parts.where((e) => e.id == 650).toList();
      expect(mine.length, greaterThan(1), reason: 'must have been split');
      expect(mine.last.argType, eventArgStr);
      expect(mine.map((e) => e.payload!).join(), huge);

      // And the values queued ahead of it still came first.
      final ids = parts.map((e) => e.id).toList();
      expect(ids, equals([...ids]..sort()),
          reason: 'chunks must queue behind what was already there');
    });

    test('a payload that FITS is not chunked', () {
      bridge.dispatchEventStr(902, 'small');
      final seen = js.drainEvents();
      expect(seen.length, 1);
      expect(seen.single.argType, eventArgStr);
      expect(seen.single.payload, 'small');
    });

  });

  group('oversize payloads', _oversizeTests);
  group('overflow ceiling', _overflowCapTests);
}

// ─────────────────────────────────────────────────────────────────────
// The oversize branch.
//
// A payload larger than the whole heap lands at offset 0 and spans the
// entire region, so it clobbers EVERY live reference. It has to obey
// the same "not while JS still holds bytes" rule as an ordinary
// wraparound — the rewrite that introduced that rule originally left
// this one branch writing unconditionally.
// ─────────────────────────────────────────────────────────────────────

void _oversizeTests() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  setUp(() {
    js = FakeSkalRuntime();
    bridge = SkalBridge(js);
  });

  test('an oversize payload does not clobber bytes JS has not read', () {
    bridge.dispatchEventStr(700, 'keep-me');
    final first = js.drainEvents(advanceReplyCursor: false);
    expect(first.single.payload, 'keep-me');
    final offset = first.single.argHeapOffset;
    final length = first.single.argValueI32;

    // JS has NOT advanced its read cursor — 'keep-me' is still live.
    // This payload is larger than the whole heap, so it is chunked; each
    // chunk still has to wait for room like any other write.
    bridge.dispatchEventStr(701, 'x' * (kReplyHeapSize * 2));

    final stillThere = utf8.decode(js.bridge.sublist(
        kReplyHeapOff + offset, kReplyHeapOff + offset + length));
    expect(stillThere, 'keep-me',
        reason: 'a chunk must not be written over a live reference');

    // Once JS catches up the whole thing arrives, intact.
    js.consumeReplyHeap();
    final parts = <FakeEvent>[];
    for (var round = 0; round < 40; round++) {
      parts.addAll(js.drainEvents());
      bridge.pumpOps();
    }
    parts.addAll(js.drainEvents());

    final forId701 = parts.where((e) => e.id == 701).toList();
    expect(forId701.map((e) => e.payload!).join().length, kReplyHeapSize * 2);
  });
}

// ─────────────────────────────────────────────────────────────────────
// The overflow ceiling.
// ─────────────────────────────────────────────────────────────────────

void _overflowCapTests() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  setUp(() {
    js = FakeSkalRuntime();
    bridge = SkalBridge(js);
  });

  test('a wedged JS side cannot grow the queue without bound', () {
    // Push far past the ceiling with a JS side that never drains.
    // Retention must PLATEAU, not track what was sent.
    //
    // (The first version of this test asserted only that delivered ids
    // came back in order. That passed with the ceiling deleted
    // entirely — it never observed retention at all. Assert the thing
    // the fix does.)
    const chunk = 256 * 1024;
    const sent = 60;
    for (var i = 0; i < sent; i++) {
      bridge.dispatchEventStr(800 + i, 'q' * chunk);
    }

    final retained = bridge.queuedReplyChars;
    expect(retained, lessThanOrEqualTo(4 * 1024 * 1024),
        reason: 'retention must respect the ceiling');
    expect(retained, lessThan(sent * chunk ~/ 2),
        reason: 'retention must not track what was sent — $sent x $chunk '
            'chars went in and $retained is being held');
  });

  test('a transfer the ceiling cuts short is TERMINATED, not abandoned', () {
    // The chunk protocol makes JS hold every part until a record with
    // the real arg type releases them. So a transfer whose tail the
    // ceiling refuses must still be closed out — otherwise the handler
    // never fires, an awaiting caller never settles, and the parts stay
    // pinned in the JS map for the life of the process. That is worse
    // than the truncation chunking replaced, which at least delivered.
    final huge = 'z' * (6 * 1024 * 1024);   // past the 4 MiB ceiling
    bridge.dispatchEventStr(770, huge);

    final parts = <FakeEvent>[];
    for (var round = 0; round < 80; round++) {
      parts.addAll(js.drainEvents());
      bridge.pumpOps();
    }
    parts.addAll(js.drainEvents());

    final mine = parts.where((e) => e.id == 770).toList();
    expect(mine, isNotEmpty);
    // The last record carries the REAL type — that is the terminator JS
    // waits on. Without it every record is a part and nothing dispatches.
    expect(mine.last.argType, eventArgStr,
        reason: 'the transfer must be closed, not left open forever');
    for (var i = 0; i < mine.length - 1; i++) {
      expect(mine[i].argType, eventArgStrChunk);
    }
    // Truncated, as advertised — a prefix, and a prefix of the original.
    final joined = mine.map((e) => e.payload!).join();
    expect(joined.length, lessThan(huge.length));
    expect(huge.startsWith(joined), isTrue);
  });

  test('what does survive is still in order — a gap, never a reorder', () {
    const chunk = 80 * 1024;
    for (var i = 0; i < 12; i++) {
      bridge.dispatchEventStr(850 + i, 'w' * chunk);
    }
    final got = <int>[];
    for (var round = 0; round < 20; round++) {
      got.addAll(js.drainEvents().map((e) => e.id));
      bridge.pumpOps();
    }
    got.addAll(js.drainEvents().map((e) => e.id));
    expect(got, isNotEmpty);
    expect(got, equals([...got]..sort()));
  });

  test('a tree sweep drops queued events for the dead generation', () {
    for (var i = 0; i < 6; i++) {
      bridge.dispatchEventStr(900 + i, 'r' * (80 * 1024));
    }
    js.drainEvents(advanceReplyCursor: false);   // take them, hold the strings

    js.resetRootSubtree();
    js.commit();
    bridge.pumpOps();

    // The queued replies belonged to handlers the reload destroyed.
    js.consumeReplyHeap();
    bridge.pumpOps();
    expect(js.drainEvents().where((e) => e.id >= 900), isEmpty,
        reason: 'swept-generation events must not be delivered after reload');
  });
}
