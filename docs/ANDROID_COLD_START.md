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

Three apps rendering the *same* static screen (~27 nodes, no list, no
network), same milestone, same instrumentation, interleaved n=10:

| | time to content | APK (arm64-v8a) |
|---|---:|---:|
| React Native 0.86 | **268 ms** | 24.9 MB |
| **Pure Flutter** (no Skal) | **302 ms** | **14.8 MB** |
| Skal | **337 ms** | 41.7 MB |

**Half the deficit is not ours.** Pure Flutter — no `libskal.so`, no
JSC, no bundle eval, no bridge — is *still* 34 ms behind RN. Nothing in
Skal causes that and no Skal-side work removes it.

The other 34 ms is Skal's own: mapping `libskal.so`, `skal_create_runtime`,
and evaluating the bytecode bundle. That is the part worth attacking,
and it is the same ~44 ms that sits serial in Dart `main()`.

The APK line is the starker one: **Skal adds 27 MB over pure Flutter**,
which is `libskal.so`. No startup work touches it.

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

---

## What is still open

1. **Skal's own 34 ms** — `libskal` map + `skal_create_runtime` +
   bundle eval. The runtime pre-create makes `Skal.create()` nearly
   free but does not move the total; worth re-testing now that the
   34 ms is known to be Skal-specific rather than assumed away.
2. **27 MB of APK.** Bigger competitive fact than 69 ms of startup.
3. **Making `skal_flutter` a real Flutter plugin with an Android
   module**, shipping `SkalFlutterActivity` / `SkalApplication` base
   classes so every app inherits the host wins instead of copying them.
   Structural change: adds a Gradle subproject to a currently pure-Dart
   package, and `new-app.sh` would have to rewrite the generated
   `MainActivity` and manifest.
4. **iOS: nothing measured.** `flutter build ios --profile --simulator`
   is refused and release too, so a physical device is required. The
   engine pre-create has an iOS analogue (cached `FlutterEngine` in
   `AppDelegate`); TextureView does not — it is an Android-only concept.
