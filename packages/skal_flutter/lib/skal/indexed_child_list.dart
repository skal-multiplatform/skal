// Two implementations of an ordered, id-indexed sequence of ints.
//
// Both expose the same five operations the bridge's INSERT_BEFORE /
// auto-detach / drain paths need:
//
//   append(id)           — add at end
//   insertAt(pos, id)    — insert at index pos
//   removeAt(pos)        — remove at index pos
//   indexOf(id) -> int   — return position of id (or -1)
//   idAt(pos) -> int     — return id at position
//
// NodeState picks its backing at construct time based on the widget
// type (see `node_state.dart`):
//
//   • [wtReorderableListView] → [TreapChildList]
//       Drag-and-drop / mid-list mutation pattern. O(log N) anywhere.
//
//   • everything else → [ListChildList]
//       Append-only or read-mostly. O(1) append + indexOf, O(N − pos)
//       insert/remove. Wins on constant factors + memory for the >99%
//       of nodes that hold a handful of children.
//
// Both impls are exported so `test/indexed_child_list_test.dart` can
// run the correctness equivalence + side-by-side benchmark against them.

import 'dart:math' as math;

/// Common interface so the benchmark and correctness tests can run the
/// same operations against both implementations.
abstract class IndexedChildList {
  int get length;

  /// Append [id] at the end. O(1) for ListChildList, O(log N) for treap.
  void append(int id);

  /// Insert [id] at position [pos]. Items at pos.. shift right.
  /// O(N − pos) for list, O(log N) for treap.
  void insertAt(int pos, int id);

  /// Remove the item at position [pos]. Items at pos+1.. shift left.
  /// O(N − pos) for list, O(log N) for treap.
  void removeAt(int pos);

  /// Position of [id], or -1 if absent. O(1) for list (Map lookup),
  /// O(log N) for treap (Map lookup + parent walk).
  int indexOf(int id);

  /// Id at position [pos]. O(1) for list (Array index), O(log N) for
  /// treap (size-annotated tree descent).
  int idAt(int pos);

  /// Sequential iteration of all ids in order. O(N) either way.
  Iterable<int> get items;

  /// Drop all entries. O(N) for both impls — the tree/list itself is
  /// dropped in O(1) (just releases the root reference for GC), but
  /// both impls also clear an id→position / id→node Map alongside,
  /// and Dart's Map.clear walks every entry. Not on any hot path —
  /// happens during subtree teardown, not per frame.
  void clear();
}

/// Map-backed implementation:
///   - `List<int>` for items in order, native O(1) random access and
///     native memmove for insert/remove (very fast for typical N).
///   - `Map<int, int>` mirroring id → position, eagerly maintained on
///     insert/remove so [indexOf] is O(1).
///
/// Operation costs:
///   append           O(1) amortized
///   insertAt(pos)    O(N − pos)   — list shift + reindex of moved tail
///   removeAt(pos)    O(N − pos)   — same shape
///   indexOf          O(1)         — Map lookup
///   idAt             O(1)         — List index
///
/// In practice (Dart AOT, native memmove ~10 GB/s) inserts/removes are
/// dominated by the Map reindex loop, not the list shift. For N < 100K
/// this beats the treap because of constant factors.
class ListChildList implements IndexedChildList {
  final List<int> _list = <int>[];
  final Map<int, int> _idx = <int, int>{};

  @override
  int get length => _list.length;

  @override
  void append(int id) {
    _idx[id] = _list.length;
    _list.add(id);
  }

  @override
  void insertAt(int pos, int id) {
    _list.insert(pos, id);
    for (int i = pos; i < _list.length; i++) {
      _idx[_list[i]] = i;
    }
  }

  @override
  void removeAt(int pos) {
    final removed = _list[pos];
    _list.removeAt(pos);
    _idx.remove(removed);
    for (int i = pos; i < _list.length; i++) {
      _idx[_list[i]] = i;
    }
  }

  @override
  int indexOf(int id) => _idx[id] ?? -1;

  @override
  int idAt(int pos) => _list[pos];

  @override
  Iterable<int> get items => _list;

  @override
  void clear() {
    _list.clear();
    _idx.clear();
  }
}

/// Order-statistic treap. Every operation is O(log N) expected. The
/// tree is structured by *position* (subtree sizes), with random
/// priorities providing expected-balanced shape (E[height] ≈ 1.44 log₂ N).
///
/// A side `Map<int, _Node>` lets [indexOf] start at the target node and
/// walk *up* via parent pointers to root, summing left-subtree sizes
/// when we come up from a right child — yielding the position in
/// O(log N) without ever scanning siblings.
///
/// Operation costs:
///   append           O(log N) — tree descent + sift-up via merge
///   insertAt(pos)    O(log N) — split + merge
///   removeAt(pos)    O(log N) — two splits + one merge
///   indexOf          O(log N) — map lookup + parent walk
///   idAt             O(log N) — size-annotated descent
///
/// Beats [ListChildList] for reorder-heavy workloads at large N
/// (~5000+) where the O(N − pos) tail-shift dominates. Loses for
/// append-only mounts and small N because of per-operation overhead
/// (tree allocations, random number gen, recursion).
class TreapChildList implements IndexedChildList {
  _TreapNode? _root;
  final Map<int, _TreapNode> _byId = <int, _TreapNode>{};

  // Seeded RNG: deterministic priorities for reproducible benchmarks.
  // For production use the priorities only affect tree balance, not
  // correctness — randomness from a default Random() is fine.
  static final math.Random _rng = math.Random(0x5ca1ab1e);

  @override
  int get length => _root?.size ?? 0;

  @override
  void append(int id) => insertAt(length, id);

  @override
  void insertAt(int pos, int id) {
    final node = _TreapNode(id, _rng.nextInt(0x40000000));
    _byId[id] = node;
    final parts = _split(_root, pos);
    final left = parts[0];
    final right = parts[1];
    _root = _merge(_merge(left, node), right);
    if (_root != null) _root!.parent = null;
  }

  @override
  void removeAt(int pos) {
    final p1 = _split(_root, pos);
    final left = p1[0];
    final p2 = _split(p1[1], 1);
    final mid = p2[0];
    final right = p2[1];
    if (mid != null) _byId.remove(mid.id);
    _root = _merge(left, right);
    if (_root != null) _root!.parent = null;
  }

  @override
  int indexOf(int id) {
    final node = _byId[id];
    if (node == null) return -1;
    int p = node.left?.size ?? 0;
    var cur = node;
    while (cur.parent != null) {
      if (identical(cur.parent!.right, cur)) {
        p += (cur.parent!.left?.size ?? 0) + 1;
      }
      cur = cur.parent!;
    }
    return p;
  }

  @override
  int idAt(int pos) {
    var n = _root;
    while (n != null) {
      final ls = n.left?.size ?? 0;
      if (pos < ls) {
        n = n.left;
      } else if (pos == ls) {
        return n.id;
      } else {
        pos -= ls + 1;
        n = n.right;
      }
    }
    throw RangeError('idAt($pos): out of bounds for length=$length');
  }

  @override
  void clear() {
    _root = null;
    _byId.clear();
  }

  @override
  Iterable<int> get items sync* {
    // Iterative in-order traversal, no recursion (avoids stack growth
    // on huge trees) and no allocations beyond the worklist.
    final stack = <_TreapNode>[];
    var cur = _root;
    while (cur != null || stack.isNotEmpty) {
      while (cur != null) {
        stack.add(cur);
        cur = cur.left;
      }
      cur = stack.removeLast();
      yield cur.id;
      cur = cur.right;
    }
  }

  // Split tree rooted at [t] into [first-`k`, rest]. The returned
  // pair's roots have no parent set; the caller assigns them as
  // children (or as the new root) and parent pointers get fixed up
  // there.
  List<_TreapNode?> _split(_TreapNode? t, int k) {
    if (t == null) return const [null, null];
    final ls = t.left?.size ?? 0;
    if (k <= ls) {
      final sub = _split(t.left, k);
      t.left = sub[1];
      if (t.left != null) t.left!.parent = t;
      _update(t);
      return [sub[0], t];
    } else {
      final sub = _split(t.right, k - ls - 1);
      t.right = sub[0];
      if (t.right != null) t.right!.parent = t;
      _update(t);
      return [t, sub[1]];
    }
  }

  // Merge two treaps where every position in [a] is less than every
  // position in [b]. Heap-ordered on priority gives expected balance.
  _TreapNode? _merge(_TreapNode? a, _TreapNode? b) {
    if (a == null) return b;
    if (b == null) return a;
    if (a.priority > b.priority) {
      a.right = _merge(a.right, b);
      if (a.right != null) a.right!.parent = a;
      _update(a);
      return a;
    } else {
      b.left = _merge(a, b.left);
      if (b.left != null) b.left!.parent = b;
      _update(b);
      return b;
    }
  }

  void _update(_TreapNode n) {
    n.size = 1 + (n.left?.size ?? 0) + (n.right?.size ?? 0);
  }
}

class _TreapNode {
  final int id;
  final int priority;
  _TreapNode? parent;
  _TreapNode? left;
  _TreapNode? right;
  int size = 1;
  _TreapNode(this.id, this.priority);
}
