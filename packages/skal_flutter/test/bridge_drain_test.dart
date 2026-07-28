// The drain path — apply, notify, and the coalescing contract between
// them. Previously untested, because `SkalBridge` needed a real 60 MB
// libskal handle; `SkalRuntime` + `FakeSkalRuntime` are the seam.
//
// What these pin is not "the decoder decodes". It is the three-way
// contract §2b introduced when it made drains happen more than once
// per frame (docs/TODO_OPTIMIZATIONS.md):
//
//   • a FRAME drain applies AND notifies
//   • an OFF-FRAME (doorbell) drain applies and DEFERS notification,
//     so a half-applied ring is never built from
//   • something always comes back for the deferred work
//
// The third clause is the one that shipped broken. `_pumpOpsBody`
// returned on its `seq == _lastOpSeq` fast path before flushing, so
// with doorbell batches arriving steadily the frame drain never saw
// new ops, never flushed, and the update was stranded — 366 ms to
// first paint (p95 978 ms), often none at all, against 11.5 ms for the
// same prop written alone. `test('a frame drain with an EMPTY ring
// still flushes …')` is that bug.
//
// The §2b design note claimed this case could not arise, on the
// grounds that "logic dispatch never touches NodeState". True of the
// dispatch; false of the drain, which consumes the WHOLE ring — so a
// batch carrying both a UI op and a root-targeted invoke
// (`setLoading(true); api.fetch()`) applies the UI op off-frame too.
// `group('a UI op batched with a logic call')` is that shape.

import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/wire.dart';

import 'fake_skal_runtime.dart';

/// Node ids under test. Deliberately not [kRootNodeId] — the decoder
/// special-cases node 1 on create (it is re-emitted on every boot and
/// hot reload, so its NodeState is kept rather than replaced) and that
/// is a different contract from the one under test here.
const int nodeA = 2;
const int nodeB = 3;

void main() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  /// Notifications observed per node, per lane. Both lanes are counted
  /// because `_flushTouched` defers and flushes them through the SAME
  /// code path — a test suite that only watched `cold` would stay green
  /// while every off-frame-deferred animation update stranded, on the
  /// most latency-visible lane in the framework.
  late Map<int, int> cold;
  late Map<int, int> hot;

  void watch(int id) {
    cold[id] = 0;
    hot[id] = 0;
    bridge.nodes[id]!.cold.addListener(() => cold[id] = cold[id]! + 1);
    bridge.nodes[id]!.hot.addListener(() => hot[id] = hot[id]! + 1);
  }

  /// Mount two nodes and start counting from zero, so every test below
  /// begins from a settled tree rather than from a mount.
  void seedTree() {
    js
      ..createNode(nodeA, wtBox)
      ..createNode(nodeB, wtBox)
      ..commit();
    bridge.pumpOps();
    cold = {};
    hot = {};
    watch(nodeA);
    watch(nodeB);
  }

  setUp(() {
    js = FakeSkalRuntime();
    bridge = SkalBridge(js);
    bridge.ensureRoot();
    seedTree();
  });

  tearDown(() {
    // Against the fake this only nulls a field, but `SkalBridge`'s
    // constructor arms the doorbell and the NATIVE `enableHostNotify`
    // allocates a `RawReceivePort` that only `disableHostNotify`
    // releases. Symmetric here so the pattern this file (and
    // docs/TESTING.md) teaches doesn't leak a live port per test the
    // day someone points it at a real `Skal`.
    bridge.disableOffFrameDrain();
  });

  test('the bridge arms the doorbell from its constructor', () {
    // Not from a widget: it must be live for main()'s own pre-runApp
    // pumpOps, and a widget has no business owning an FFI registration
    // it cannot correctly release.
    expect(js.hostNotifyArmed, isTrue);
  });

  group('frame drain', () {
    test('applies ops and notifies each touched node exactly once', () {
      js
        ..setPropU32(nodeA, propWidth, 100)
        ..setPropU32(nodeA, propHeight, 40)
        ..setPropU32(nodeB, propWidth, 7)
        ..commit();

      bridge.pumpOps();

      expect(bridge.nodes[nodeA]!.rawPropU32(propWidth), 100);
      expect(bridge.nodes[nodeA]!.rawPropU32(propHeight), 40);
      expect(bridge.nodes[nodeB]!.rawPropU32(propWidth), 7);
      // THE coalescing property: two writes to nodeA, one rebuild. A
      // 200-tweet batch with 1200 prop writes must not fire 1200
      // notifications.
      expect(cold[nodeA], 1, reason: 'two prop writes, one notify');
      expect(cold[nodeB], 1);
    });

    test('is a no-op when the ring has nothing new', () {
      js
        ..setPropU32(nodeA, propWidth, 100)
        ..commit();
      bridge.pumpOps();
      expect(cold[nodeA], 1);

      bridge.pumpOps();
      bridge.pumpOps();
      expect(cold[nodeA], 1,
          reason: 'an idle frame must not re-notify a clean node');
    });
  });

  group('off-frame (doorbell) drain', () {
    test('applies ops but does NOT notify', () {
      js
        ..setPropU32(nodeA, propWidth, 321)
        ..commitAndRing();

      expect(bridge.nodes[nodeA]!.rawPropU32(propWidth), 321,
          reason: 'the ops ARE consumed — that is the whole point of §2b');
      expect(cold[nodeA], 0,
          reason: 'notification is deferred so the widget tree is never '
              'built from a half-applied ring');
    });

    test('still advances the drained-seq checkpoint', () {
      js
        ..setPropU32(nodeA, propWidth, 1)
        ..commitAndRing();

      // JS spin-waits on this inside flushAndWaitForDrain before it may
      // rewind its write cursor. Deferring NOTIFICATION must not look
      // like deferring CONSUMPTION, or JS overwrites undrained ops.
      expect(js.lastDrainedSeq, js.publishedSeq);
    });

    test('a doorbell with nothing published is harmless', () {
      // Baselined, because setUp's commit() rings now — bridge.js rings
      // on every publish so the host's idle ticker gets restarted.
      final before = bridge.offFrameDrains;
      js.ringDoorbell();
      expect(cold[nodeA], 0);
      expect(bridge.offFrameDrains, before,
          reason: 'a ring against an unchanged ring must cost nothing');
    });
  });

  group('deferred notification is always collected', () {
    test('a frame drain with an EMPTY ring still flushes what an '
        'off-frame drain deferred', () {
      js
        ..setPropU32(nodeA, propWidth, 55)
        ..commitAndRing();
      expect(cold[nodeA], 0, reason: 'deferred, as designed');

      // No new ops. This is exactly the state `_pumpOpsBody` used to
      // return from without flushing — the stranded-update bug.
      bridge.pumpOps();

      expect(cold[nodeA], 1,
          reason: 'the frame drain owes this notification; nothing else '
              'is coming to deliver it');
    });

    test('N off-frame drains plus one frame drain produce exactly one '
        'notify per node', () {
      final before = bridge.offFrameDrains;
      for (var i = 0; i < 5; i++) {
        js
          ..setPropU32(nodeA, propWidth, i)
          ..setPropU32(nodeB, propHeight, i)
          ..commitAndRing();
      }
      expect(bridge.offFrameDrains, before + 5);
      expect(cold[nodeA], 0);

      bridge.pumpOps();

      // The coalescing §2b's control lane depends on: draining more
      // often must not mean rebuilding more often.
      expect(cold[nodeA], 1);
      expect(cold[nodeB], 1);
      expect(bridge.nodes[nodeA]!.rawPropU32(propWidth), 4,
          reason: 'last write wins, and every batch was applied');
    });

    test('a later frame drain does not re-notify an already-flushed node',
        () {
      js
        ..setPropU32(nodeA, propWidth, 9)
        ..commitAndRing();
      bridge.pumpOps();
      expect(cold[nodeA], 1);

      bridge.pumpOps();
      bridge.pumpOps();
      expect(cold[nodeA], 1,
          reason: 'the touched set must be cleared by the flush, not '
              'merely walked');
    });
  });

  group('the hot (animation) lane', () {
    // `_flushTouched` walks one touched set and fires two notifiers.
    // Everything the cold lane relies on has to hold here too, and this
    // is the lane where a stranded update is most visible — it is what
    // drives Transform/Opacity.
    test('a frame drain notifies hot, not cold', () {
      js
        ..setOpacity(nodeA, 0.5)
        ..commit();
      bridge.pumpOps();

      expect(bridge.nodes[nodeA]!.opacity, closeTo(0.5, 1e-6));
      expect(hot[nodeA], 1);
      expect(cold[nodeA], 0,
          reason: 'a hot prop must not invalidate the cached widget tree');
    });

    test('an off-frame drain defers the hot notify, and the next frame '
        'delivers it', () {
      js
        ..setOpacity(nodeA, 0.25)
        ..commitAndRing();
      expect(bridge.nodes[nodeA]!.opacity, closeTo(0.25, 1e-6),
          reason: 'applied');
      expect(hot[nodeA], 0, reason: 'deferred');

      bridge.pumpOps(); // empty ring — the stranding case, hot lane

      expect(hot[nodeA], 1);
    });

    test('hot and cold writes to one node coalesce independently', () {
      js
        ..setOpacity(nodeA, 0.1)
        ..setOpacity(nodeA, 0.9)
        ..setPropU32(nodeA, propWidth, 12)
        ..commitAndRing();
      bridge.pumpOps();

      expect(hot[nodeA], 1);
      expect(cold[nodeA], 1);
      expect(bridge.nodes[nodeA]!.opacity, closeTo(0.9, 1e-6));
    });
  });

  group('JS reset of the op ring', () {
    // bridge.js rewinds its write cursor on the overflow path and on
    // every hot reload. The host has three signals for it; the epoch
    // bump is the only RELIABLE one, because after a hot reload the
    // new tree can be the same size or larger, so writePos does not
    // regress and the fallback check cannot see it.
    test('a SHORTER post-reset batch is drained (writePos-regression '
        'fallback)', () {
      js
        ..setPropU32(nodeA, propWidth, 1)
        ..setPropU32(nodeA, propHeight, 1)
        ..setPropU32(nodeB, propWidth, 1)
        ..commit();
      bridge.pumpOps();
      expect(bridge.nodes[nodeA]!.rawPropU32(propWidth), 1);

      // JS rewinds to the base of the ring and bumps the epoch. The new
      // batch is SHORTER than what was drained, so it lands entirely
      // below the old checkpoint.
      js
        ..resetRing()
        ..setPropU32(nodeA, propWidth, 99)
        ..commit();
      bridge.pumpOps();

      expect(bridge.nodes[nodeA]!.rawPropU32(propWidth), 99,
          reason: 'without the epoch signal the host keeps its old drain '
              'checkpoint and skips the whole post-reset batch');
      expect(cold[nodeA], 2);
    });

    test('a post-reset batch LARGER than the last one is still drained',
        () {
      js
        ..setPropU32(nodeA, propHeight, 1)
        ..commit();
      bridge.pumpOps();

      // The hot-reload shape: the new batch ends ABOVE the old
      // checkpoint, so the "writePos regressed" fallback cannot fire and
      // the epoch carries the whole signal.
      //
      // Assert on the FIRST op of the batch. Missing the epoch does not
      // lose the batch, it loses its PREFIX — the drain resumes from the
      // stale checkpoint — so a test that only checks the last write
      // passes either way. (It did; a mutation run that deleted
      // `epochBumped` from the reset condition left this group green
      // until the assertion moved here.)
      js
        ..resetRing()
        ..setPropU32(nodeB, propWidth, 42); // op #1 — the one at risk
      for (var i = 0; i < 6; i++) {
        js.setPropU32(nodeA, propHeight, i);
      }
      js.commit();
      bridge.pumpOps();

      expect(bridge.nodes[nodeB]!.rawPropU32(propWidth), 42,
          reason: 'the head of the post-reset batch lands below the old '
              'drain checkpoint; only the epoch bump says so');
      expect(bridge.nodes[nodeA]!.rawPropU32(propHeight), 5);
    });
  });

  group('richText parent promotion', () {
    // A `<richText>` absorbs each child `<text>` into a TextSpan, so the
    // child is never its own widget: a dirty child has to rebuild the
    // PARENT. The promotion pass derives that, and must land exactly one
    // notify on the parent however many drains the child was touched
    // across — otherwise a doorbell burst produces a rebuild per batch
    // on the one node type that cannot coalesce them itself.
    const int rich = 4;
    const int span = 5;

    setUp(() {
      js
        ..createNode(rich, wtRichText)
        ..createNode(span, wtText)
        ..appendChild(rich, span)
        ..commit();
      bridge.pumpOps();
      cold[rich] = 0;
      cold[span] = 0;
      bridge.nodes[rich]!.cold.addListener(() => cold[rich] = cold[rich]! + 1);
      bridge.nodes[span]!.cold.addListener(() => cold[span] = cold[span]! + 1);
    });

    test('dirtying a span notifies its richText parent, once', () {
      js
        ..setPropU32(span, propWidth, 3)
        ..commit();
      bridge.pumpOps();

      expect(cold[span], 1);
      expect(cold[rich], 1,
          reason: 'the parent has to re-emit its TextSpan tree');
    });

    test('N off-frame drains touching a span still promote the parent '
        'exactly once', () {
      for (var i = 0; i < 5; i++) {
        js
          ..setPropU32(span, propWidth, i)
          ..commitAndRing();
      }
      expect(cold[rich], 0, reason: 'deferred with everything else');

      bridge.pumpOps();

      expect(cold[span], 1);
      expect(cold[rich], 1,
          reason: 'five doorbell batches, one parent rebuild — the '
              'promotion is derived once at flush time, not re-derived '
              'per drain');
    });
  });

  group('hot-reload tree sweep', () {
    // `docs/TODO.md` carried this as "listeners from the old tree are
    // leaked". They are not — but the reason is a deliberate,
    // easy-to-undo decision rather than an accident, so it is pinned
    // here: the sweep drops the generation from `nodes` WITHOUT
    // disposing it, because the outgoing SkalNode widgets (and any host
    // AnimationControllers) stay mounted until the rebuild, and
    // disposing a notifier they still hold would risk a
    // "used after dispose" if one ticks in between. Each swept
    // NodeState becomes garbage when its widget unmounts and removes
    // its own listener.

    test('drops every node but the root, and keeps the root INSTANCE', () {
      final rootBefore = bridge.nodes[kRootNodeId];
      js
        ..appendChild(kRootNodeId, nodeA)
        ..commit();
      bridge.pumpOps();
      expect(bridge.nodes.length, greaterThan(1));

      js
        ..resetRootSubtree()
        ..commit();
      bridge.pumpOps();

      expect(bridge.nodes.keys, [kRootNodeId]);
      expect(identical(bridge.nodes[kRootNodeId], rootBefore), isTrue,
          reason: 'SkalRoot is bound to this NodeState — replacing it '
              'would strand the mounted root on a dead notifier');
      expect(bridge.nodes[kRootNodeId]!.childIds, isEmpty);
    });

    test('does NOT dispose the swept generation', () {
      final swept = bridge.nodes[nodeA]!;

      js
        ..resetRootSubtree()
        ..commit();
      bridge.pumpOps();

      expect(bridge.nodes.containsKey(nodeA), isFalse, reason: 'dropped');
      // `addListener` on a disposed ChangeNotifier throws in debug. It
      // must not: the outgoing widget is still mounted right now and
      // will detach itself on the rebuild.
      expect(() => swept.cold.addListener(() {}), returnsNormally,
          reason: 'the swept generation outlives the sweep by one frame');
    });

    test('a post-sweep generation reusing the same ids mounts cleanly', () {
      js
        ..resetRootSubtree()
        ..commit();
      bridge.pumpOps();

      // The incoming bundle re-emits from id 1 upward — same numbers,
      // new generation.
      js
        ..createNode(nodeA, wtBox)
        ..setPropU32(nodeA, propWidth, 77)
        ..commit();
      bridge.pumpOps();

      expect(bridge.nodes[nodeA]!.rawPropU32(propWidth), 77);
    });
  });

  group('a UI op batched with a logic call', () {
    // The shipping shape that broke: `setLoading(true); api.fetch()` in
    // one handler is ONE commit batch carrying a prop write and a
    // root-targeted invoke. The doorbell drains the whole ring, so the
    // prop write goes off-frame whether or not anyone intended it to.
    test('paints on the very next frame, not whenever traffic resumes',
        () {
      js
        ..setPropU32(nodeA, propWidth, 200)
        ..commitAndRing(); // as if an invoke rode along in this batch

      // A steady stream of further doorbell batches, none of which
      // touch nodeA. Before the fix these kept the frame drain on its
      // empty-ring fast path, so nodeA stayed dark the whole time.
      for (var i = 0; i < 3; i++) {
        bridge.pumpOps(); // frames go by
        js
          ..setPropU32(nodeB, propWidth, i)
          ..commitAndRing();
      }

      expect(cold[nodeA], 1,
          reason: 'stranded here means a loading spinner that appears '
              'after the request it was announcing');
    });
  });

  group('clearing a built-in cold prop', _clearPropTests);
}

// ─────────────────────────────────────────────────────────────────────
// Clearing a built-in cold prop.
//
// `opClearProp` exists because setting a cold prop to null used to emit
// nothing — the renderer treated it as "leave the previous value", so a
// conditional prop could be turned on and never off. These pin that the
// host actually forgets the key, and that a reader falls back to its
// default rather than to a stale slot in one of the other typed maps.
// ─────────────────────────────────────────────────────────────────────

void _clearPropTests() {
  late FakeSkalRuntime js;
  late SkalBridge bridge;

  setUp(() {
    js = FakeSkalRuntime();
    bridge = SkalBridge(js);
    js.createNode(2, wtBox);
    js.appendChild(kRootNodeId, 2);
    js.commit();
    bridge.pumpOps();
  });

  test('removes the key so the reader falls back to its default', () {
    js.setPropU32(2, propBgColor, 0x00FF0000);
    js.commit();
    bridge.pumpOps();
    expect(bridge.nodes[2]!.getPropU32(propBgColor, 0x11223344), 0x00FF0000);

    js.clearProp(2, propBgColor);
    js.commit();
    bridge.pumpOps();
    expect(bridge.nodes[2]!.getPropU32(propBgColor, 0x11223344), 0x11223344,
        reason: 'the fallback must win once the key is gone');
    expect(bridge.nodes[2]!.hasPropU32(propBgColor), isFalse);
  });

  test('clears every typed map, not just the one that was written', () {
    // The three maps are insert-only and independently lived, so a
    // clear that only touched `props` would leave a string or float
    // slot shadowing the default for readers that probe those first.
    js.setPropU32(2, propWidth, 300);
    js.setPropStr(2, propWidth, 'fill');
    js.commit();
    bridge.pumpOps();

    js.clearProp(2, propWidth);
    js.commit();
    bridge.pumpOps();

    final n = bridge.nodes[2]!;
    expect(n.hasPropU32(propWidth), isFalse);
    expect(n.hasPropF32(propWidth), isFalse);
    expect(n.hasPropStr(propWidth), isFalse);
  });

  test('marks the node dirty so the subtree rebuilds', () {
    js.setPropU32(2, propBgColor, 0x00FF0000);
    js.commit();
    bridge.pumpOps();

    var notified = 0;
    bridge.nodes[2]!.cold.addListener(() => notified++);

    js.clearProp(2, propBgColor);
    js.commit();
    bridge.pumpOps();

    expect(notified, 1, reason: 'a cleared prop must repaint the node');
  });

  // The drift guard the comment on `opClearProp` promises. Removing a
  // key has the same downstream consequences as writing one, so the set
  // and clear paths run through the SAME assertions — a follow-up added
  // to one and not the other fails right here.
  for (final (label, clear) in [('set', false), ('clear', true)]) {
    test('a stack-positioning prop re-dirties the PARENT on $label', () {
      js.createNode(3, wtBox);
      js.appendChild(2, 3);
      js.setPropU32(3, propTop, 10);
      js.commit();
      bridge.pumpOps();

      var parentNotified = 0;
      bridge.nodes[2]!.cold.addListener(() => parentNotified++);

      if (clear) {
        js.clearProp(3, propTop);
      } else {
        js.setPropU32(3, propTop, 20);
      }
      js.commit();
      bridge.pumpOps();

      expect(parentNotified, 1,
          reason: 'the <stack> consumes top/right/bottom/left from its '
              'CHILD; without a parent re-dirty it never rebuilds the '
              'Positioned and the child stays where it was');
    });
  }

  test('a clear for an unknown node is ignored, not fatal', () {
    js.clearProp(9999, propBgColor);
    js.commit();
    expect(() => bridge.pumpOps(), returnsNormally);
  });
}
