# Props pipeline — architecture

How props flow from JSX, through the JS-side bridge encoder, across
the shared 2 MiB region, into Flutter widgets — end to end. This is
an architecture overview; the source of truth for the wire format is
`packages/skal_flutter/lib/skal/wire.dart` and `packages/skal-js/src/bridge.js`,
which are kept in sync.

For the perf decision log see [`PERFORMANCE.md`](PERFORMANCE.md).
For the runtime/host choice see [`ENGINE_CHOICE.md`](ENGINE_CHOICE.md).

---

## 0. Goals

- **One prop change → at most one wire write.** The JS-side diff
  cache (in `bridge.js`) skips equal-value writes per prop.
- **One prop change → at most one widget rebuild.** The host side
  coalesces N writes to the same node into one `cold.notify()`.
- **Hot props don't pay for cold-prop machinery.** Animation-frequency
  props (opacity, transform) bypass the props map entirely; they
  fire a separate `hot.notify()` that only their wrapper subscribes
  to. A 60 fps opacity tween mutates one widget per frame and
  triggers zero rebuild work in the surrounding tree.
- **Zero serialization in the steady-state hot path.** Ops are
  fixed-size binary records in shared memory. No JSON, no FFI per op.

## 1. Lifecycle

```
   JSX                Solid effect     bridge.js               2 MiB ring        bridge.dart                Flutter
 ─────             ─────────────    ─────────────────────    ──────────────    ──────────────────────    ──────────────
 <button           signal write  →  setPropU32(id,        →  16-byte op    →   pumpOps decode → mutate  → setState
   bg={...}                         key, value)              record          NodeState + flag dirty +
   onClick={...}/>                  → diff cache check       in op ring      add to touched set
                                    → skip if unchanged                      end of drain: cold.notify()
                                    → write op
                                    → scheduleCommit
                                    (queueMicrotask)
                                    → commit() bumps
                                    seq counter
```

Once per frame, Flutter's Ticker fires `bridge.pumpOps()`, which:

1. Reads the published op-write position once at start
2. Iterates ops linearly (single switch on opcode byte)
3. Mutates the node's plain fields / maps in place
4. Flags the node `coldDirty` or `hotDirty`
5. Adds the node id to a `touched` set
6. At end of drain: for each touched node, fires the matching
   notifier exactly once

The notifier fan-out is what wakes Flutter's element tree: any
SkalNode whose `cold` notifier fires invalidates its cached widget
(via `MemoizingListenableBuilder`); any hot-prop notifier fires the
inner `Transform`/`Opacity` rebuild.

## 2. Wire format

Header (64 bytes):
- u64 op_seq (atomic, bumped per commit)
- u32 op_write_pos
- u32 string_write_pos
- u64 event_seq
- u32 event_write_pos
- u32 event_read_pos
- 28 bytes reserved

Op ring (1 MiB) — fixed 16-byte records:

```
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|opcode|     a   |     b   |  c  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   u8        i32       i32     i32
   (low 24 bits of the opcode field
    are always zero)
```

`opcode` selects the meaning of `a/b/c`. Examples:

| Opcode | a | b | c |
|---|---|---|---|
| OP_CREATE_NODE | node id | widget type | reserved |
| OP_INSERT_BEFORE | parent id | child id | anchor id (0 = append) |
| OP_REMOVE_NODE | node id | — | — |
| OP_SET_PROP_U32 | node id | prop key | u32 value |
| OP_SET_PROP_F32 | node id | prop key | f32 bits |
| OP_SET_PROP_STR | node id | (key << 24) \| offset | length |
| OP_SET_TEXT | node id | string offset | length |
| OP_BIND_HANDLER | node id | event kind | handler id |
| OP_SET_OPACITY | node id | — | f32 bits |
| OP_SET_TRANSLATION_X | node id | — | f32 bits |
| OP_SET_TRANSLATION_Y | node id | — | f32 bits |
| OP_SET_SCALE_X | node id | — | f32 bits |
| OP_SET_SCALE_Y | node id | — | f32 bits |
| OP_SET_ROTATION_Z | node id | — | f32 bits |

String heap (512 KiB) — UTF-8 bytes for SET_TEXT / SET_PROP_STR.
The op carries an offset + length; the host decodes via
`Uint8List.sublistView` (zero-copy view) + `utf8.decode`.

Event ring (~448 KiB) — Host → JS direction. 16-byte records with
event kind (byte 0) + handler id (bytes 4-7). On dispatch the host
bumps `event_seq` and calls `skal_wake_js` to nudge the JS worker.

Full constants:
- `packages/skal_flutter/lib/skal/wire.dart` (host side)
- `packages/skal-js/src/bridge.js` (JS side)

These MUST match value-for-value. The
`packages/skal_flutter/test/wire_test.dart` snapshot test asserts
every constant; if it fails, the JS side has drifted.

## 3. Host side — `NodeState`

```dart
class NodeState {
  final int type;

  // Tree shape (plain — only the bridge reads these)
  int parent = 0;
  final List<int> children = <int>[];

  // Single-value reactive fields (plain)
  String text = '';
  int onClickHandlerId = 0;
  int onChangeHandlerId = 0;

  // Cold-prop storage (non-reactive maps)
  final Map<int, int>    props    = {};
  final Map<int, double> propsF   = {};
  final Map<int, String> propsStr = {};

  // Hot props (plain doubles)
  double opacity = 1.0;
  double translationX = 0.0;
  double translationY = 0.0;
  double scaleX = 1.0;
  double scaleY = 1.0;
  double rotationZ = 0.0;

  // Two notification channels
  final NodeNotifier cold = NodeNotifier();
  final NodeNotifier hot  = NodeNotifier();

  // Per-drain dirty flags
  bool coldDirty = false;
  bool hotDirty  = false;
}
```

`SkalNode` widget subscribes to `node.cold` via
`MemoizingListenableBuilder` — the builder runs only when the
notifier fires; between fires the cached widget instance is reused
and Flutter's Element diff short-circuits on identity.

The hot-prop wrapper (`_HotLayer`) lives INSIDE the cached widget
and subscribes to `node.hot`. Surrounding builders never see the
hot notifier.

Source: `packages/skal_flutter/lib/skal/node_state.dart`,
`packages/skal_flutter/lib/skal/root.dart`.

## 4. JS side — encoder + diff cache

`packages/skal-js/src/bridge.js`:

- `setPropU32(nodeId, key, value)` — checks the per-node diff
  cache; if the value is unchanged, skips the wire write entirely.
  Otherwise writes a 16-byte op and bumps the write pointer.
- `setPropF32` / `setPropStr` — same pattern for the other typed
  variants. NaN sentinel for f32 (no animation value is ever NaN);
  `undefined` sentinel for strings.
- Hot props (`setOpacity`, etc.) — separate diff cache (per node ×
  6 slots), writes a dedicated opcode.

The diff cache is a flat Int32Array + Uint8Array (presence bitmap),
indexed by `nodeId → row → slot`. Rows are recycled when a node is
disposed.

`scheduleCommit` is debounced via `queueMicrotask` — Solid's effect
flush calls `setProp*` many times in one synchronous run; commit
publishes them all as ONE batch when the microtask queue drains.

## 5. Hot props (the architectural payoff)

Cold props go through:

```
JS setPropU32 → write op → host pumpOps decode →
  node.props[key] = value → node.coldDirty = true →
  end of drain: node.cold.notify() →
  SkalNode's MemoizingListenableBuilder invalidates →
  next frame: SkalNode.build() runs → widget rebuilt
```

Hot props skip everything past step 1:

```
JS setOpacity → write OP_SET_OPACITY → host pumpOps decode →
  node.opacity = value → node.hotDirty = true →
  end of drain: node.hot.notify() →
  _HotLayer's ListenableBuilder invalidates →
  next frame: builder closure re-runs → ONE Opacity widget rebuilt
```

Same number of FFI hops (zero), same number of microtask flushes,
but the host-side cost is one ListenableBuilder rebuild vs a full
SkalNode rebuild. For animation workloads this is the difference
between hitting 60 fps and dropping frames.

## 6. Prop key namespace

Keys are 1-byte u8, partitioned by tier:

| Range | Tier | Examples |
|---|---|---|
| 0x00–0x1F | layout | padding, width, height, alignment, gap |
| 0x20–0x3F | visual | bgColor, fgColor, cornerRadius, borderWidth |
| 0x40–0x5F | text | fontSize, fontWeight, textAlign, lineHeight |
| 0x60–0x7F | image | src, contentScale |
| 0x80–0x9F | input | placeholder, value, keyboardType |
| 0xA0–0xBF | behavior | enabled, focusable, visible |

Hot props live in their own opcode space (`OP_SET_OPACITY` etc.,
0x20–0x25 in the opcode namespace) so the decoder's switch
dispatches them directly without going through the cold-prop
machinery.

## 7. Sentinel values

For layout u32 props (width/height):

| Value | Meaning |
|---|---|
| -1 (`kNoValue`) | prop unset; widget falls back to default |
| 0x7FFFFFFE (`kFillMax`) | take all available space along this axis |
| 0x7FFFFFFD (`kWrapContent`) | size to intrinsic content |
| any other | literal dp value |

Sentinels are out-of-range for typical dp values (no app sets
`padding={2147483646}`), so they're safe to encode in the same
u32 slot as regular dp counts.

## 8. Invariants worth knowing

1. **CREATE_NODE precedes INSERT_BEFORE for any given node id.**
   The decoder relies on this; INSERT_BEFORE looks up the moving
   node's state to detach it from its previous parent.

2. **Auto-detach on INSERT_BEFORE.** Solid's keyed-list reorder
   relies on DOM-style insertNode semantics (moving a node by
   re-inserting it). The bridge handles this by removing the
   moving id from its previous parent's children list before
   inserting it into the new one.

3. **String ops use a 24-bit offset packed into the opcode `b`
   field.** 16 MiB addressable, way more than the 512 KiB string
   heap. The high byte of `b` holds the prop key (string ops
   cover ALL string-typed props through one opcode).

4. **The op ring is reset every commit.** Bun's `commit()` writes
   the new `op_write_pos` to the header, bumps `op_seq`, and
   resets the local write pointer back to the ring start. Lossy-
   single-buffer model: if the host doesn't drain before the next
   commit, ops are overwritten. In practice the Ticker drains
   every frame and JS commits every microtask flush, so the ring
   is empty most of the time.
