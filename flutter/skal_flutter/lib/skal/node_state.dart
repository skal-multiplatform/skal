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

import 'package:flutter/foundation.dart';

import 'indexed_child_list.dart';

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

  /// Children ids backed by a [TreapChildList] for O(log N) on every
  /// operation. Mutations go through [appendChild] / [insertChildAt] /
  /// [removeChildAt]; reads via [childCount] / [childAt] / [childIds].
  ///
  /// Why the treap: we can't know what dev workloads will look like.
  /// A `List<int>` + `Map<int,int>` is faster on append (4× at
  /// N=5000) but degrades to O(N) on insert/remove anywhere except
  /// the tail. A reorder-heavy app (drag-and-drop, sort, animated
  /// shuffle) hits an O(N²) cliff there — a 5K-item sort takes 240 ms
  /// (UI-freezing) on the list approach vs 7 ms on the treap. The 1 ms
  /// of extra append cost at scale is imperceptible; the 240 ms freeze
  /// isn't. We default to the safer choice.
  ///
  /// See lib/skal/indexed_child_list.dart for both implementations and
  /// test/indexed_child_list_test.dart for the full benchmark.
  final TreapChildList _children = TreapChildList();

  /// Number of children. O(1).
  int get childCount => _children.length;

  /// Whether this node has any children. O(1).
  bool get hasChildren => _children.length > 0;

  /// Iterable view of all child ids in order. O(N) to traverse.
  Iterable<int> get childIds => _children.items;

  /// Id at position [pos]. O(log N).
  int childAt(int pos) => _children.idAt(pos);

  /// O(log N) lookup of a child's position. Returns -1 if absent.
  int childIndexOf(int id) => _children.indexOf(id);

  /// Append [id]. O(log N).
  void appendChild(int id) => _children.append(id);

  /// Insert [id] at position [pos]. O(log N).
  void insertChildAt(int pos, int id) => _children.insertAt(pos, id);

  /// Remove the child at [pos]. O(log N).
  void removeChildAt(int pos) => _children.removeAt(pos);

  /// Drop all children. O(1) — the underlying tree is replaced.
  void clearChildren() => _children.clear();

  // ── Per-node single-value reactive fields (plain) ──────────────────
  String text = '';
  int onClickHandlerId = 0;
  int onChangeHandlerId = 0;

  // ── Cold-prop storage (non-reactive, primitive-keyed) ──────────────
  // Widgets subscribe to [cold] then read these directly. The maps
  // themselves don't fire notifications — the bridge does so via
  // `cold.notify()` once per drain after coalescing N writes.
  final Map<int, int> props = <int, int>{};
  final Map<int, double> propsF = <int, double>{};
  final Map<int, String> propsStr = <int, String>{};

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

  NodeState(this.type);

  /// Read cold props. Caller must already be inside a [cold] listener
  /// (or equivalent — e.g. inside `SkalNode`'s builder, called after
  /// `_invalidate` fired). The read is non-reactive: just a map lookup
  /// with a default.
  int getPropU32(int key, [int fallback = 0]) => props[key] ?? fallback;
  double getPropF32(int key, [double fallback = 0.0]) => propsF[key] ?? fallback;
  String? getPropStr(int key) => propsStr[key];

  void dispose() {
    cold.dispose();
    hot.dispose();
  }
}
