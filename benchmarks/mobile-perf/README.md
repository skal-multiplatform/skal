# mobile-perf — scroll under load

A repeatable answer to "does scrolling a big list drop frames?", and a
place to keep the answer so nobody re-derives it from a debug build.

Harness:
[`examples/kitchen-sink/flutter-host/lib/scroll_bench.dart`](../../examples/kitchen-sink/flutter-host/lib/scroll_bench.dart).
Opt-in via a `--dart-define`; the call site is behind a `const` so a
normal build folds it away entirely.

## Run it

```sh
cd examples/kitchen-sink
bun run build
cd flutter-host
flutter build macos --release --dart-define=SKAL_SCROLL_BENCH=true
./build/macos/Build/Products/Release/skal_flutter.app/Contents/MacOS/skal_flutter
```

Put a heavy list on screen first — the demo's **List** tab, with a large
count selected — and stay OFF the UI tab, whose looping animations render
continuously and drown the signal. It prints after ~20 s and keeps
running; kill it. Check the control line before reading anything else.

(`=true` or `=1` both work. The flag is parsed with
`String.fromEnvironment`, not `bool.fromEnvironment`, precisely because
the latter accepts only the exact string `true` and turns `=1` into a
silent no-op: clean build, running app, no output.)

## Reading the output

```
[scrollbench] viewport=800x600
[scrollbench] CONTROL idle 7s -> frames=26
[scrollbench] sweeps=12 frames=214 total p50=1.04 p90=1.85 p99=2.72 max=4.53
[scrollbench] raster p50=0.55 p90=0.76 p99=1.12
[scrollbench] over16ms=0/214 over33ms=0/214 done
```

- **CONTROL first.** An equal idle window with no drags. If the idle
  count is not far below the scrolling count, the drags are not what
  produced the frames and the rest of the line means nothing. This is
  the guard against the mistake this repo keeps making — a "39% faster"
  list benchmark once timed 10 virtualized rows instead of 2000.

  A real rejected run, for calibration:

  ```
  [scrollbench] CONTROL idle 7s -> frames=427
  [scrollbench] sweeps=12 frames=426 ... max=44.71
  [scrollbench] over16ms=3/426 over33ms=1/426
  ```

  427 idle against 426 scrolling — the drags contributed nothing. The
  app had been left on the demo's **UI** tab, which has three looping
  animations and an indeterminate spinner, so it was rendering flat out
  regardless and there was no long list on screen at all. The `max` and
  the `over16ms` there are the animations, not scrolling. Discard the
  run and fix the setup; do not report it.
- **`over16ms`** is the number that matters. 16.67 ms is the 60 Hz
  budget; one frame in fifty over it is a visible stutter, and a mean
  hides exactly that. Percentiles, not averages.
- **raster** is split out because build cost and raster cost fail
  differently — a heavy widget tree and an expensive paint want
  different fixes.

## Recorded results

| Target | Build | List | p50 | p90 | p99 | max | over 16 ms |
|---|---|---|---:|---:|---:|---:|---:|
| macOS | **release** | 10 000 rows, builder mode | 1.04 ms | 1.85 ms | 2.72 ms | 4.53 ms | **0 / 214** |

Worst frame 3.7× under budget, no dropped frames. Control: 26 idle
frames against 214 scrolling.

## iOS — no valid number, and why

There is no iOS scroll measurement here on purpose.

```
flutter build ios --profile --simulator
→ Profile mode is not supported for simulators.
```

Release is refused there too, so the only buildable simulator mode is
debug — JIT Dart on a simulated GPU, which
[`CLAUDE.md`](../../CLAUDE.md) forbids quoting as a number. **A real
iPhone is the only way to get one**; the harness itself needs no
changes, only `flutter run --profile -d <device>`.

What *was* checked on the simulator, as correctness rather than
performance: a 10 000-row builder list scrolls (rows #1 → #25-29 after
10 sweeps), recycles under motion (node count 952 → 1015 — bounded near
a thousand, not ten thousand), produced 182 frames against 24 in an
equal idle control, and logged zero errors.

## Not automated

Nothing runs this in CI. It needs a release build, a foregrounded
window and a loaded list, and it reports rather than asserts — a
threshold here would be a flaky test on shared runners. Run it when
touching the render path, and add a row above.
