// Per-node reactive state.
//
// Each node has TWO ChangeNotifier channels:
//
//   - [cold]  fires once per drain if anything that affects this
//             node's built widget tree changed: text, any cold prop,
//             children list, handler ids. The SkalNode widget
//             subscribes here — invalidates its cached build.
//
//   - [hot]   fires once per drain if any hot prop (opacity,
//             translate, scale, rotate) changed. Only the
//             Transform/Opacity wrapper inside the cached widget
//             subscribes — the surrounding tree never sees it fire.
//
// The split is the architectural payoff for animation workloads. A
// 60 fps opacity tween mutates `hot` 60×/sec and rebuilds exactly one
// Opacity widget; the rest of the node's widget subtree stays cached
// because cold never fires. Without the split, every hot-prop write
// would invalidate the whole node's build.
//
// All actual data is plain fields / Maps. Widgets read them directly
// inside their builder callback. The notifier is just a "something
// here changed, recompute" signal.
//
// End-of-drain coalescing: pumpOps sets `coldDirty` / `hotDirty`
// flags per write, adds the node to a touched set, and at end of
// drain fires the appropriate notifier once per touched node. N prop
// writes on the same node → 1 fan-out.

import 'dart:async';

import 'package:flutter/foundation.dart';

import 'indexed_child_list.dart';
import 'wire.dart';

/// Dispatcher for JS → Dart RPC method invocations. Receives the
/// method name + the decoded args list (in declaration order — ints
/// stay ints, f32s become doubles, bools become bools). Returns
/// either the result directly (for sync methods) or a Future that
/// resolves to it (for async). The bridge encodes the result into
/// an EV_METHOD_REPLY event addressed back to JS by callId.
///
/// Type signature is intentionally untyped: a single dispatcher per
/// node demultiplexes ALL the node's exposed methods. Codegen emits
/// a switch on methodName that calls the right controller method
/// with the right typed args.
typedef SkalMethodDispatcher = FutureOr<Object?> Function(
  String methodName,
  List<Object?> args,
);

/// ChangeNotifier with a public `notify()` — Flutter's default
/// `notifyListeners` is @protected. One-line subclass so the bridge's
/// end-of-drain loop can fire it from outside the class. Public
/// (rather than `_NodeNotifier`) because [NodeState.cold] /
/// [NodeState.hot] expose it as their static type.
class NodeNotifier extends ChangeNotifier {
  void notify() => notifyListeners();
}

class NodeState {
  /// Widget type (one of `wt*` constants). Immutable for a node's
  /// lifetime — CREATE_NODE picks the type, never changes after.
  final int type;

  // ── Tree shape (plain — only the bridge reads these) ───────────────
  /// Parent id. Used by INSERT_BEFORE / REMOVE_NODE to detach the
  /// moving node from its old parent's children list.
  int parent = 0;

  /// Children ids. Backing is picked at construct time from the
  /// widget [type] — the dev signals their mutation pattern by which
  /// widget they reach for, and the bridge provisions accordingly:
  ///
  ///   • [wtReorderableListView] → [TreapChildList]
  ///       O(log N) on every op. Pay the constant-factor overhead
  ///       only for nodes that actually mutate at random positions
  ///       (drag-and-drop, animated shuffle, live reorder).
  ///
  ///   • everything else → [ListChildList]
  ///       O(1) append + indexOf, O(N − pos) insert/remove. Wins on
  ///       constant factors AND memory (~2.8× lighter than a treap
  ///       node). The vast majority of nodes — every `<column>`,
  ///       `<row>`, `<button>`, plus append-only `<listView>` feeds
  ///       — sit on this path forever.
  ///
  /// This split mirrors Flutter's own `ListView` / `ReorderableListView`
  /// API gap, with the same trade-off: explicit at the call site,
  /// zero runtime adaptivity overhead. See
  /// `test/indexed_child_list_test.dart` for the head-to-head bench
  /// that motivated the split.
  /// Lazy. A leaf node — most of the tree — never inserts a child, and
  /// a ListChildList carries both a List and an index Map, so eagerly
  /// building one per node cost two objects apiece for nothing.
  IndexedChildList? _children;

  /// The backing, creating it on first insertion.
  IndexedChildList get _kids => _children ??= _backingFor(type);

  /// Number of children. O(1).
  int get childCount => _children?.length ?? 0;

  /// Whether this node has any children. O(1).
  bool get hasChildren => (_children?.length ?? 0) > 0;

  /// Iterable view of all child ids in order. O(N) to traverse.
  Iterable<int> get childIds => _children?.items ?? const <int>[];

  /// Id at position [pos]. Cost depends on this node's widget type:
  /// O(1) for list-backed nodes / O(log N) for reorderable list.
  int childAt(int pos) => _kids.idAt(pos);

  /// Lookup of a child's position. Returns -1 if absent.
  /// O(1) for list-backed / O(log N) for reorderable list.
  int childIndexOf(int id) => _children?.indexOf(id) ?? -1;

  /// Append [id]. O(1) amortized for list-backed / O(log N) for
  /// reorderable list.
  void appendChild(int id) => _kids.append(id);

  /// Insert [id] at position [pos]. O(N − pos) for list-backed /
  /// O(log N) for reorderable list.
  void insertChildAt(int pos, int id) => _kids.insertAt(pos, id);

  /// Remove the child at [pos]. O(N − pos) for list-backed /
  /// O(log N) for reorderable list.
  void removeChildAt(int pos) => _children?.removeAt(pos);

  /// Drop all children. O(N) — see [IndexedChildList.clear] for the
  /// Map.clear cost. Subtree-teardown path; not per-frame.
  void clearChildren() => _children?.clear();

  // ── Builder-mode `<listView>` (propItemCount + evRowRequest) ───────
  // All nullable/zero-cost — only lists that actually opt into builder
  // mode allocate them. Rows live HERE, keyed by index, instead of in
  // [_children]: the map is sparse (only the materialized window), and
  // eviction is a key removal + subtree teardown.

  /// Materialized rows: virtual index → subtree-root node id. Null on
  /// every non-builder node.
  Map<int, int>? builderRows;

  /// Missing indices this frame's layout touched, dispatched (deduped)
  /// as ONE evRowRequest per frame. Frame-scoped — cleared on dispatch,
  /// not a permanent dedupe — so a still-missing row is re-requested on
  /// the next rebuild rather than getting stuck if JS never delivered.
  Set<int>? pendingRows;
  bool rowRequestScheduled = false;

  /// Measured main-axis extent (dp) per row laid out at least once, so a
  /// placeholder for a revisited row is extent-perfect (no scroll-back
  /// jump). Pruned to indices < count on a count change. Never-seen rows
  /// are sized from [meanRowExtent].
  ///
  /// Private so every write goes through [recordRowExtent],
  /// [clearRowExtents] and [dropRowExtentsFrom], which keep the running
  /// total and count in step with it; read through [rowExtentOf].
  Map<int, double>? _rowExtents;

  /// Sum and count of the NON-ZERO extents in [_rowExtents], maintained
  /// on every write so the mean is O(1). A placeholder asks for it once
  /// per build, and summing the map there would be O(measured rows) per
  /// placeholder per frame.
  double _rowExtentTotal = 0;
  int _rowExtentCount = 0;

  /// At least the highest index in [_rowExtents] (-1 when empty) — an upper
  /// bound, not exact after a drop — so [dropRowExtentsFrom] can skip its
  /// walk when the list only grew.
  int _rowExtentMaxIndex = -1;

  /// Row [index]'s measured extent, or null if it was never laid out.
  double? rowExtentOf(int index) => _rowExtents?[index];

  /// Record row [index]'s laid-out extent. Returns true when
  /// [meanRowExtent] goes from null to a value — the moment the list's
  /// look-ahead waits for.
  ///
  /// Called from layout, so the unchanged case — every relayout of a row
  /// that did not resize — is a map lookup and nothing else.
  bool recordRowExtent(int index, double extent) {
    final m = _rowExtents ??= <int, double>{};
    final old = m[index];
    if (old == extent) return false;
    final hadMean = _rowExtentCount > 0;
    if (old != null && old > 0) {
      _rowExtentTotal -= old;
      _rowExtentCount--;
    }
    if (extent > 0) {
      _rowExtentTotal += extent;
      _rowExtentCount++;
    }
    m[index] = extent;
    if (index > _rowExtentMaxIndex) _rowExtentMaxIndex = index;
    // Re-anchor rather than carry rounding drift into an empty mean.
    if (_rowExtentCount == 0) _rowExtentTotal = 0;
    return !hadMean && _rowExtentCount > 0;
  }

  /// Mean extent of the rows measured so far at more than zero, or null
  /// before the first such row.
  ///
  /// What an unbuilt row's placeholder is sized from. A fixed 48 dp was
  /// a poor guess for a feed whose rows run 150-700 dp: a fling into
  /// unmeasured territory crossed ~5x more placeholders per screen than
  /// it would rows, so the list asked JS for ~5x the rows that would
  /// ever fit, and the scroll extent jumped as the real ones landed.
  ///
  /// Zero-extent rows are left out because they are almost always not
  /// yet what they will be — a row whose data is still loading renders
  /// nothing, an image-only row is 0 dp until it decodes — and a mean of
  /// zero would size every placeholder at zero, so a single viewport
  /// fill would ask JS for every remaining row in one frame. Such a row
  /// still has its own exact (zero) extent in [rowExtentOf].
  double? get meanRowExtent =>
      _rowExtentCount == 0 ? null : _rowExtentTotal / _rowExtentCount;

  /// Forget every measurement — the row count was cleared.
  void clearRowExtents() {
    _rowExtents?.clear();
    _rowExtentTotal = 0;
    _rowExtentCount = 0;
    _rowExtentMaxIndex = -1;
  }

  /// Forget measurements at indices >= [count] — the list shrank, and
  /// those rows (if they exist again) hold different data.
  void dropRowExtentsFrom(int count) {
    final m = _rowExtents;
    // Nothing measured at or past the new count: the list grew (every
    // page of an infinite scroll), and walking every measured row to find
    // nothing to drop would be O(rows ever measured) per page.
    if (m == null || count > _rowExtentMaxIndex) return;
    _rowExtentMaxIndex = count - 1;
    m.removeWhere((k, v) {
      if (k < count) return false;
      if (v > 0) {
        _rowExtentTotal -= v;
        _rowExtentCount--;
      }
      return true;
    });
    if (_rowExtentCount == 0) _rowExtentTotal = 0;
  }

  /// `evRowRequest` handler id — bound by the renderer when JSX passes
  /// `renderItem`. Non-zero (with propItemCount present) switches
  /// `_buildListView` to the pull-based builder path. Zeroed on removal
  /// so a pending post-frame request for a torn-down list is dropped.
  int onRowRequestHandlerId = 0;

  /// `<animatedList>` only — children that JS removed but which the
  /// bridge kept alive for their exit animation (ANIMATION.md §6).
  /// Maps the leaving child id → the list index it occupied at
  /// removal. `null` on every other node. Populated by the
  /// deferred-teardown branch of `opRemoveNode`; an entry is dropped
  /// (and the subtree finally torn down) by `finalizeLeavingNode` once
  /// `_SkalAnimatedList` reports the exit animation finished.
  Map<int, int>? leavingChildren;

  // ── Per-node single-value reactive fields (plain) ──────────────────
  String text = '';

  /// A text node the renderer made itself (`createTextNode`: a string
  /// child, or a slot marker) rather than a `<text>` element. Set once,
  /// from opCreateNode's [kCreateAnonText] flag. See [isSlotMarker].
  bool anonymousText = false;

  /// An empty text node the renderer made itself: lays out as nothing,
  /// so it takes no space and no gap in its parent (see
  /// `_laidOutChildWidgets` in root.dart), and is not an item of the
  /// builders that index their children (tabs, pages, grid cells…).
  ///
  /// This is mostly Solid's slot marker. `{cond ? <X/> : null}` (or a
  /// `<Show>` / `<For>` with nothing to show) among siblings leaves an
  /// empty text node behind as the insertion anchor, and the DOM, which
  /// Solid's semantics come from, never lays out an empty text run.
  /// Rendered as a `Text('')` it was one full line tall plus a gap: a
  /// text-only post of the bench feed measured 235.0 dp with it and
  /// 205.9 dp without, on the Galaxy A14.
  ///
  /// So is a string child that is empty (`{''}`, `{name()}` while it is
  /// ''): Solid makes both through the same `createTextNode`, and the DOM
  /// lays out neither.
  ///
  /// An empty `<text label="">` is not one. The app wrote it — an error
  /// line keeping its space, a status that fades in — so it keeps its
  /// line, as it always did. Host-side the two are otherwise identical,
  /// which is why the renderer flags the one it makes.
  ///
  /// Only `opSetText` changes [text], and it re-dirties the parent when
  /// this flips, because the parent is what acts on it.
  bool get isSlotMarker => anonymousText && text.isEmpty;

  int onClickHandlerId = 0;
  int onChangeHandlerId = 0;
  // Gesture handlers for container behavior props (`<box onLongPress=…
  // onDoubleTap=…>`). `onTap` reuses [onClickHandlerId].
  int onLongPressHandlerId = 0;
  int onDoubleTapHandlerId = 0;
  // `<textInput onSubmit=…>` — fired on Enter / done key.
  int onSubmitHandlerId = 0;
  // `<reorderableListView onReorder=…>` — fired when a drag completes.
  int onReorderHandlerId = 0;
  // `<navigator onPop=…>` — fired on a gesture / system-back pop.
  int onPopHandlerId = 0;
  // `<listView onRefresh=…>` — pull-to-refresh. While the spinner is
  // up, [refreshCompleter] holds the Future the host's RefreshIndicator
  // is awaiting; JS resolves it via opCompleteRefresh.
  int onRefreshHandlerId = 0;
  Completer<void>? refreshCompleter;
  // `<dismissible onDismiss=…>` — fired when the child is swiped away.
  // [dismissed] latches true on dismissal so a rebuild before the JS
  // app drops the node renders nothing (Flutter asserts a dismissed
  // `Dismissible` must leave the tree).
  int onDismissHandlerId = 0;
  bool dismissed = false;
  // `<dropZone onDrop=…>` — fired when a `<dragItem>` is released over
  // this zone; the arg is the item's `propDragData` string.
  int onDropHandlerId = 0;
  // `<box onHover=…>` — pointer enter / exit (MouseRegion); the arg is
  // a bool (true on enter, false on exit).
  int onHoverHandlerId = 0;
  // `<box onKey=…>` — key pressed while focused; the arg is a
  // normalized combo string ("meta+s", "escape", "arrow up").
  int onKeyHandlerId = 0;
  // Pan / drag gesture handlers (`<box onPanStart=… onPanUpdate=…
  // onPanEnd=…>`). onPanUpdate dispatches a (dx, dy) delta every drag
  // frame; with `draggable` set the host self-drives translation and
  // onPanUpdate is suppressed (only start/end fire). See _applyGestures.
  int onPanStartHandlerId = 0;
  int onPanUpdateHandlerId = 0;
  int onPanEndHandlerId = 0;
  // Pinch-scale gesture handlers. onScaleUpdate dispatches a
  // (scale, rotation) pair. Mutually exclusive with pan on one node —
  // when both are bound, scale recognizers win.
  int onScaleStartHandlerId = 0;
  int onScaleUpdateHandlerId = 0;
  int onScaleEndHandlerId = 0;

  // ── Cold-prop storage (non-reactive, primitive-keyed) ──────────────
  // Widgets subscribe to [cold] then read these directly. The maps
  // themselves don't fire notifications — the bridge does so via
  // `cold.notify()` once per drain after coalescing N writes.
  /// All three are lazy. A node is created before any prop reaches it,
  /// and most nodes only ever touch ONE of the three lanes — so eagerly
  /// building all three cost three maps per node to hold, typically,
  /// one map's worth of data.
  ///
  /// Measured over 200k nodes: constructing them eagerly took 373 ms
  /// against 61 ms lazily, and even the warm write path got 24% FASTER,
  /// because the null check is cheaper than keeping six live sub-objects
  /// per node alive for the GC to walk.
  Map<int, int>? _props;
  Map<int, double>? _propsF;
  Map<int, String>? _propsStr;

  /// Write lanes — used by the op drain.
  void setPropU32(int key, int value) => (_props ??= <int, int>{})[key] = value;
  void setPropF32(int key, double value) =>
      (_propsF ??= <int, double>{})[key] = value;
  void setPropStr(int key, String value) =>
      (_propsStr ??= <int, String>{})[key] = value;

  /// Drop `key` from every lane. The three are insert-only and
  /// independently lived, so a stale slot in one would shadow the
  /// default a reader gets from another — see `opClearProp`.
  void removeProp(int key) {
    _props?.remove(key);
    _propsF?.remove(key);
    _propsStr?.remove(key);
  }

  /// Presence checks, per lane. Distinguish "absent" from "set to
  /// something falsy" — which is what `opClearProp` has to get right.
  bool hasPropU32(int key) => _props?.containsKey(key) ?? false;
  bool hasPropF32(int key) => _propsF?.containsKey(key) ?? false;
  bool hasPropStr(int key) => _propsStr?.containsKey(key) ?? false;

  /// Raw u32 lookup, null when unset. For callers that must tell
  /// "absent" from "set to the fallback".
  int? rawPropU32(int key) => _props?[key];

  // ── Custom-widget storage (string-keyed, lazy) ─────────────────────
  // Populated only for nodes whose `type == wtCustom`. Each node carries
  // its registry name in [customWidgetName] (the registry key the host
  // dispatches to) plus four optional name-keyed maps. Lazy because
  // 99% of nodes are built-in widgets and would carry empty maps for no
  // reason — see the docstring on each field.
  //
  // Reads use [getCustomPropU32] / F32 / Str / Handler with fallbacks
  // so adapters can be written without null-checking each prop.
  String? customWidgetName;
  Map<String, int>? _customPropsU32;
  Map<String, double>? _customPropsF32;
  Map<String, String>? _customPropsStr;
  Map<String, int>? _customHandlers;

  // ── Hot props (plain — Hot notifier fires on any of them) ──────────
  double opacity      = 1.0;
  double translationX = 0.0;
  double translationY = 0.0;
  double scaleX       = 1.0;
  double scaleY       = 1.0;
  double rotationZ    = 0.0;

  // ── The two notifiers ──────────────────────────────────────────────
  /// Lazy, and created by the SUBSCRIBER rather than the producer: a
  /// widget that listens gets one, a node nobody is watching never
  /// allocates either. [notifyCold] / [notifyHot] are what the drain
  /// calls, and they skip entirely when no listener has ever appeared —
  /// which is the common case for the interior of a large tree.
  NodeNotifier? _cold;
  NodeNotifier? _hot;

  NodeNotifier get cold => _cold ??= NodeNotifier();
  NodeNotifier get hot => _hot ??= NodeNotifier();

  /// Fire the cold lane if anyone is listening. Never allocates.
  void notifyCold() => _cold?.notify();

  /// Fire the hot (animation) lane if anyone is listening.
  void notifyHot() => _hot?.notify();

  // ── Per-drain dirty flags ──────────────────────────────────────────
  // Set true by ops in pumpOps, consumed + cleared by the end-of-drain
  // coalescing loop. Plain bools the bridge reads/writes synchronously.
  bool coldDirty = false;
  bool hotDirty  = false;

  /// Has a hot prop ever reached this node?
  ///
  /// One-way latch, set by the drain on the first opacity / translation
  /// / scale / rotation op. `_hotLayer()` reads it to decide whether the
  /// node needs a `ListenableBuilder` on [hot] at all — most nodes are
  /// static and never animate, and that wrapper measured +32% on a
  /// 2000-node build (~8 us each, debug).
  ///
  /// A plain bool, deliberately: the reason the wrapper used to be
  /// unconditional is that deciding from the hot VALUES would mean
  /// reading them in the outer build, which subscribes the outer build
  /// to them and defeats the whole hot/cold split. Reading a bool
  /// subscribes to nothing.
  ///
  /// Never cleared. A node that animated once keeps its layer, so the
  /// tree shape stops changing after first use rather than oscillating.
  bool everHot = false;

  NodeState(this.type);

  /// Pick the children-list backing based on the widget type. Done
  /// once at construct time — no runtime adaptivity, no per-mutation
  /// type check, no promotion event. The widget IS the signal.
  static IndexedChildList _backingFor(int type) {
    if (type == wtReorderableListView) return TreapChildList();
    return ListChildList();
  }

  /// Read cold props. Caller must already be inside a [cold] listener
  /// (or equivalent — e.g. inside `SkalNode`'s builder, called after
  /// `_invalidate` fired). The read is non-reactive: just a map lookup
  /// with a default.
  int getPropU32(int key, [int fallback = 0]) => _props?[key] ?? fallback;
  double getPropF32(int key, [double fallback = 0.0]) =>
      _propsF?[key] ?? fallback;
  String? getPropStr(int key) => _propsStr?[key];

  // ── Custom-prop accessors (string-keyed, used only by registry-built
  //    widgets) ───────────────────────────────────────────────────────
  //
  // The four reads return whatever the bridge last wrote for that name
  // on this node, or [fallback] if nothing was written. The setters
  // lazy-allocate their backing map on first write — keeps NodeState
  // small for built-in widgets that never touch these.

  int getCustomPropU32(String name, [int fallback = 0]) =>
      _customPropsU32?[name] ?? fallback;
  double getCustomPropF32(String name, [double fallback = 0.0]) =>
      _customPropsF32?[name] ?? fallback;
  String? getCustomPropStr(String name) => _customPropsStr?[name];
  int getCustomHandler(String name) => _customHandlers?[name] ?? 0;

  // Nullable variants — return null when the prop was never written
  // (the JSX consumer omitted it), as opposed to coercing to a zero
  // fallback. Codegen uses these for NULLABLE constructor params
  // (`double? tileSize`, `int? maxLines`, `bool? softWrap`) where the
  // wrapped widget treats null distinctly from 0 — e.g. flutter_map's
  // TileLayer falls back to `tileDimension` only when `tileSize` is
  // null, and divides by `tileSize.toInt()` (→ 0 → Infinity) if it
  // isn't. The backing maps already key-miss to null; these just
  // expose that without the `?? fallback` the non-null getters apply.
  double? getCustomPropF32OrNull(String name) => _customPropsF32?[name];
  int? getCustomPropU32OrNull(String name) => _customPropsU32?[name];
  bool? getCustomPropBoolOrNull(String name) {
    final v = _customPropsU32?[name];
    return v == null ? null : v != 0;
  }

  void setCustomPropU32(String name, int value) {
    (_customPropsU32 ??= <String, int>{})[name] = value;
  }
  void setCustomPropF32(String name, double value) {
    (_customPropsF32 ??= <String, double>{})[name] = value;
  }
  void setCustomPropStr(String name, String value) {
    (_customPropsStr ??= <String, String>{})[name] = value;
  }

  /// Remove [name] from every typed custom-prop map. Fired by
  /// [opClearCustomProp] when the JS side detects a value-TYPE change
  /// for a prop — the maps are insert-only otherwise, and a stale
  /// entry in one map shadows fresher writes in another for readers
  /// that probe a preferred slot first (`width={cond ? 'fill' : 300}`
  /// would stick at 300 forever).
  void clearCustomProp(String name) {
    _customPropsU32?.remove(name);
    _customPropsF32?.remove(name);
    _customPropsStr?.remove(name);
  }
  void setCustomHandler(String name, int handlerId) {
    (_customHandlers ??= <String, int>{})[name] = handlerId;
  }

  /// Dispatcher for JS → Dart RPC method invocations on this node.
  /// The synthesized host adapter (see codegen's `_emitHostAdapter`)
  /// registers a closure that knows the controller's method surface.
  /// Bridge looks this up when an opInvokeMethod arrives and calls
  /// `dispatcher(methodName, args)`; the result (or its Future) is
  /// written back to JS via the event ring as evMethodReply.
  ///
  /// Null until the host's State.initState() registers it — invokes
  /// before then surface as `EV_METHOD_ERROR` ("no method dispatcher
  /// registered").
  SkalMethodDispatcher? methodDispatcher;

  /// Iterate every (name, value) pair written by the bridge for this
  /// custom node. Useful for adapters that want to inspect their full
  /// prop bag (e.g. to forward unknown props to a generic config
  /// object). Returns the live map — don't mutate during iteration.
  Map<String, int>? get customPropsU32 => _customPropsU32;
  Map<String, double>? get customPropsF32 => _customPropsF32;
  Map<String, String>? get customPropsStr => _customPropsStr;
  Map<String, int>? get customHandlers => _customHandlers;

  void dispose() {
    cold.dispose();
    hot.dispose();
  }
}
