# Skal Wire — JS ↔ Compose op stream

Goal: lowest-possible-latency UI updates from a JS framework (Solid) to a
host renderer (Compose), in the same process.

## Memory layout (single shared region, mmap'd by bun's allocator)

    +──────────────────────────────────────────────────+
    │ Header                       (64 bytes)          │
    │   u64 op_seq                 (atomic, written    │
    │   u64 string_seq              by JS, read by     │
    │   u32 op_write_head           Compose each frame)│
    │   u32 op_capacity                                │
    │   u32 string_write_head                          │
    │   u32 string_capacity                            │
    │   u32 event_seq              (atomic, written    │
    │   u32 event_write_head        by Compose, read   │
    │   u32 event_capacity          by JS each tick)   │
    │   u32 event_read_head                            │
    │   pad                                            │
    +──────────────────────────────────────────────────+
    │ Op ring                  (1 MiB, 65536 16B ops)  │
    │   16 B fixed-size records:                       │
    │     u8  opcode                                   │
    │     u8  flags                                    │
    │     u16 padding                                  │
    │     u32 a                                        │
    │     u32 b                                        │
    │     u32 c                                        │
    +──────────────────────────────────────────────────+
    │ String heap             (512 KiB, append-only    │
    │   per-frame; reset on each commit)               │
    │   raw UTF-8 bytes; ops reference {offset, len}   │
    +──────────────────────────────────────────────────+
    │ Event ring                  (64 KiB, ring of     │
    │   16-byte event records: opcode, handler_id,     │
    │   x, y, payload offset/len, …)                   │
    +──────────────────────────────────────────────────+

Total: ~1.5 MiB. Pinned. Never moves. Same pointer on both sides.

## JS → Compose opcodes

    OP_NOOP           0x00
    OP_CREATE_NODE    0x01  a=node_id  b=widget_type  c=parent_id_or_0
    OP_REMOVE_NODE    0x02  a=node_id
    OP_INSERT_BEFORE  0x03  a=parent_id  b=child_id  c=anchor_id (0 = append)
    OP_SET_PROP_U32   0x10  a=node_id  b=prop_id  c=value
    OP_SET_PROP_F32   0x11  a=node_id  b=prop_id  c=u32-bitcast(f32)
    OP_SET_PROP_BOOL  0x12  a=node_id  b=prop_id  c=0|1
    OP_SET_PROP_STR   0x13  a=node_id  b=prop_id  c=string_ref (off<<16 | len ≤ 64k)
    OP_SET_TEXT       0x14  a=node_id  c=string_ref
    OP_SET_HANDLER    0x15  a=node_id  b=event_kind  c=handler_id (0 = clear)
    OP_BIND_HANDLER   0x16  a=node_id  b=event_kind  c=handler_id   ← also valid

## Widget types (kept tiny — extend by host plugins)

    WT_BOX        0
    WT_COLUMN     1
    WT_ROW        2
    WT_TEXT       3
    WT_BUTTON     4
    WT_PRESSABLE  5
    WT_TEXTINPUT  6
    WT_SCROLL     7
    WT_SPACER     8
    WT_IMAGE      9

## Prop IDs (opaque u8 enum, mapped per-widget by the host)

    P_PADDING       0x01   f32, dp
    P_BACKGROUND    0x02   u32, ARGB
    P_FOREGROUND    0x03   u32, ARGB
    P_FONT_SIZE     0x04   f32, sp
    P_FONT_WEIGHT   0x05   u32, 100..900
    P_TEXT_ALIGN    0x06   u8 in u32
    P_WIDTH         0x07   f32, dp (-1 = fill)
    P_HEIGHT        0x08   f32, dp (-1 = fill)
    P_GAP           0x09   f32, dp
    P_VALIGN        0x0a
    P_HALIGN        0x0b
    P_ENABLED       0x0c   bool
    P_KEYBOARD      0x0d
    P_VALUE         0x0e   string

Common subset across widgets keeps the host switch tight.

## Event kinds (Compose → JS)

    EV_CLICK         0x01   payload: empty
    EV_CHANGE        0x02   payload: string ref
    EV_LIFECYCLE     0x03   payload: u8 (0=mount,1=unmount,2=fg,3=bg)

## Sync model

* JS appends ops + strings, then `Atomics.add(opSeqArray, 0, 1n)` ONCE per frame.
* Compose `withFrameNanos` callback reads `op_seq`. If changed: drain the op
  ring up to `op_write_head`, reset `string_write_head`, write back the new
  read head, advance `last_seq`.
* On overflow (ring full mid-frame): JS calls `__skal_publish` early, busy-
  waits on `op_read_head` ≥ current write, then continues. With a 1 MiB ring
  this only happens for very large initial mounts.

## Event side

* Compose appends 16-byte event records to the event ring, atomic-incs
  `event_seq`. Bun's existing concurrent task queue gets a single
  EventPumpTask whose run() drains the ring and dispatches handler_ids
  on the JS thread. One JNI call per touch event regardless of how many
  events are in the ring.

## Why this is fast

* No JSON. No per-op JNI. No allocation in the hot path on either side
  (op writers use pre-allocated DataViews; readers use DirectByteBuffer).
* Solid emits minimum ops by design (fine-grained reactivity); we forward
  them as-is. There is no diff anywhere.
* Compose `mutableStateOf` per mutable prop means each `SET_PROP` triggers
  exactly one composable to recompose — Compose's recomposer skips the rest.
* Double-buffering is unnecessary because the seq counter advances atomically
  on a single store; reader either sees the previous frame fully or the new
  frame fully. The op ring writes are visible because they happen-before the
  atomic store (release-acquire pair).
