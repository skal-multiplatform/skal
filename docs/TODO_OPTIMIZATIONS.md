# Skal — optimization candidates

Optimization opportunities that have been **identified and (where
possible) measured**, but not yet designed or scheduled. This is the
staging area: an item graduates out of here the moment we know how to
build it.

Where things live:

| Doc | Holds |
|---|---|
| [`PERFORMANCE.md`](PERFORMANCE.md) | The decision **log** — what landed, what was rejected and why, what's pending *with a design*. Items graduate from here to there. |
| [`BENCHMARKS.md`](BENCHMARKS.md) | The measurement record + the bench code. |
| [`TODO.md`](TODO.md) | Non-perf open items. |

Status: ◈ measured, needs design · ◇ candidate, unmeasured · ✗ rejected

---

## Constraints that bound this list

Two facts shape which optimizations are even available, and both are
easy to forget when reasoning about the JS side:

- **No JIT on iOS.** Apple disallows JIT in App Store apps, so JSC runs
  interpreter-only there ([`ENGINE_CHOICE.md`](ENGINE_CHOICE.md) §1).
  The `.jsc` bytecode cache is not a nice-to-have on iOS — it is the
  only compilation step JS gets. Consequence: **JS-side wins on iOS
  must come from doing less work or crossing less often, never from
  the engine getting faster.** Steady-state JIT advantages we enjoy on
  Android and desktop do not exist on the commercially important
  platform.
- **The bridge is not the bottleneck anywhere.** A steady-state drain
  is 0.268 ms (peak 0.787 ms), measured live on device. Any proposal
  that optimizes the transport is optimizing 2% of a frame. Optimize
  *crossings* and *scheduling* instead.
- **⚠ There is no longer a separate UI thread.** As of Flutter 3.29 the
  UI and platform threads are **merged on iOS and Android** — "the UI
  thread is removed and the Dart code runs on the native platform
  thread" (docs.flutter.dev architectural overview). macOS/Windows
  followed in 3.35; the opt-out flag is being deleted
  ([flutter#174408](https://github.com/flutter/flutter/pull/174408)),
  and the engine default is
  `Settings::merged_platform_ui_thread = kEnabled`. **We are on Flutter
  3.41.9, so this is our reality, not a future.**

  Consequences, all of which cut against us: frame build/layout/paint
  and *all* plugin platform-message handling now contend for one
  thread; head-of-line blocking behind a frame is worse post-merge, not
  better; and any reasoning in older Skal docs that assumes "the UI
  thread" and "the platform thread" are distinct is stale. Note the
  engine's own `docs/about/The-Engine-architecture.md` still describes
  the pre-merge configuration — do not cite it for current threading.

---

## 1. ◈ Platform-side JS VM prewarm

**Measured** (iPhone 17 Pro, iOS 26.3, debug build, 2026-07-25):

```
init 96.0 ms · first eval 109.4 ms · boot 633.9 ms
```

**Problem.** The two runtimes load strictly sequentially. Dart is the
caller — `main()` cannot run until the Flutter engine and the Dart
runtime are fully up, and only then does `Skal.create()` invoke
`skal_create_runtime`, which blocks the calling thread on
`self.ready.wait()` (`patches/skal_entry.zig:200`) until the JSC VM is
constructed and the bridge globals installed.

VM construction has **no dependency on Dart**. It needs a thread and an
allocator. It waits purely because of who calls it.

**Proposal.** Trigger `skal_create_runtime` from the platform side —
`AppDelegate` on iOS, `MainActivity` on Android — at process launch,
concurrent with Flutter engine startup. Dart's later `Skal.create()`
then picks up an already-`ready` handle. The existing
`std.Thread.ResetEvent` makes this safe with no protocol change: a
`ready.wait()` on an already-signalled event returns immediately.

**Wrinkle that makes this non-trivial.** `Skal.create(dataDir)` takes a
data directory that today comes from `await
getApplicationSupportDirectory()` — an async platform channel awaited
*before* `create()`. A platform-side prewarm must resolve that
directory natively instead (`NSApplicationSupportDirectory` /
`context.getFilesDir()`) and guarantee it matches what Dart would have
computed, or the store opens against the wrong path.

**Impact.** Recovers roughly the 96 ms VM-init window into time Flutter
was already spending. Note carefully what that does *not* buy: bundle
eval must still follow VM init, and nothing can render before eval
finishes, so this shortens "engine ready → content ready", not
"launch → content". **Pair it with a real splash frame** or the win is
a number rather than an experience.

**Cost.** Per-platform launch code (2 platforms minimum), plus the
data-dir duplication above. No change to the C ABI.

**Trigger to land.** Any cold-start push, or the first customer
complaint about launch time.

---

## 2. ✓ Coarse-grained service methods — LARGELY SUPERSEDED by §2b

**Read §2b first.** The doorbell removed the per-hop frame cost this
section was built to work around, so the numbers below are now history
rather than guidance: chained `await`s no longer cost 16.7 ms each.

What survives is the *design* advice, on its own merits. Collapsing a
status/permission/result dance into one Dart method is still fewer
crossings, still a better API, and still the right shape for a chatty
plugin — it just isn't the difference between 52 ms and 14 ms any more.
The measurements are kept because they document what the pre-doorbell
world cost, and because §2b's win is only legible against them.

**Measured** (2026-07-25, kitchen-sink, real `geolocator` from pub.dev
wired via `services:`, debug builds on both macOS and iPhone 17 Pro):

| Measurement | Result |
|---|---|
| 10 chained `await`s, pure-Dart method | 166.4 ms (macOS), 166.5 ms (iOS) |
| Per-hop | 16.7, 16.4, 16.6, 16.6, 16.7, 16.7, 16.7, 16.6, 16.7, 16.7 |
| Same 10 via `Promise.all` | 16.7–17.0 ms — **one frame** |
| Host pump (drain) cost | 0.268 ms |

Every hop is exactly one 60 Hz frame; ~16.3 ms of each 16.6 ms is
waiting for vsync, not working.

**Correction to the model.** Pure-Dart hops cost exactly one frame, but
**real plugin-channel hops cost two to four**, because the platform
call does OS work *on top of* frame quantization. The documented
geolocator flow, measured cold:

```
isLocationServiceEnabled = 36.6 ms
checkPermission          = 63.0 ms
PRE-FIX OVERHEAD         = 99.6 ms   <-- ~100 ms, not the ~50 ms a
getCurrentPosition       = 60.9 ms        one-frame-per-hop model predicts
total                    = 160.5 ms
```

Collapsing that chain into one Dart method, order-controlled so the
single-crossing version runs **cold** and the chain runs warm (i.e.
biased against the fix):

| | Chain | Single crossing | Ratio |
|---|---:|---:|---:|
| Cold | 160.5 ms | 56.7 ms | 2.8× |
| Warm | 51.8 ms | 14.0 ms | 3.7× |

**Proposal.** Two parts, both cheap:

1. Ship a coarse-grained method in every wrapper whose capability needs
   more than one call to answer one question — a `fix()`-shaped method
   that does the status/permission/result dance Dart-side and returns
   once. This is rung 2 of the escape-hatch ladder used as a latency
   tool rather than a mapping tool.
2. Have codegen **notice the shape**: a service where several methods
   return status enums that no caller wants individually is a chatty
   API by construction. Emit an advisory in the skip report.

**Why this matters more than it looks.** The ergonomics of our
zero-Dart codegen actively create this trap: the better we get at
exposing a pub package verbatim, the more likely a developer
transliterates that package's serial Dart idiom into serial JS
`await`s, where each hop that cost microseconds in-process now costs a
vsync. The developer does everything right and gets a stall.

---

## 2b. ✅ Off-frame dispatch for logic calls — SHIPPED (macOS, iOS, Android)

§2 above is the *mitigation*. This is the **fix**: stop making logic
calls wait for a frame at all. UI ops belong on the frame — you cannot
paint before vsync, so quantizing them is free. Logic calls never touch
the widget tree, so quantizing them is pure dead latency.

### Prior art: Flutter already does this, and we opted out

A native→Dart platform message is dispatched in
`Shell::OnPlatformViewDispatchPlatformMessage`
(`engine/src/flutter/shell/common/shell.cc`) via
`fml::TaskRunner::RunNowAndFlushMessages` onto the **UI task runner** —
no `VsyncWaiter`, no `Animator`, no frame gating. It runs at the next
UI-thread task-loop turn.

So Flutter's own channels are not frame-bound. Ours are, because we
chose a per-frame Ticker drain. **We are slower than the mechanism we
bypassed**, and by a lot:

| Small-message round trip | Measured |
|---|---:|
| Flutter MethodChannel, iPhone 16 Pro | **16.0 µs** |
| Flutter MethodChannel, iPhone 11 | 37.9 µs |
| Flutter MethodChannel, Pixel 7 Pro | 145.2 µs |
| Flutter MethodChannel, low-end Android reference | 606 µs |
| **Skal service RPC (any device, 60 Hz)** | **16,700 µs** |

Source: Flutter's `platform_channels_benchmarks` devicelab task, profile
mode, mean per-message round trip over 2500 sequential awaited messages,
published continuously to `flutter-flutter-perf.skia.org`. Codec cost is
<2% of a small-message round trip (StandardMessageCodec int encode ≈
0.3 µs on iPhone 11) — the cost is thread hops and task scheduling, the
same lesson our own bridge teaches.

**State the device class with any target.** Flutter's own engineers have
argued about exactly this
([flutter/flutter#83938](https://github.com/flutter/flutter/issues/83938));
cross-environment ratios are not comparable.

**Two honesty notes on these numbers.** (1) *No official per-call
overhead figure for platform channels exists anywhere* — not on
docs.flutter.dev, api.flutter.dev, or in the Pigeon docs. Every number
above comes from benchmark PRs or the live CI dashboard. Anyone quoting
a figure "from the Flutter docs" is inventing it. (2) Every test in
`platform_channels_benchmarks` is **Dart→host**; there is no host→Dart
benchmark in the tree. These round trips *bound* our case, they do not
measure it, and halving them to get a one-way number is not a
measurement.

### Measured — the win is real (2026-07-25, iPhone 17 Pro, iOS 26.3)

Before committing to a libskal rebuild, the hypothesis was tested with a
**stand-in for the doorbell**: a `debug.setPump(micros)` service that
starts/stops a Dart-side `Timer.periodic` calling `bridge.pumpOps()`
off-frame. `pumpOps()` is already public and already has a `_pumping`
reentrancy guard, so this needed **no wire change, no Zig, no rebuild**.
One build, flipped live, so both arms share a device and a warmed
plugin. Debug build.

The stand-in is deliberately *worse* than the real design — it polls
instead of being woken, and it drains the whole ring rather than just
the logic lane. So it is a **lower bound on the win and an upper bound
on the cost**.

| Arm | `echo` ×20, mean/hop | geolocator 3-hop chain | coarse `fix()` |
|---|---:|---:|---:|
| **A** stock (per-frame only) | 16.6 ms *(med 16.6, min 16.3, max 17.1)* | 55.6 ms | 15.8 ms |
| **B** off-frame drain @1 ms | **1.4 ms** *(med 1.2, min 0.1, max 6.0)* | **10.3 ms** | **3.3 ms** |
| **C** stock again | 16.2 ms | — | — |
| | **11.8×** | **5.4×** | **4.9×** |

Four things to read out of that:

1. **Arm C reverting to 16.2 ms proves the effect is the pump**, not
   warm-up, drift, or measurement error.
2. **The geolocator decomposition is now direct**, not inferred:
   `A [enabled 23.1, check 14.5, fix 17.9]` versus
   `B [enabled 1.6, check 1.4, fix 7.2]`. The genuine platform work is
   1.6 / 1.4 / 7.2 ms. **Everything else was vsync.** Warm geolocation
   really was ~97% scheduling.
3. **Arm B's spread is exactly the predicted shape** — min 0.1 ms when
   the thread is idle, max 6.0 ms when a frame is in production. That is
   the `kDartEventLoop` secondary-source pause showing up in data.
4. **1.4 ms is an upper bound.** It includes ~0.5 ms of average
   poll wait that a real doorbell does not pay. Expect the shipped
   version nearer the 0.1 ms floor.

Cost side: no skipped-frame warnings and no exceptions anywhere in the
run log; the app's HUD read 60 FPS / pump 0.121 ms. That is *not* proof
that per-frame coalescing survived — the stand-in drains everything, and
FPS was sampled after arm C. The shipping design avoids the question by
hoisting only logic ops (below), but a rebuild-based implementation
should re-measure rebuild counts under a mutation-heavy workload.

### Built and measured for real — 2026-07-25

The doorbell now exists: `skal_set_host_notify` in libskal +
`globalThis.__skal_notifyHost()`, rung by JS after committing a batch
containing a ROOT-targeted invoke, delivered to Dart via
`NativeCallable.listener`, draining through the existing `pumpOps()`.
A/B toggled live at runtime, same build, same machine.

macOS (merged platform/UI thread), 30 chained `await`s of a zero-OS-work
Dart method:

| | **debug** p50 / mean | **release** p50 / mean |
|---|---:|---:|
| **A** doorbell OFF | 16.67 / 16.37 ms | 16.67 / 22.06 ms |
| **B** doorbell ON | **0.03 / 0.19 ms** | **0.05 / 0.09 ms** |
| **C** doorbell OFF | 16.66 / 16.45 ms | 16.66 / 16.56 ms |
| ratio (p50) | **≈555×** | **≈333×** |

Read p50, not mean — release arm A caught a single 179.6 ms outlier.

Three things worth keeping:

1. **The win is build-mode independent.** 16.67 → 0.03 ms in debug,
   16.67 → 0.05 ms in release. Of course it is: what was removed was a
   *wait*, and waiting does not care how well the code was compiled.
2. **The "batched control" was not a control.** 30 calls issued via
   `Promise.all` went 16.36 → 0.29 ms (debug) and 16.19 → 0.22 ms
   (release). Batching and the doorbell compose — one doorbell per
   batch, so batched calls stop paying the frame too. Batching remains
   good for op-count, but it is no longer the *latency* workaround.
3. **Arm B's max is the predicted frame-production tail** — 4.43 ms
   debug, 1.21 ms release, versus a 0.03 ms p50. Smaller in release
   because frames are cheaper. That is the `kDartEventLoop` secondary-
   source pause, visible in data.

Re-measured after switching from `NativeCallable.listener` to the
native port: **16.67 ms → 0.03 ms p50, 480×** — the mechanism change
cost nothing. `offFrameDrains` counted 177 while the frame-pump EMA
held at 0.35 ms, confirming the two populations stay separate.

**Android runtime-verified 2026-07-25** (Pixel 3a API 34 emulator,
arm64). The full chain works — `skal_init_dart_api` resolves,
`offFrameDrains` counted 91, and hot restart came back clean with
`wasReused: true` and `init` dropping 1154.6 ms → 10.4 ms. The latency
*magnitude* is another matter: the baseline was a clean 16.75 ms (one
60 Hz frame, matching macOS/iOS) but the doorbell only reached 8.62 ms
— 2×, not the ~500× seen on Apple silicon.

That is the predicted frame-production pause, not a broken mechanism.
The emulator was pathologically slow (first `eval` took 7.3 s, EGL
reported ~1 s frame times), so the window during which
`PauseSecondarySource` holds the Dart event loop is enormous. It is
consistent with the design: **the doorbell removes the wait for the
next vsync, it cannot preempt a frame already in production.** A real
Android device measurement is still owed.

**Status: built for macOS, iOS (simulator + device) and Android.** All
three carry `skal_runtime_was_reused`, `skal_init_dart_api` and
`skal_set_host_port`. The tolerant Dart lookup stays — an older libskal
still degrades to the per-frame drain rather than breaking — but it is
no longer the common case. Reaching users who install from npm still
needs a `release-libskal` dispatch so the runtime manifest repoints.

**The hot-restart crash that surfaced alongside this is now fixed too**
— separately, and it was never the doorbell's fault (proved by control:
it crashed identically with the doorbell disarmed and no JS ringer).
Symbolication showed a second `VirtualMachine.init` invalidating the
first VM's heap, so `skal_create_runtime` now returns the process's
existing runtime instead of minting a second. Hot restart went from
crashing every time to 2/2 clean on macOS and 2/2 on the iOS Simulator,
with `init` dropping from ~460 ms to 0.9 ms because no VM is created.

Shipped in: `patches/skal_entry.zig`, `packages/skal-js/src/bridge.js`,
`packages/skal_flutter/lib/skal_ffi_io.dart` (+ `_web` no-op),
`packages/skal_flutter/lib/skal/bridge.dart`,
`packages/skal_flutter/lib/skal/root.dart`, and the four
`scripts/link-*.sh` symbol allowlists. 75 tests green, analyzer clean.

**v1 scope note.** The control lane described below was *not* built. The
doorbell currently triggers a full `pumpOps()`, so a batch containing a
logic call also drains its UI ops early. That is safe and measured, but
it means per-frame notify coalescing is bypassed for those batches. It
was left out because service calls are human-paced and the measured
frame health showed no regression — build the lane if a mutation-heavy
workload ever shows extra rebuilds.

### The criterion is already on the wire

Every service call routes through
`B.invokeMethod(B.ROOT_NODE_ID, qualified, args)`; every host-widget
`ref.method()` targets a real node id. So:

> **Hoistable iff `nodeId == ROOT_NODE_ID`.**

That is not a trick — it is the correct safety boundary. Node 1 is
created at boot and never removed, so a hoisted root-targeted call can
never outrun a pending `CREATE_NODE`. A ref call can (`<Camera ref>`
then `cam.takePicture()` with the create op still queued), so ref calls
stay strictly in ring order. One integer comparison; no codegen change,
no developer annotation.

### Why not simply drain everything on the doorbell

`_drain` does **end-of-drain coalesced notify** — N writes to one node
collapse to one `cold.notify()` via the touched set. Draining more often
means less coalescing: a node written ten times across ten drains fires
ten rebuilds instead of one. That trades RPC latency for render
throughput.

Hoisting **only** logic ops avoids this exactly: logic dispatch never
touches `NodeState`, so the touched set stays empty and coalescing is
mathematically unaffected. This — not the "mutating outside
`handleBeginFrame`" concern in [`PERFORMANCE.md`](PERFORMANCE.md) §1b —
is the real constraint.

> **Corrected 2026-07-26.** "The touched set stays empty" is true of
> logic *dispatch* and false of the *drain*: the doorbell consumes the
> whole ring, so a batch carrying both a UI op and a root-targeted
> invoke — `setLoading(true); api.fetch()` — applies the UI op
> off-frame too. That premise had produced a real stranded-update bug;
> see §2c. §2c also measures the "drain everything" arm directly and
> rejects it: paint latency does not move.

### Design

Only the **JS→Dart** direction is frame-gated. `_writeMethodReply` →
`dispatchEvent` → `skal.wakeJs()` already fires immediately, which is
why a round trip costs one frame and not two. So there is exactly one
thing to build, and the reverse direction is a production-proven
template for it.

- **Control lane.** A small ring plus its **own arg arena**, carved from
  the 4 MiB op ring. Header bytes 52–63 are free — exactly three spare
  u32 slots (write pos, read pos, arena pos). Opcodes are u8 with 33
  used (highest `0x2C`). `skal_entry.zig` pins only `BRIDGE_SIZE`; the
  sub-regions are a JS↔Dart contract, so the total stays 6 MiB and the
  Zig layout does not move.
- **Why a dedicated arena, not the shared string heap.** `resetFrame()`
  runs only inside `flushAndWaitForDrain`, which spins until the host
  confirms a drain. That is safe today because everything drains
  together; decoupled, a pending control-lane argument could be
  clobbered by an op-ring overflow reset before dispatch.
- **The doorbell.** A JSC host fn `globalThis.__skal_notifyHost()` — the
  mirror of the existing `skal_wake_js` / `__skal_drainEvents` pair —
  posting a single integer to a Dart port. Dart drains the existing
  ring; **the doorbell carries no payload**, only "there is work".
- **Use a native port, NOT `NativeCallable.listener`.** Both land on the
  same `RawReceivePort` with identical delivery guarantees and identical
  mid-build safety, but the per-call cost and failure modes differ
  sharply:

  | | `NativeCallable.listener` | `Dart_PostInteger_DL` |
  |---|---|---|
  | Per call from a foreign thread | **creates and destroys a temporary isolate**, allocates a Dart-heap `Array`, wraps a `PersistentHandle`, posts | `Smi::New` (immediate) + post |
  | Blocks on Dart GC safepoints | Yes | No |
  | Port gone / isolate dead | `FATAL` or undefined behaviour | returns `false`, graceful |

  The `listener` path enters the target isolate group per call
  (`HandleAsyncFfiCallback` → `EnterTemporaryIsolate`). For a doorbell
  whose payload already lives in our shared ring, that is all cost and
  no benefit.

  **Shipped this way.** libskal does not link `dart_api_dl.c` — it
  walks the `DartApi` table itself (`skal_init_dart_api`, given
  dart:ffi's `NativeApi.initializeApiDLData`) to resolve
  `Dart_PostInteger`, so the build needs no Dart SDK sources. Dart
  registers a `RawReceivePort`'s `nativePort` via `skal_set_host_port`.

  The decisive argument turned out to be safety, not cost: Skal's
  runtime is never disposed and its JS worker outlives a Flutter hot
  restart, so a stale target is routine. A dead port is refused; a
  freed trampoline is undefined behaviour whose slot may be recycled
  into an unrelated callback.
- **Two `listener` footguns we avoid by not using it.** Its trampoline
  slots are pooled and **recycled**, so a stale pointer after `close()`
  can silently deliver to a *different* Dart callback with no
  diagnostic — documented nowhere public. And its queue is an intrusive
  list with no capacity limit, so a fast producer against a busy UI
  isolate grows memory until OOM.
- **Coalesce explicitly.** Per-microtask commits are not enough on
  their own. `commit()` rings only when the host has drained up to our
  previous ring (`Atomics.load(seqArr, B_LAST_DRAINED_SEQ) >=
  _lastRungSeq`); if it hasn't, it is already scheduled and will see
  the new ops too. **One outstanding doorbell, ever** — which matters
  because the delivery queue is unbounded and the host's event loop is
  paused for the duration of frame production, so a burst landing
  inside a heavy frame would otherwise pile up one message per batch.
- **It fits the existing shape.** `pumpOps()` already has a `_pumping`
  reentrancy guard and delegates to `_pumpOpsBody()`, so a control drain
  arriving mid-frame-drain is skipped and picked up by the frame.

### Safety

- **No tearing.** JS publishes atomically at end-of-microtask
  (`scheduleCommit` → `publishProgress` → `Atomics.store` on `opSeq`);
  Dart reads only to the published cursor, so any drain sees whole
  batches.
- **Backpressure is free.** One doorbell per commit batch, and commits
  are already per-microtask.
- **Mid-build delivery is impossible — four independent guarantees.**
  (1) Isolates are run-to-completion; messages are events, not
  preemption. (2) The entire frame is one C++ call:
  `PlatformConfiguration::BeginFrame` does `DartInvoke(begin_frame_)` →
  `FlushMicrotasksNow()` → `DartInvokeVoid(draw_frame_)`, so only
  *microtasks* drain mid-frame and `Dart_HandleMessage` is not a
  microtask. (3) Port messages arrive as a separate task on the UI task
  runner, which is single-threaded. (4) See below. **A doorbell callback
  always observes `SchedulerPhase.idle`.**
- **⚠ The engine deliberately pauses the Dart event loop during frame
  production.** `kDartEventLoop` tasks live in a *secondary* task
  source, and `VsyncWaiter::FireCallback` calls
  `PauseSecondarySource(ui_task_queue_id)` at vsync, resuming only after
  the frame callback returns (iOS passes `true` explicitly; Android
  takes the default `true`; only Fuchsia opts out). **So off-frame
  waking removes the wait for the *next vsync*, but cannot preempt a
  frame in flight.** Expected latency is therefore *not* uniformly
  sub-millisecond: a doorbell landing mid-frame-production waits out the
  remaining UI work. With a 5 ms frame in a 16.7 ms interval you'd
  expect immediate delivery ~70% of the time and up to ~5 ms otherwise —
  still an order of magnitude better than a guaranteed 16.7 ms, but
  state it honestly.
- **⚠⚠ The asymmetry that decides the mechanism.** Not all native→Dart
  wakes are equal:

  | Path | Task source | Paused during frame production? |
  |---|---|---|
  | Platform message (MethodChannel) | **primary** (`kUnspecified`) | **No** |
  | Dart port / `SendPort` / `NativeCallable.listener` | **secondary** (`kDartEventLoop`) | **Yes** |

  `Shell::OnPlatformViewDispatchPlatformMessage` posts with the default
  grade, which lands in the primary heap and is never paused; the Dart
  VM's own event-loop dispatcher is registered `kDartEventLoop` and is.
  **So a port-based doorbell — which is what we propose — sits on the
  gated path, while Flutter's own channels do not.** Both still block
  behind an in-flight frame on the (now merged) platform thread, so the
  difference is a tail effect rather than a different order of
  magnitude. But if the residual tail ever matters, the two escapes are
  a platform-message-shaped doorbell (primary heap) or Phase 2 below
  (fully off-thread). Do not let anyone "optimize" this by switching
  wake primitives without re-reading this table.
- **There is no escape hatch via message priority** — `kOOBPriority`
  has no public API.
- **One warm-up-frame caveat.** `scheduleWarmUpFrame` runs `beginFrame`
  and `drawFrame` as two separate `Timer.run` tasks, so during an app's
  first frame (and some hot-restart/test paths) a callback *can* land
  between them. It still cannot land inside build/layout/paint.

### Cost

Modest LOC across `bridge.js`, `wire.dart`, `bridge.dart`,
`skal_ffi_io.dart`, `skal_entry.zig`. The real gate is operational:
touching `skal_entry.zig` means rebuilding libskal for every platform
and re-dispatching `release-libskal` with the manifest repoint.

### Phase 2 — host the doorbell on a background isolate (pure-Dart only)

**Do not conflate two different things here.** They have opposite
verdicts:

- **Background *task queues*** (`makeBackgroundTaskQueue`) change where
  the *native* handler runs. **The evidence here is contradictory and
  we should not act on it without measuring ourselves.** Flutter's 2026
  CI shows them *slower* for sequential small messages on every device
  (iPhone 11 37.9 → 55.3 µs, Pixel 7 Pro 145 → 258 µs, low-end 606 →
  1384 µs). Flutter's own 2021–22 PR benchmarks show them *faster*
  (Android 133.3 → 84.2 µs; iOS 56.8 vs 39.6 µs). The thread merge
  (§Constraints) landed between the two and is the obvious suspect, but
  nobody has published a reconciliation. Treat "background channels are
  faster" as unproven either way.
- **Background *isolates*** change where the *Dart receive port* lives,
  and are genuinely better for our case. Flutter spawns non-root
  isolates with `TaskRunners null_task_runners(...)`, so
  `SetMessageHandlingTaskRunner` early-returns and their messages are
  handled by **the Dart VM's own thread pool — not the UI task runner,
  and therefore not subject to the vsync secondary-source pause at
  all.** That is the only way to get delivery that is off-frame *even
  mid-frame*.

**The boundary that decides it:** a background isolate cannot call most
plugins. `BackgroundIsolateBinaryMessenger.ensureInitialized` exists but
requires plugin cooperation many packages do not offer, and plugin-
backed services (geolocator, local_auth, camera) assume the root
isolate. So:

| Service kind | Where its doorbell should live |
|---|---|
| Pure-Dart compute (crypto, parsing, codecs) | background isolate — fully escapes the frame gate |
| Plugin-backed | UI isolate — Phase 1, bounded by the vsync pause |

Worth doing only after Phase 1 measurements show the residual
frame-production wait actually matters.

### Also not to do

Pump on a short timer (continuous CPU, plus the mid-frame notify
hazard). Spin-wait in JS after ringing — it blocks the JS thread *and*
does not make Dart drain sooner, since the UI isolate schedules the work
when it schedules it.

---

## 2c. ✗ Extending the doorbell to component ops — MEASURED, REJECTED

Built, measured in debug and release, and not worth shipping. Full
numbers and the whole harness are in [BENCHMARKS.md](BENCHMARKS.md)
§ Bench 5.

Three arms — shipping, doorbell-on-every-batch with deferred notify, and
the same with immediate notify — behind two default-off switches. Both
switches, and the harness that drove them, were **removed after
measuring**: a flag no product code sets is a liability, and the whole
answer here is "don't build this". § Bench 5 carries the source and the
five-step restore if the question ever comes back.

**The result, in one line:** decode latency drops ~55× (8.5 ms → 0.15 ms,
same factor as RPC) and **time to pixels does not move at all**.

| workload | arm 0 paint p50 | arm 2 paint p50 | (release) |
|---|---|---|---|
| one prop | 9.80 ms | 9.71 ms | |
| 100 labels | 15.34 ms | 11.51 ms | see caveat |
| prop + RPC | 9.65 ms | 9.47 ms | |

Paint is vsync-locked, and the frame drain runs from a Ticker in
`handleBeginFrame` — *before* Flutter walks the dirty element list. So a
drain at t+0.15 ms and a drain at the start of the next frame land in
the same frame. There is no earlier frame to win.

Frame build time was identical in every arm (3.65 / 3.93 / 4.01 ms for
the 100-label workload). The decode being relocated is ~0.05 ms against
a ~4 ms build — ~1% of the frame — and zero frames were janky in any
arm. The 100-label delta is 2–4 ms of p50, inconsistent between rounds,
absent from p95 in one of them, and probably `AUTO_COMMIT_OPS` splitting
a batch across two frames; buying it means building the tree from a
half-applied ring, which is a correctness hazard rather than a tradeoff.

This is the empirical confirmation of §2b's *Why not simply drain
everything on the doorbell*, and it is the whole reason §2b hoists logic
ops only.

### Correction to §2b's premise

§2b argued the touched set "stays empty" under the doorbell because
logic dispatch never touches `NodeState`. True of the *dispatch*, false
of the *drain* — the doorbell drains the **whole ring**, so any UI op
batched alongside a root-targeted invoke is applied off-frame with its
notification deferred. `setLoading(true); api.fetch()` in one handler is
exactly that shape.

That premise had produced a real bug: `_pumpOpsBody` returned on
`seq == _lastOpSeq` before flushing the deferred `touched` set, so with a
steady stream of doorbell batches the frame drain never saw new ops,
never flushed, and the UI update was stranded until unrelated traffic
happened to wake a drain. Measured in **debug**, pre-fix: **366 ms to
first paint, p95 978 ms**, and in one round no paint at all — against
11.5 ms for the same prop written on its own. Post-fix, same mode:
12.08 ms. (Both debug; the release table above is a different column,
not a regression.)

Fixed by `_flushTouched()`, called from the single exit of a frame pump
rather than from a particular return path — a frame pump must never
return leaving notifications owed, and attaching that to one `return`
would leave the next early return free to reintroduce it.

### Covered by tests as of 2026-07-27

The bug shipped because the drain path had **no unit coverage at all** —
`Skal` has a private constructor behind a 60 MB dlopen, so no test could
build a `SkalBridge`, and a 45-second benchmark on a real macOS build was
the only thing that could see the defect.

Fixed structurally. `skal/runtime.dart` declares `SkalRuntime` — the nine
members the bridge actually calls, no more — which `Skal` implements on
both targets, and `SkalBridge.skal` is typed to it. `EvalResult` moved
there too (it was defined identically in both target files) and is
re-exported from each, so imports of `skal_ffi.dart` are unaffected.

Narrowing the field is source-breaking for anything reaching *through*
the bridge to a runtime member outside the nine — `bridge.skal.dispose()`
and friends. Nothing in-repo does, so `flutter analyze` stays silent;
it's in the 0.2.0 changelog for the record. Hold the `Skal` you
constructed and call those on it.

`test/fake_skal_runtime.dart` is a producer, not a stub: it writes real
16-byte ops at the real `wire.dart` offsets into a real 6 MiB
`Uint8List`, and publishes them exactly as `bridge.js` does — `commit()`
for `publishProgress`, `commitAndRing()` for a batch carrying a
root-targeted invoke. Wire drift breaks the tests, which is the point.

`test/bridge_drain_test.dart` pins the three-way contract §2b
introduced: a frame drain applies **and** notifies; an off-frame drain
applies and **defers**; something always comes back for the deferred
work. Verified as a real guard — reverting `_flushTouched` fails 4 of
the 10 and leaves the other 6 green.

---

## 3. ◇ Modular libskal

Today libskal is one static library linked into every app, whatever the
app uses. That is the single constraint deciding how many native
fast-paths we can ever say yes to — every candidate below pays its
binary cost for *all* users, including those who never call it.

Until this is solved, the answer to "can we link SQLite / libsodium /
zstd" is effectively "only if every Skal app wants it."

**Wants:** a build-time opt-in (app declares native modules; the link
step includes only those), without regressing the prebuilt-binary
distribution model the CLI depends on (`~/.skal/runtime/<commit>/`).

---

## 4. ◇ Native fast-path tier for cheap synchronous OS reads

We already have the mechanism: the store engine is native, exposed to
JS as synchronous JSC host functions (`__skal_store_*`,
`patches/skal_entry.zig:1195`). A direct C call from inside the JS
engine — no op ring, no vsync, no frame.

**The criterion for what belongs there:** *does the capability compute,
or does it ask the OS?* Compute is a strict win — one implementation,
synchronous, permission-free. Asking the OS is not: those are
Objective-C and Kotlin frameworks, they are async and permission-gated
anyway, and pub.dev already solves them with a web implementation
included.

**The arguable middle**, and the place to start if we ever build this:
cheap synchronous OS reads — locale, timezone, device model, screen
metrics, connectivity, secure-storage reads. They are fast enough that
a frame per call is a large proportional cost, and they cluster
precisely in **startup hydration**, where four sequential reads cost
four frames on the path to first interactive.

**Blocker to resolve first:** web. A C library gives us five platforms
and leaves web needing a wasm build or a JS fallback — two
implementations again. Any native fast-path proposal needs an answer to
"and on web?" before it ships. Also: item 3.

---

## Measurement hygiene

All numbers on this page came from **debug builds**. Frame quantization
(16.67 ms at 60 Hz) is build-mode independent and the pump was already
negligible, so the chained-await findings hold as-is. The
platform-channel hop costs (36.6 ms / 63.0 ms) would likely tighten in
release and **must be re-measured before being published anywhere**.

Re-run notes: the probe used a temporary `static int echo(int x) => x`
on `DeviceService` as a zero-OS-work control, plus `geolocator` wired
through `services:` and a coarse-grained `LocationService.fix()`. All
of it was reverted after measurement; the shape is recorded here so it
can be rebuilt.

One behaviour worth knowing when re-running:

**An unforegrounded macOS window stalls the whole app.** Launched
without its window ever coming to the front (`flutter run` printing
"Failed to foreground app"), a 120-call RPC warmup took **242 seconds**
— 2,019 ms/call, roughly 0.5 Hz — and completed instantly the moment
the window was foregrounded. An idle `setTimeout(4000)` scheduled in
that state also never fired. Silent, with no diagnostic.

**The mechanism is NOT "no frames ⇒ no timers"** — that was an early
guess and it is wrong. Measured on a normally-running app with **zero
bridge traffic of any kind** (no RPCs, no awaits, just timers):

```
module eval                @0ms
interval tick 1            @1002ms
lone setTimeout(2000)      @2002ms
```

Timers are millisecond-accurate and entirely self-serviced: the worker
loop runs `autoTickActive()` while `vm.isEventLoopAlive()`, which
computes the uSockets timer timeout and calls `drainTimers`
(`patches/skal_entry.zig:265-286` — and note the comment there
documenting an *earlier* build where timers genuinely never fired).
JS timers do not depend on frames, on the bridge, or on Dart.

So the stall has a different cause — most likely macOS occluded-window
throttling / App Nap suspending the whole process, which would starve
Flutter's frame scheduling and the JS worker's event loop alike. **Not
yet confirmed.** Until it is, the practical rules are: run probes with
the window foregrounded, and do not infer a Skal-level defect from a
backgrounded macOS run.

---

*Last updated: 2026-07-25.*
