// A JS side made of a plain Uint8List.
//
// `SkalBridge` used to require a real `Skal` — a 60 MB dlopen behind a
// private constructor — so the drain path had no unit coverage at all
// and a stranded-update bug shipped past a 13-finding review (see
// `lib/skal/runtime.dart`). `SkalRuntime` is the seam; this is what
// tests hand it.
//
// The point of this class is that it is the PRODUCER, not a stub. It
// writes real 16-byte ops into a real 6 MiB region at the real offsets
// from `wire.dart`, and publishes them the way `bridge.js` does:
// bump `hOpWritePos`, then bump `hOpSeq`. If the wire format drifts,
// these tests break — which is the intent.
//
// Mirrors of the two `bridge.js` publish paths:
//
//   commit()         → `publishProgress()`. Host sees the ops at its
//                      next frame drain.
//   commitAndRing()  → `commit()` in bridge.js, for a batch containing
//                      a ROOT-targeted invoke: publish, then ring
//                      `__skal_notifyHost()` so the host drains now.

import 'dart:convert';
import 'dart:typed_data';

import 'package:skal_flutter/skal/runtime.dart';
import 'package:skal_flutter/skal/wire.dart';

/// One event record as the JS side would decode it.
class FakeEvent {
  final int kind;
  final int argType;
  final int id;
  final int argValueI32;
  final int argHeapOffset;

  /// Decoded reply-heap string, for the arg types that carry one.
  final String? payload;

  FakeEvent({
    required this.kind,
    required this.argType,
    required this.id,
    required this.argValueI32,
    required this.argHeapOffset,
    required this.payload,
  });

  @override
  String toString() => 'FakeEvent(kind: $kind, id: $id, payload: '
      '${payload == null ? null : '${payload!.length} bytes'})';
}

class FakeSkalRuntime implements SkalRuntime {
  @override
  final Uint8List bridge = Uint8List(kBridgeSize);

  late final ByteData _d = ByteData.sublistView(bridge);

  /// Whatever `SkalBridge`'s constructor armed via [enableHostNotify].
  /// Calling it is what `libskal` does when JS rings the doorbell.
  void Function()? _doorbell;

  int wakeJsCalls = 0;
  int replyHeapResets = 0;
  int evaluateCalls = 0;
  bool hostNotifyArmed = false;

  // ── the JS half ────────────────────────────────────────────────────

  /// Bytes written into the op ring, published or not.
  int _writePos = 0;
  int _seq = 0;

  /// Ops written since the last [commit] — i.e. one JS batch.
  int _pendingOps = 0;

  /// Write one 16-byte op. Invisible to the host until [commit].
  void writeOp(int opcode, int a, int b, int c) {
    // Without this a long test walks straight out of the op ring and
    // into the string heap, and `_drain` clamps `writePos` to
    // `kOpRingSize` and silently ignores the overflow — so the test
    // goes green having asserted nothing. Fail loudly instead. Real JS
    // never gets here: `writeOp` in bridge.js calls
    // `flushAndWaitForDrain` at `RING_NEAR_END32` and rewinds.
    if (_writePos + 16 > kOpRingSize) {
      throw StateError(
          'fake op ring overflow at $_writePos B — a test wrote more than '
          '${kOpRingSize ~/ 16} ops without calling resetRing()');
    }
    final p = kOpRingOffset + _writePos;
    _d.setUint32(p, opcode, Endian.little);
    _d.setInt32(p + 4, a, Endian.little);
    _d.setInt32(p + 8, b, Endian.little);
    _d.setInt32(p + 12, c, Endian.little);
    _writePos += 16;
    _pendingOps++;
  }

  void createNode(int id, int widgetType) =>
      writeOp(opCreateNode, id, widgetType, 0);

  void setPropU32(int id, int key, int value) =>
      writeOp(opSetPropU32, id, key, value);

  /// Append [child] to [parent]. `c == 0` means "no anchor", i.e. push
  /// to the end — the shape Solid's universal renderer emits for a
  /// plain append.
  void appendChild(int parent, int child) =>
      writeOp(opInsertBefore, parent, child, 0);

  /// A HOT prop — the animation lane. Only the Transform/Opacity
  /// wrapper listens on `hot`, so it is deferred and flushed by the
  /// same code as `cold` but through a separate notifier.
  ///
  /// Floats travel as their IEEE-754 bit pattern in the `c` slot, the
  /// same Float32Array/Uint32Array aliasing trick the JS encoder uses.
  void setOpacity(int id, double v) {
    final scratch = ByteData(4)..setFloat32(0, v, Endian.little);
    writeOp(opSetOpacity, id, 0, scratch.getInt32(0, Endian.little));
  }

  /// Publish the batch and ring — `publishProgress()` in bridge.js,
  /// which rings on the way out. Bumping `hOpSeq` is what makes
  /// `_pumpOpsBody` stop short-circuiting.
  ///
  /// The ring is not decoration. bridge.js rings on EVERY publish now,
  /// because the host's frame ticker stops when idle and this is what
  /// restarts it. A fake that published without ringing would model a
  /// JS side that cannot exist, and would let a host bug through.
  void commit() {
    if (_pendingOps == 0) return;
    publishOnly();
    ringDoorbell();
  }

  /// Publish WITHOUT ringing. Models nothing bridge.js does on its own —
  /// use it to assert what the frame drain does with ops it was never
  /// woken for.
  void publishOnly() {
    if (_pendingOps == 0) return;
    _pendingOps = 0;
    _d.setUint32(hOpWritePos, _writePos, Endian.little);
    _seq++;
    _d.setUint32(hOpSeq, _seq & 0xFFFFFFFF, Endian.little);
    _d.setUint32(hOpSeq + 4, _seq ~/ 0x100000000, Endian.little);
  }

  /// Was the separate "publish, then ring" helper, from when ringing was
  /// reserved for ROOT-targeted invokes. Now identical to [commit].
  void commitAndRing() => commit();

  /// Ring without publishing anything new. The host should treat this
  /// as a no-op drain.
  void ringDoorbell() => _doorbell?.call();

  /// Remove a built-in cold prop — `a = nodeId`, `b = propKey`. What
  /// the renderer emits when a cold prop goes null/undefined.
  void clearProp(int id, int key) => writeOp(opClearProp, id, key, 0);

  /// A string prop. Wire format: `b = (key << 24) | offset`, `c = byte
  /// length`, with the bytes living in the JS string heap. The host
  /// reads them at the op's own offset and never consults
  /// `hStrWritePos`, so nothing needs publishing here.
  void setPropStr(int id, int key, String value) {
    final bytes = utf8.encode(value);
    final off = _strPos;
    bridge.setRange(kStringHeapOff + off, kStringHeapOff + off + bytes.length,
        bytes);
    _strPos += bytes.length;
    writeOp(opSetPropStr, id, (key << 24) | (off & 0xFFFFFF), bytes.length);
  }

  int _strPos = 0;

  /// A node's text. Wire format: `b = heap offset`, `c = byte length` —
  /// no key packing, unlike [setPropStr].
  void setText(int id, String value) {
    final bytes = utf8.encode(value);
    final off = _strPos;
    bridge.setRange(kStringHeapOff + off, kStringHeapOff + off + bytes.length,
        bytes);
    _strPos += bytes.length;
    writeOp(opSetText, id, off, bytes.length);
  }

  /// `a = mode` (0 material, 1 cupertino, 2 adaptive), `b = brightness`.
  void setDesign(int mode, {int brightness = 0}) =>
      writeOp(opSetDesign, mode, brightness, 0);

  /// The hot-reload teardown op. `hot.js`'s `beginReload` emits this
  /// after disposing the outgoing generation's reactive root, and
  /// `resetRootSubtree` publishes it synchronously so the host sees the
  /// sweep before the incoming bundle seeds its cursors.
  void resetRootSubtree() => writeOp(opResetRootSubtree, kRootNodeId, 0, 0);

  /// Rewind the write cursor to the base of the ring and bump
  /// `hJsResetEpoch` — bridge.js's overflow path (`flushAndWaitForDrain`
  /// → `resetFrame`) and every hot reload (`resetRootSubtree`).
  ///
  /// The epoch is the RELIABLE reset signal, and the only one that fires
  /// when the post-reset tree is the same size or larger than what was
  /// last drained — i.e. a hot reload re-mounting a similar tree, where
  /// `writePos` does not regress and the host's fallback check cannot
  /// see it. Without this the host would keep its old drain checkpoint
  /// and skip the entire new batch.
  void resetRing() {
    _writePos = 0;
    _pendingOps = 0;
    final epoch = _d.getUint32(hJsResetEpoch, Endian.little);
    _d.setUint32(hJsResetEpoch, epoch + 1, Endian.little);
  }

  /// What the host has told JS it has consumed. JS spin-waits on this
  /// in `flushAndWaitForDrain` before rewinding its write cursor, so a
  /// drain that applies ops MUST advance it — including an off-frame
  /// one, which defers only notification, not consumption.
  int get lastDrainedSeq =>
      _d.getUint32(hLastDrainedSeq, Endian.little) +
      _d.getUint32(hLastDrainedSeq + 4, Endian.little) * 0x100000000;

  int get publishedSeq =>
      _d.getUint32(hOpSeq, Endian.little) +
      _d.getUint32(hOpSeq + 4, Endian.little) * 0x100000000;

  // ── the JS event drain ─────────────────────────────────────────────

  /// Model JS having read every reply-heap byte the host has written —
  /// what actually happens once its event loop catches up. This is the
  /// only thing that frees space for the host's next wraparound.
  void consumeReplyHeap() {
    _d.setInt32(hReplyHeapReadPos,
        _d.getInt32(hReplyHeapWritePos, Endian.little), Endian.little);
  }

  /// Drain the event ring exactly as `bridge.js` does, including the
  /// part that matters for back-pressure: advancing `hReplyHeapReadPos`
  /// past each payload it consumes. That cursor is the ONLY thing that
  /// frees reply-heap space, so a test that skips it is testing a
  /// permanently-full heap.
  ///
  /// Pass `advanceReplyCursor: false` to model a JS side that has taken
  /// the events but is still holding their strings.
  List<FakeEvent> drainEvents({bool advanceReplyCursor = true}) {
    final out = <FakeEvent>[];
    var read = _d.getInt32(hEventReadPos, Endian.little);
    final write = _d.getInt32(hEventWritePos, Endian.little);
    while (read != write) {
      final base = kEventRingOffset + read;
      final argType = _d.getUint8(base + 1);
      final argValue = _d.getInt32(base + 8, Endian.little);
      final argOffset = _d.getInt32(base + 12, Endian.little);
      String? payload;
      // eventArgStrChunk carries a payload exactly like the others —
      // real JS reads it and advances the reply cursor before stashing
      // the part. Omitting it here left the cursor un-advanced, so the
      // heap never freed and an oversize payload stalled after two
      // chunks. A test double that under-reports what the real reader
      // consumes fails the implementation, not the code under test.
      if (argType == eventArgStr ||
          argType == eventArgJson ||
          argType == eventArgTuple ||
          argType == eventArgStrChunk) {
        payload = utf8.decode(bridge.sublist(
            kReplyHeapOff + argOffset, kReplyHeapOff + argOffset + argValue));
        if (advanceReplyCursor) {
          _d.setInt32(hReplyHeapReadPos, argOffset + argValue, Endian.little);
        }
      }
      out.add(FakeEvent(
        kind: _d.getUint8(base),
        argType: argType,
        id: _d.getInt32(base + 4, Endian.little),
        argValueI32: argValue,
        argHeapOffset: argOffset,
        payload: payload,
      ));
      read = (read + 16) % kEventRingSize;
    }
    _d.setInt32(hEventReadPos, read, Endian.little);
    return out;
  }

  // ── SkalRuntime ────────────────────────────────────────────────────

  @override
  EvalResult evaluate(String source, {String url = 'skal:eval'}) {
    evaluateCalls++;
    return EvalResult('', false);
  }

  @override
  void wakeJs() => wakeJsCalls++;

  // Native semantics: the buffer really is shared, so these are no-ops.
  @override
  void syncFromJs() {}

  @override
  void syncToJs() {}

  @override
  bool takeOpRingReset() => false;

  @override
  void markReplyHeapReset() => replyHeapResets++;

  /// Set false to model web, or a libskal predating the doorbell
  /// exports. The host must then keep ticking every vsync — see
  /// SkalRoot's `_demandDriven`.
  bool doorbellAvailable = true;

  @override
  bool enableHostNotify(void Function() callback) {
    if (!doorbellAvailable) return false;
    hostNotifyArmed = true;
    _doorbell = callback;
    return true;
  }

  @override
  void disableHostNotify() {
    hostNotifyArmed = false;
    _doorbell = null;
  }
}
