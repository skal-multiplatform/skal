# Android cold start — what costs what, and what to do

Measured 2026-07-30 on a **Samsung Galaxy A14 5G (SM-A146P), Android 15,
arm64-v8a**, release builds, physical hardware. Method throughout:
**A/B/A blocks with the repeat-A used to quantify session drift**, n=10
per block, `am force-stop` between launches (2nd-and-later cold start),
`Fully drawn` computed by the OS from process start. A delta smaller
than the measured drift is reported as not proven.

Absolute numbers drift 10–20 ms between sessions. **Deltas travel;
absolutes do not.** Every comparison below is interleaved within one
session.

---

## The control that reframes everything

Four apps rendering the *same* static screen (27 nodes, no list, no
network), same milestone, same instrumentation. Interleaved n=10, all
40 launches confirmed `LaunchState: COLD` by the OS, all APKs
arm64-v8a only.

| | time to content | time to window | APK |
|---|---:|---:|---:|
| React Native 0.86 | **278 ms** | 222 ms | 24.9 MiB |
| **Skal** (scaffolded + host wins) | **333 ms** | 324 ms | 40.7 MiB |
| Pure Flutter, stock (no Skal) | **362 ms** | 362 ms | 14.1 MiB |
| Skal in a kitchen-sink host, stock | **428 ms** | 428 ms | 41.7 MiB |

**A properly configured Skal app is 29 ms FASTER than a bare Flutter
app**, and 56 ms behind RN.

Read the arms carefully, because the two Skal rows differ by 95 ms:

- **Row 2** is what `scripts/new-app.sh` generates — template
  dependencies only — plus `SkalEarlyFrame` and the three host wins
  below, applied by hand exactly as this document tells you to apply
  them. This is the number to quote.
- **Row 4** is `examples/kitchen-sink` with a stock Flutter host. It
  carries `camera`, `qr_flutter` and `shimmer` (all registering plugins
  during engine setup) and a 4× larger JS bundle, and none of the host
  wins. It is the cost of *not* doing any of this.

The 95 ms between them is four changes at once — host wins, fewer
plugins, smaller bundle, early frame — so do not attribute it to any
single one.

**The "Flutter tax" is not inherent.** Stock Flutter is 84 ms behind
RN, but almost all of that is what a stock `FlutterActivity` does on the
critical path, not something Flutter charges by nature: pre-warming the
loader and pre-creating the engine move that work off the critical path,
and TextureView removes the splash-reveal serialisation. A Skal app
doing those things lands ahead of a Flutter app that does not.

The APK line is the one that does not move: **Skal adds ~27 MiB over
pure Flutter**, which is `libskal.so`. No startup work touches it.

The `time to window` column is a real product difference, not noise. RN
paints an empty window 56 ms before it fills it. Stock Flutter holds the
system splash until it can draw content, so its two milestones are
identical on 10/10 runs. Skal-with-`SkalEarlyFrame` paints ~10 ms early
— which is the early frame doing exactly what it is for, and is also how
you can tell from a log whether it is switched on.

> **Superseded numbers.** An earlier version of this table read 268 /
> 302 / 337 with the deficit split 34/34. That run was correctly
> interleaved, but **nothing recorded which build each arm was**, and
> both hosts carry compile-time flags that R8 folds into booleans — so
> the APK cannot be interrogated afterwards, and one of the three was
> overwritten within the hour. Re-measured with every flag verifiably
> off, RN moved 13 ms (ordinary session drift) while Flutter moved 58
> and Skal 94 — i.e. both of those arms had been carrying optimisations
> that the table presented as stock. `harness/three-way.sh` now refuses
> to run without a `CONFIG` string and pins every arm's APK hash into
> the CSV header.

> **Superseded numbers.** An earlier version of this table read 268 /
> 302 / 337 with the deficit split 34/34. That run was correctly
> interleaved, but **nothing recorded which build each arm was**, and
> both hosts carry compile-time flags that R8 folds into booleans — so
> the APK cannot be interrogated afterwards, and one of the three was
> overwritten within the hour. Re-measured with every flag verifiably
> off, RN moved 13 ms (ordinary session drift) while Flutter moved 58
> and Skal 94 — i.e. both of those arms had been carrying optimisations.
> The *shape* of the old claim held (roughly half the deficit is
> Flutter's, 53/47 here); the magnitudes were about half what they
> should have been. `harness/three-way.sh` now refuses to run without a
> `CONFIG` string and pins every arm's APK hash into the CSV header.

---

## What shipped

### `SkalEarlyFrame` — −26 ms, in the library

`packages/skal_flutter/lib/skal/early_frame.dart`. Wired into
`scripts/templates/default`, so **every new app gets it**.

Flutter holds the Android 12+ system splash until its first frame, then
the OS runs a ~90 ms `starting_reveal` animation to hand over — serial
latency at the end of cold start. Painting a cheap frame first lets the
reveal overlap boot.

```dart
final early = SkalEarlyFrame.show();   // paints immediately
await _boot();                          // heavy init
early.reveal(MaterialApp(...));         // subtree insert
```

**The shape matters.** The obvious version —
`runApp(placeholder)` then `runApp(real)` — replaces the root and
rebuilds the whole element tree. Measured **+13 ms, a regression**.
`SkalEarlyFrame` calls `runApp` once with a stable root and swaps only
the child. Same idea, opposite sign.

Pass `background:` to match your launch theme's `windowBackground` or
the handover shows as a flash.

Neutral off Android (no system splash reveal to overlap) — that is an
expectation, not a measurement. macOS was verified to build and boot
with it, not to be faster.

### Host-side wins — −96 ms, reference implementation only

**These are NOT in the platform.** `packages/skal_flutter` is a pure
Dart package with no Android module, and `new-app.sh` generates
`android/` via `flutter create`, so a new app gets stock Flutter host
files. The implementations live in
[`examples/kitchen-sink/flutter-host/android/`](../examples/kitchen-sink/flutter-host/android/)
and must be copied by hand.

| change | measured | file |
|---|---:|---|
| `RenderMode.texture` | **−65 ms** | `MainActivity.kt` |
| FlutterEngine pre-create | **−23 ms** | `SkalHostApplication.kt` + `MainActivity.kt` |
| Flutter loader pre-warm | −8 ms | `SkalHostApplication.kt` |

Together on kitchen-sink: **616 → 524 ms (−92 ms**, A/B/A n=10, 22 ms
drift).

#### What they are worth in a scaffolded app: −60 ms

The −92 ms above is kitchen-sink, which is a different app. Measured
directly on `benchmark_v2/skal-bench` — a `new-app.sh` scaffold with
these two files copied across verbatim, package name aside — changing
**only** these three things and nothing else:

| block | n | median | range |
|---|---:|---:|---|
| as `new-app.sh` generates it | 10 | **402 ms** | 391–438 |
| **+ the two files above** | 10 | **342 ms** | 311–356 |
| as generated, repeat block | 10 | **401 ms** | 388–413 |

**−60 ms against a 1 ms B-to-B drift**, distributions disjoint (the
slow arm's fastest run is 388; the fast arm's slowest is 356). The
benchmark MethodChannel is present in both arms — it is the milestone,
not an optimisation.

So the instructions in this section are known to work rather than
assumed to, and the cost of *not* following them is 60 ms on every
generated app.

(That arm measures 342 ms here and 333 ms in the four-way table above.
Same build, different session — which is the ~10 ms drift this document
keeps warning about, and the reason a first attempt at this A/B/A was
thrown away when the session crossed midnight between blocks.)

That −92 ms is also an independent check on the superseded table: stock
Skal measures 428 ms, and 428 − 92 = 336 against the old run's 337. The
optimisations account for almost exactly the discrepancy, which is what
an optimised arm mislabelled as stock would look like.

#### One more thing a scaffolded app needs: `useLegacyPackaging`

Not a startup win — an **install-size** one, and it is not in the
generated project either.

AGP 8+ defaults `useLegacyPackaging = false`, which stores `.so` files
uncompressed so the OS can mmap them straight from the APK. For most
apps that is the better trade. For Skal the dominant file is a 90.9 MiB
`libskal.so` that deflates to 33.5 MiB, so the default costs ~57 MiB:

| | `libskal.so` in the APK | APK |
|---|---|---:|
| scaffolded, as generated | `Stored`, 90.9 MiB | **110.5 MB** |
| with the block below | `Defl:N`, 33.5 MiB | **42.7 MB** |

```kotlin
packaging { jniLibs { useLegacyPackaging = true } }
```

Kitchen-sink has carried this by hand for a long time, which is why the
discrepancy went unnoticed — the example was fine and every generated
app was not. Two caveats: on Play the choice is largely moot (Play
applies its own transit compression), and it changes *where* the library
is mmap'd from, so treat it as a variable if you are measuring cold
start rather than as a free win.

#### TextureView is the big one and the risky one

`FlutterActivity` defaults to `RenderMode.surface` — a dedicated BLAST
SurfaceView layer. An atrace showed that layer and the splash layer
being reconciled for **101 ms after Flutter's content had already
presented**. `RenderMode.texture` draws inside the normal view
hierarchy, so content and the reveal share one compositing path; the
overlap dropped to 66 ms and the platform tax went 167 → 89 ms.

Scroll did **not** regress — Flutter's own `FrameTiming` on a 500-row
heterogeneous feed: p50 1.70 → 1.61 ms, p90 3.11 → 2.40, p99 9.41 →
5.12. The conventional "TextureView is slower for sustained rendering"
guidance largely predates Impeller on Vulkan.

**But** the extra GPU copy scales with resolution and scene complexity,
and TextureView is the classic place camera previews, video and platform
views misbehave. This was validated on **one device, two screens**.
Treat it as a measured default worth taking, not a law — it is one line
to revert.

`dumpsys gfxinfo` cannot compare the two modes: it only sees the View
hierarchy, so it reports **0 frames** for SurfaceView. Use Flutter's
`FrameTiming`.

#### Engine pre-create needs care

Create the `FlutterEngine` in `Application.onCreate`, register plugins
**there** (before Dart runs — `main()` awaits
`getApplicationSupportDirectory()` almost immediately and will race
otherwise), and execute the Dart entrypoint from `MainActivity.onCreate`
*before* `super.onCreate` so entrypoint args are still available.
Returning a non-null `provideFlutterEngine()` makes the delegate skip
running the entrypoint itself — which is why the activity must.

---

## What was tried and did not work

Kept because negative results stop the next person re-attempting them.

| attempt | result |
|---|---|
| Early frame via two `runApp` calls | **+13 ms regression** — rebuilds the element tree |
| `splashScreen.setOnExitAnimationListener { remove() }` | **~0 ms** — the reveal is a WindowManager animation leash, not the SplashScreen *view* |
| Simplifying the first screen | **~0 ms** — raster drops 52 → 2.3 ms but the frame waits on vsync anyway; the raster was free |
| Pre-creating the Skal runtime from native (JNI shim) | **~0 ms on the total.** `Skal.create()` genuinely drops 25 → 2.7 ms (`skal_create_runtime` reuses; verified same handle, `reused=true`), but the first frame does not arrive sooner |
| Builder-row prefetch in `bridge.dart` | **+18 ms regression** — prefetching 12 rows when 5 are needed, and the reply still misses first layout |
| `windowDisablePreview` | ~50 ms, but deletes the splash — the user stares at the launcher until content appears |

---

## Measurement traps hit along the way

Every one of these produced a confident wrong number first.

- **`MethodChannel`/`NativeModule` marks stamped on receipt.** The
  handler runs on the Android main thread, saturated during cold start;
  a mark read 262 ms against a true ~117 ms. Stamp at the event
  (`clock_gettime(CLOCK_MONOTONIC)` in Dart, process start passed in as
  an entrypoint arg) and report asynchronously.
- **`Displayed` is not `Fully drawn`.** For both Flutter and RN the
  first drawn frame is the splash or an empty window. Skal's two were
  *identical on every run* on older builds — the OS clamps `Fully drawn`
  up to `Displayed` when the call lands before the first frame.
- **A large segment is not a critical-path segment.** See CLAUDE.md.
- **`dumpsys gfxinfo` is blind to SurfaceView.**
- **`sed 's/.*\+([0-9]+)ms.*/\1/'` cannot parse `+1s76ms`.** Android
  formats durations ≥1 s that way; without `-n` sed emits the whole
  logcat line into your CSV.
- **Launching too soon after `am force-stop` produces no timing at
  all.** The launch races the teardown and `am start -W` returns
  `LaunchState: UNKNOWN (0)` with **no `TotalTime` line** — every cell
  lands empty and the run looks like a crashed app. A 3 s settle gives
  reliable `COLD`. Record `LaunchState` per run and discard anything
  that is not `COLD`; a warm start silently averaged in is worse than a
  blank.
- **`logcat -c` does not clear all buffers.** It leaves `events` and
  `system`, so `grep "Fully drawn"` can match a launch from hours
  earlier and report it as the current run. Use `logcat -b all -c`.
- **A `sed` capture group that can be empty must not be
  whitespace-delimited.** `\2 \3` into `awk` collapses the empty
  seconds field, so `$1` becomes the milliseconds and `+396ms` is
  computed as 396 000. Delimit with `:` and use `awk -F:` so the empty
  field stays addressable. Every value was exactly 1000× — a bug that
  preserves ordering and ratios, and so survives any sanity check that
  only looks at which arm won.

---

## What is still open

1. **The remaining 56 ms to RN.** `libskal` map + `skal_create_runtime`
   + bundle eval. The runtime pre-create makes `Skal.create()` nearly
   free but did not move the total when tried; worth re-testing against
   the scaffolded arm, where the surrounding noise is smaller.
2. **27 MiB of APK.** Bigger competitive fact than 56 ms of startup.
3. **`new-app.sh` ships none of this.** A generated app gets stock
   Flutter host files *and* the uncompressed-`.so` packaging default, so
   it starts **60 ms slower** (402 vs 342 ms, measured, drift 1 ms) and
   installs at 110 MB rather than 43 MB.
   Two routes, not mutually exclusive:
   - **Cheap:** have `new-app.sh` patch the generated
     `build.gradle.kts`, `MainActivity.kt` and `AndroidManifest.xml`
     after `flutter create`. `benchmark_v2/skal-bench` is a worked
     example of exactly what the patched output should look like.
   - **Structural:** make `skal_flutter` a real Flutter plugin with an
     Android module, shipping `SkalFlutterActivity` / `SkalApplication`
     base classes so apps inherit the wins instead of copying them.
     Adds a Gradle subproject to a currently pure-Dart package.
4. **iOS: nothing measured.** `flutter build ios --profile --simulator`
   is refused and release too, so a physical device is required. The
   engine pre-create has an iOS analogue (cached `FlutterEngine` in
   `AppDelegate`); TextureView does not — it is an Android-only concept.
