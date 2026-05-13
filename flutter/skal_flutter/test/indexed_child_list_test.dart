// Two-part test for the indexed child list:
//
//   1. Correctness — drive both implementations with the same random
//      operation sequence and assert they produce identical state at
//      every step. Catches treap bugs (parent-pointer drift, split/
//      merge inversions, etc.) by trusting ListChildList as oracle.
//
//   2. Benchmark — exercise both on append, indexOf, random insert /
//      remove, and a sort-like workload at various N. Prints a side-
//      by-side timing table to stdout. Both tests pass unconditionally;
//      the benchmark is informational, not gated on numbers.

import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';

import 'package:skal_flutter/skal/indexed_child_list.dart';

void main() {
  // ───────────────────────────────────────────────────────────────────
  // Correctness
  // ───────────────────────────────────────────────────────────────────

  group('IndexedChildList — correctness equivalence', () {
    test('TreapChildList matches ListChildList over random ops', () {
      const opsCount = 5000;
      final rng = math.Random(0xc0ffee);
      final reference = ListChildList();
      final candidate = TreapChildList();
      int nextId = 1;

      void assertEqual(String label) {
        expect(candidate.length, reference.length, reason: '$label: length');
        for (int i = 0; i < reference.length; i++) {
          expect(candidate.idAt(i), reference.idAt(i),
              reason: '$label: idAt($i)');
        }
        // Spot-check indexOf for a sample of ids
        if (reference.length > 0) {
          for (int k = 0; k < 10; k++) {
            final i = rng.nextInt(reference.length);
            final id = reference.idAt(i);
            expect(candidate.indexOf(id), reference.indexOf(id),
                reason: '$label: indexOf($id)');
          }
        }
      }

      for (int step = 0; step < opsCount; step++) {
        // Bias toward appends early so we have content; mix in
        // insert/remove once the list is non-trivial.
        final op = reference.length < 10
            ? 0 // always append while small
            : rng.nextInt(4);
        switch (op) {
          case 0: // append
            final id = nextId++;
            reference.append(id);
            candidate.append(id);
            break;
          case 1: // insert at random pos
            final id = nextId++;
            final pos = rng.nextInt(reference.length + 1);
            reference.insertAt(pos, id);
            candidate.insertAt(pos, id);
            break;
          case 2: // remove at random pos
            final pos = rng.nextInt(reference.length);
            reference.removeAt(pos);
            candidate.removeAt(pos);
            break;
          case 3: // indexOf existing id
            final pos = rng.nextInt(reference.length);
            final id = reference.idAt(pos);
            expect(candidate.indexOf(id), reference.indexOf(id),
                reason: 'step $step: indexOf($id)');
            break;
        }
        if (step % 250 == 0) assertEqual('step $step');
      }
      assertEqual('final');

      // Full-iteration equivalence — the spot-checks inside assertEqual
      // sample indexOf for 10 random ids, but never traverse all items.
      // After a non-trivial treap structure built up over 5K random
      // ops, an in-order walk could expose subtle bugs (parent-pointer
      // drift, wrong subtree-size update) that positional reads miss.
      expect(candidate.items.toList(), reference.items.toList(),
          reason: 'full in-order iteration after random ops');

      // clear() is used in production by bridge.dart's _removeSubtree
      // but isn't exercised by the random-ops switch above. Verify it
      // resets state to empty on both impls.
      reference.clear();
      candidate.clear();
      assertEqual('after clear');
      expect(reference.length, 0);
      expect(candidate.length, 0);
      expect(candidate.indexOf(1), -1, reason: 'indexOf after clear');
      // After clear, re-append should restart positions from 0.
      reference.append(42);
      candidate.append(42);
      expect(candidate.indexOf(42), 0);
      expect(reference.indexOf(42), 0);
      expect(candidate.idAt(0), 42);
    });

    test('indexOf returns -1 for absent ids in both impls', () {
      final list = ListChildList();
      final treap = TreapChildList();
      list.append(7);
      treap.append(7);
      expect(list.indexOf(99), -1);
      expect(treap.indexOf(99), -1);
    });

    test('sequential iteration matches', () {
      final list = ListChildList();
      final treap = TreapChildList();
      for (final id in [3, 1, 4, 1, 5, 9, 2, 6]) {
        list.append(id);
        treap.append(id);
      }
      expect(treap.items.toList(), list.items.toList());
    });
  });

  // ───────────────────────────────────────────────────────────────────
  // Benchmark
  // ───────────────────────────────────────────────────────────────────

  group('IndexedChildList — performance benchmark', () {
    test('append / indexOf / insert / remove / sort across sizes', () {
      const sizes = [100, 1000, 5000];
      stdout.writeln('');
      stdout.writeln('=' * 72);
      stdout.writeln('  ChildList performance — wall-clock per workload, lower = better');
      stdout.writeln('=' * 72);

      final formatRow = _RowFormatter(['Workload', 'N', 'ListChildList', 'TreapChildList', 'List / Treap']);
      stdout.writeln(formatRow.header());
      stdout.writeln(formatRow.separator());

      for (final n in sizes) {
        // ─── append N ────────────────────────────────────────────────
        final listAppendMs = _bench(() {
          final l = ListChildList();
          for (int i = 0; i < n; i++) l.append(i + 1);
        });
        final treapAppendMs = _bench(() {
          final t = TreapChildList();
          for (int i = 0; i < n; i++) t.append(i + 1);
        });
        stdout.writeln(formatRow.row([
          'Append',
          '$n',
          _ms(listAppendMs),
          _ms(treapAppendMs),
          _ratio(listAppendMs, treapAppendMs),
        ]));

        // ─── indexOf N ids (in a pre-built list of N) ─────────────────
        final preL = ListChildList();
        final preT = TreapChildList();
        for (int i = 0; i < n; i++) { preL.append(i + 1); preT.append(i + 1); }
        final ids = List<int>.generate(n, (i) => i + 1);
        final shuffleRng = math.Random(0xfeed);
        ids.shuffle(shuffleRng);

        final listIndexMs = _bench(() {
          int acc = 0;
          for (final id in ids) acc += preL.indexOf(id);
          if (acc < 0) throw StateError('unreachable'); // keep `acc` live
        });
        final treapIndexMs = _bench(() {
          int acc = 0;
          for (final id in ids) acc += preT.indexOf(id);
          if (acc < 0) throw StateError('unreachable');
        });
        stdout.writeln(formatRow.row([
          'IndexOf×N',
          '$n',
          _ms(listIndexMs),
          _ms(treapIndexMs),
          _ratio(listIndexMs, treapIndexMs),
        ]));

        // ─── insertAt random positions ───────────────────────────────
        // Same RNG seed for both so positions are identical.
        final positions = _gen(n, math.Random(0xabc1));
        final listInsertMs = _bench(() {
          final l = ListChildList();
          for (int i = 0; i < n; i++) {
            final pos = positions[i] % (l.length + 1);
            l.insertAt(pos, i + 1);
          }
        });
        final treapInsertMs = _bench(() {
          final t = TreapChildList();
          for (int i = 0; i < n; i++) {
            final pos = positions[i] % (t.length + 1);
            t.insertAt(pos, i + 1);
          }
        });
        stdout.writeln(formatRow.row([
          'RandomInsert',
          '$n',
          _ms(listInsertMs),
          _ms(treapInsertMs),
          _ratio(listInsertMs, treapInsertMs),
        ]));

        // ─── removeAt random positions ───────────────────────────────
        final removePositions = _gen(n, math.Random(0xabc2));
        final listRemoveMs = _bench(() {
          final l = ListChildList();
          for (int i = 0; i < n; i++) l.append(i + 1);
          for (int i = 0; i < n; i++) {
            final pos = removePositions[i] % l.length;
            l.removeAt(pos);
          }
        });
        final treapRemoveMs = _bench(() {
          final t = TreapChildList();
          for (int i = 0; i < n; i++) t.append(i + 1);
          for (int i = 0; i < n; i++) {
            final pos = removePositions[i] % t.length;
            t.removeAt(pos);
          }
        });
        stdout.writeln(formatRow.row([
          'RandomRemove',
          '$n',
          _ms(listRemoveMs),
          _ms(treapRemoveMs),
          _ratio(listRemoveMs, treapRemoveMs),
        ]));

        // ─── Sort-like: starting from an N-item list, do N random
        //    "move to random position" cycles. Mimics drag-and-drop
        //    reorder traffic.
        final movePositions = _gen(n, math.Random(0xabc3));
        final listSortMs = _bench(() {
          final l = ListChildList();
          for (int i = 0; i < n; i++) l.append(i + 1);
          for (int i = 0; i < n; i++) {
            final from = movePositions[i] % l.length;
            final id = l.idAt(from);
            l.removeAt(from);
            final to = (movePositions[i] * 31) % (l.length + 1);
            l.insertAt(to, id);
          }
        });
        final treapSortMs = _bench(() {
          final t = TreapChildList();
          for (int i = 0; i < n; i++) t.append(i + 1);
          for (int i = 0; i < n; i++) {
            final from = movePositions[i] % t.length;
            final id = t.idAt(from);
            t.removeAt(from);
            final to = (movePositions[i] * 31) % (t.length + 1);
            t.insertAt(to, id);
          }
        });
        stdout.writeln(formatRow.row([
          'SortLike',
          '$n',
          _ms(listSortMs),
          _ms(treapSortMs),
          _ratio(listSortMs, treapSortMs),
        ]));

        stdout.writeln(formatRow.separator());
      }

      stdout.writeln('');
      stdout.writeln('Reading the table:');
      stdout.writeln('  List / Treap > 1.0  →  Treap is faster (List takes longer)');
      stdout.writeln('  List / Treap < 1.0  →  List is faster (Treap takes longer)');
      stdout.writeln('');

      // Always passes — this is informational.
      expect(true, isTrue);
    });
  });
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

double _bench(void Function() body) {
  // Warm-up + measure with the same closure. Median of 3 runs to
  // discount one-off GC pauses.
  body();
  final ts = <double>[];
  for (int k = 0; k < 3; k++) {
    final sw = Stopwatch()..start();
    body();
    sw.stop();
    ts.add(sw.elapsedMicroseconds / 1000.0);
  }
  ts.sort();
  return ts[1];
}

List<int> _gen(int n, math.Random rng) =>
    List<int>.generate(n, (_) => rng.nextInt(1 << 30));

String _ms(double v) => v < 1.0
    ? '${v.toStringAsFixed(3)} ms'
    : v < 10.0
        ? '${v.toStringAsFixed(2)} ms'
        : '${v.toStringAsFixed(1)} ms';

String _ratio(double a, double b) {
  if (b == 0) return '—';
  final r = a / b;
  return r >= 1
      ? '${r.toStringAsFixed(2)}× (T)'
      : '${(1 / r).toStringAsFixed(2)}× (L)';
}

class _RowFormatter {
  final List<String> headers;
  late final List<int> widths;
  _RowFormatter(this.headers) {
    widths = [
      _max(headers[0].length, 14),
      _max(headers[1].length, 6),
      _max(headers[2].length, 14),
      _max(headers[3].length, 16),
      _max(headers[4].length, 14),
    ];
  }
  String header() => '  ' + _zip(headers).join(' │ ');
  String separator() => '  ' + widths.map((w) => '─' * w).join('─┼─');
  String row(List<String> cells) => '  ' + _zip(cells).join(' │ ');

  Iterable<String> _zip(List<String> cells) sync* {
    for (int i = 0; i < cells.length; i++) {
      yield cells[i].padRight(widths[i]);
    }
  }

  int _max(int a, int b) => a > b ? a : b;
}

// stdout shim — flutter_test runs without a real stdout in headless
// mode, so we route through print() which the test runner captures.
final stdout = _Stdout();

class _Stdout {
  void writeln(String s) => print(s); // ignore: avoid_print
}
