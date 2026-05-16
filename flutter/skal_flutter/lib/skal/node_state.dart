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
  final IndexedChildList _children;

  /// Number of children. O(1).
  int get childCount => _children.length;

  /// Whether this node has any children. O(1).
  bool get hasChildren => _children.length > 0;

  /// Iterable view of all child ids in order. O(N) to traverse.
  Iterable<int> get childIds => _children.items;

  /// Id at position [pos]. Cost depends on this node's widget type:
  /// O(1) for list-backed nodes / O(log N) for reorderable list.
  int childAt(int pos) => _children.idAt(pos);

  /// Lookup of a child's position. Returns -1 if absent.
  /// O(1) for list-backed / O(log N) for reorderable list.
  int childIndexOf(int id) => _children.indexOf(id);

  /// Append [id]. O(1) amortized for list-backed / O(log N) for
  /// reorderable list.
  void appendChild(int id) => _children.append(id);

  /// Insert [id] at position [pos]. O(N − pos) for list-backed /
  /// O(log N) for reorderable list.
  void insertChildAt(int pos, int id) => _children.insertAt(pos, id);

  /// Remove the child at [pos]. O(N − pos) for list-backed /
  /// O(log N) for reorderable list.
  void removeChildAt(int pos) => _children.removeAt(pos);

  /// Drop all children. O(N) — see [IndexedChildList.clear] for the
  /// Map.clear cost. Subtree-teardown path; not per-frame.
  void clearChildren() => _children.clear();

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
  final Map<int, int> props = <int, int>{};
  final Map<int, double> propsF = <int, double>{};
  final Map<int, String> propsStr = <int, String>{};

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
  final NodeNotifier cold = NodeNotifier();
  final NodeNotifier hot  = NodeNotifier();

  // ── Per-drain dirty flags ──────────────────────────────────────────
  // Set true by ops in pumpOps, consumed + cleared by the end-of-drain
  // coalescing loop. Plain bools the bridge reads/writes synchronously.
  bool coldDirty = false;
  bool hotDirty  = false;

  NodeState(this.type) : _children = _backingFor(type);

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
  int getPropU32(int key, [int fallback = 0]) => props[key] ?? fallback;
  double getPropF32(int key, [double fallback = 0.0]) => propsF[key] ?? fallback;
  String? getPropStr(int key) => propsStr[key];

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
