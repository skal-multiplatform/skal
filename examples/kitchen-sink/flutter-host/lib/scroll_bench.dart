// Scroll-under-load harness. Opt-in, and deliberately not wired to run
// on its own — see benchmarks/mobile-perf/README.md.
//
//   flutter build macos --release --dart-define=SKAL_SCROLL_BENCH=true
//
// Why it is shaped like this:
//
//   * REAL pointer events through GestureBinding, not a ScrollController.
//     That is what integration_test does underneath, and it exercises the
//     gesture arena, scroll physics and raster the same way a finger
//     does. It also needs no access to the controller, which `<listView>`
//     keeps private.
//   * FrameTiming for build and raster SEPARATELY. "The app felt fine" is
//     not a measurement, and a mean hides the frame that stuttered.
//   * Percentiles plus a count over budget. One dropped frame in fifty is
//     a visible stutter and a mean will not show it.
//   * An idle CONTROL window of equal length first. Without it, a frame
//     count proves only that the app rendered — not that the drags are
//     what caused it. A benchmark that did not run the workload it claims
//     is this repo's most repeated own-goal; see CLAUDE.md.
//
// RELEASE ONLY. Debug Flutter and the iOS simulator produce numbers that
// mean nothing, and the simulator refuses both release and profile — so
// there is no valid iOS number to be had without physical hardware.

import 'package:flutter/gestures.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

/// True when built with `--dart-define=SKAL_SCROLL_BENCH=<anything but
/// false/0>`. Const, so the call site folds away entirely in a normal
/// build.
///
/// Deliberately NOT `bool.fromEnvironment`: that accepts only the exact
/// string `true`, so the obvious `=1` yields false and the benchmark
/// silently does nothing — you get a clean build, a running app and no
/// output, with nothing to tell you which of the two you got wrong.
/// (This cost a build cycle the first time.)
const String _kScrollBenchRaw =
    String.fromEnvironment('SKAL_SCROLL_BENCH');
const bool kScrollBenchEnabled = _kScrollBenchRaw != '' &&
    _kScrollBenchRaw != 'false' &&
    _kScrollBenchRaw != '0';

/// Drive [sweeps] synthetic drags over the centre of the window and
/// report frame timings. Call once, after `runApp`.
void startScrollBench({int sweeps = 12}) {
  final frames = <int>[];
  final rasters = <int>[];
  var recording = false;

  SchedulerBinding.instance.addTimingsCallback((List<FrameTiming> ts) {
    if (!recording) return;
    for (final t in ts) {
      frames.add(t.totalSpan.inMicroseconds);
      rasters.add(t.rasterDuration.inMicroseconds);
    }
  });

  int pct(List<int> xs, double p) {
    if (xs.isEmpty) return -1;
    final a = [...xs]..sort();
    return a[((a.length - 1) * p).round()];
  }

  String ms(int us) => (us / 1000.0).toStringAsFixed(2);

  Future<void> drag(Offset from, double dy, int steps) async {
    const id = 7;
    var pos = from;
    GestureBinding.instance
        .handlePointerEvent(PointerDownEvent(pointer: id, position: pos));
    for (var i = 0; i < steps; i++) {
      final d = Offset(0, dy / steps);
      pos = pos + d;
      GestureBinding.instance.handlePointerEvent(
          PointerMoveEvent(pointer: id, position: pos, delta: d));
      // ~60 Hz. A real fling is not this regular; this trades realism
      // for a cadence that is identical between runs.
      await Future<void>.delayed(const Duration(milliseconds: 16));
    }
    GestureBinding.instance
        .handlePointerEvent(PointerUpEvent(pointer: id, position: pos));
  }

  Future.delayed(const Duration(seconds: 5), () async {
    final view = WidgetsBinding.instance.platformDispatcher.views.first;
    final w = view.physicalSize.width / view.devicePixelRatio;
    final h = view.physicalSize.height / view.devicePixelRatio;
    // ignore: avoid_print
    print('[scrollbench] viewport=${w.toStringAsFixed(0)}'
        'x${h.toStringAsFixed(0)}');

    // CONTROL first — see the header.
    recording = true;
    await Future<void>.delayed(const Duration(seconds: 7));
    recording = false;
    // ignore: avoid_print
    print('[scrollbench] CONTROL idle 7s -> frames=${frames.length}');

    frames.clear();
    rasters.clear();
    await drag(Offset(w / 2, h * 0.75), -h * 0.4, 12);   // warm
    await Future<void>.delayed(const Duration(milliseconds: 600));
    frames.clear();
    rasters.clear();

    recording = true;
    for (var i = 0; i < sweeps; i++) {
      await drag(Offset(w / 2, h * 0.8), -h * 0.55, 14);
      await Future<void>.delayed(const Duration(milliseconds: 350));
    }
    recording = false;

    // ignore: avoid_print
    print('[scrollbench] sweeps=$sweeps frames=${frames.length} '
        'total p50=${ms(pct(frames, .5))} p90=${ms(pct(frames, .9))} '
        'p99=${ms(pct(frames, .99))} max=${ms(pct(frames, 1))}');
    // ignore: avoid_print
    print('[scrollbench] raster p50=${ms(pct(rasters, .5))} '
        'p90=${ms(pct(rasters, .9))} p99=${ms(pct(rasters, .99))}');
    // 16667 us is the 60 Hz budget; 33333 us is two frames missed.
    // ignore: avoid_print
    print('[scrollbench] over16ms=${frames.where((x) => x > 16667).length}'
        '/${frames.length} over33ms=${frames.where((x) => x > 33333).length}'
        '/${frames.length} done');
  });
}
