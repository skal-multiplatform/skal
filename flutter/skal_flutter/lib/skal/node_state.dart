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

  /// Children ids. Mutated in place by pumpOps for zero allocation
  /// per insert. Widgets read this list inside the cold-notifier
  /// listener (so subscriptions are right) and re-emit child SkalNode
  /// widgets in order, each keyed by id.
  ///
  /// MUTATIONS MUST GO THROUGH [appendChild] / [insertChildAt] /
  /// [removeChildAt]. Those keep the parallel [_childIdx] map in sync
  /// so [childIndexOf] is O(1) — the bridge's INSERT_BEFORE /
  /// auto-detach paths call indexOf once per move, and an O(N) scan
  /// per call becomes O(N²) cumulative on big reorders (e.g. sorting
  /// a 5000-tweet list). Reads via index / iteration are unchanged.
  final List<int> children = <int>[];

  /// id → position in [children]. Maintained by [appendChild],
  /// [insertChildAt], [removeChildAt]. Lookup is O(1).
  final Map<int, int> _childIdx = <int, int>{};

  /// O(1) lookup of a child's position in [children]. Returns -1 if the
  /// id is not a child of this node.
  int childIndexOf(int id) => _childIdx[id] ?? -1;

  /// Append [id] to [children]. O(1).
  void appendChild(int id) {
    _childIdx[id] = children.length;
    children.add(id);
  }

  /// Insert [id] into [children] at [pos]. O(N − pos) — the tail
  /// shifts (native memmove in Dart's `List<int>.insert`) and the
  /// shifted entries are re-indexed in [_childIdx]. Typical UI inserts
  /// are near the tail, so this is fast in practice.
  void insertChildAt(int pos, int id) {
    children.insert(pos, id);
    for (int i = pos; i < children.length; i++) {
      _childIdx[children[i]] = i;
    }
  }

  /// Remove the child at [pos]. O(N − pos), same shape as
  /// [insertChildAt].
  void removeChildAt(int pos) {
    final removedId = children[pos];
    children.removeAt(pos);
    _childIdx.remove(removedId);
    for (int i = pos; i < children.length; i++) {
      _childIdx[children[i]] = i;
    }
  }

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
