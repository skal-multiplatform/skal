# Debugging Skal

Skal spans three runtimes, and "debugging" means something different in each:

- **Solid / JS** — your app code (`.jsx`), the reactive store, the renderer.
- **Dart / Flutter** — the host that drains the bridge and builds the widgets.
- **Native libskal** (native targets only) — an embedded bun + JavaScriptCore
  that runs the JS bundle, talking to Dart over a shared 6 MiB buffer.

There is no single "debug mode" switch. Most dev diagnostics are **opt-in and
`kDebugMode`-gated** so release builds stay clean; a few production probes are
**unconditional** so an ops person can diagnose a deploy. This page is the map.

Quick index:

| You want to… | Go to |
|---|---|
| Edit `.jsx` and see it without restarting | [JS hot reload](#js-hot-reload) |
| See a `console.log` | [console.log](#consolelog) |
| Set a JS breakpoint / profile JS | [The bun inspector](#the-bun-inspector-deep-js-debugging) |
| Fix a blank page on web | [Boot & blank-page](#boot--blank-page-web) |
| Inspect bridge / runtime state | [Bridge & runtime state](#bridge--runtime-state) |
| Chase a perf regression | [Performance](#performance) |
| Understand a thrown RPC/stream error | [Errors at runtime](#errors-at-runtime) |
| Symbolicate a native crash | [Native crashes](#native-crashes) |

---

## console.log

### Web → browser DevTools

On the web target the JS bundle runs in the browser's own JS context, so
`console.log` goes straight to the **Chrome/Safari DevTools console**, exactly
like any web app. This is the most comfortable place to debug — you also get
breakpoints, the network panel, and live `eval` of the diagnostic globals below.

### Native → the Flutter log stream

Under native libskal, `globalThis.console` is JSC's `ConsoleObject` writing to a
stdio the embedded runtime never wires up — on device that's `/dev/null` at
best, and historically it *crashed the VM*. So Skal installs a **console
bridge** (native only):

- **Crash floor** (`patches/skal_entry.zig`): `Output.Source.setInit` wires the
  embedded runtime's stdout/stderr on the worker thread before the VM captures
  the console writers, so `console.*` can never crash the VM again.
- **Routing** (`packages/skal-js/src/bridge.js`, `installConsoleBridge`): the
  shim shadows `globalThis.console`, serializes each call, and ships it over the
  op ring as `OP_LOG`. The Dart side (`bridge.dart`) decodes it and
  `debugPrint`s, so your JS logs land in `flutter run` / logcat / Console.app
  **interleaved with Dart's own `[skal]` logs** — one place to look.

Native log lines are tagged with their level:

```
flutter: [skal-js:log]   user opened settings { id: 42 }
flutter: [skal-js:warn]  retrying fetch
flutter: [skal-js:error] save failed Error: timeout
flutter:     at <anonymous> (skal-app.js:…)
```

Notes / gotchas:

- The shim is installed **only under the embedded bun runtime** — gated on
  `HAS_NATIVE_BRIDGE && typeof window === 'undefined'`. (The bridge is also
  present on Flutter Web, which *has* a `window`, so the DOM check keeps the shim
  off the web and leaves `console.*` going to DevTools there.)
- The Dart decode is **`kDebugMode`-gated** — release builds drop JS log lines.
  Don't rely on `console.log` for production telemetry; use the store / an
  explicit channel.
- It REPLACES `console` (it doesn't wrap it), so a connected bun inspector's
  console pane won't mirror these lines — the inspector's value is breakpoints.
  Unknown console methods (`console.profile`, …) are no-ops, never throwing.
- Objects are `JSON.stringify`'d (BigInt-safe); `Error`s print their stack.
- Logs are flushed at the end of the current tick (`scheduleCommit`), so a log
  from an idle async callback reaches the host on the next drain.

**Rule of thumb:** debug with `console.log` on **web** (DevTools); on **native**
it works too, in the Flutter log stream — just remember it's dev-only.

---

## The bun inspector (deep JS debugging)

For breakpoints, stepping, the call stack, heap snapshots, and CPU profiling of
the **JS** side on a native target, Skal can expose bun's
WebKit-Inspector-Protocol debugger. It's **opt-in dev tooling**, off by default.

### Enable it

Set `SKAL_INSPECT` in the environment the app process inherits:

| Value | Effect |
|---|---|
| `1` / `true` / `on` / `yes` / *(empty)* | default endpoint `ws://localhost:6499` |
| `<port>` (e.g. `9230`) | that port on localhost |
| `<host:port>` / `ws://…` | that endpoint |

Optionally `SKAL_INSPECT_WAIT=1` blocks bootstrap until a debugger attaches, so
you can breakpoint the bundle's first line.

macOS (verified): run the built debug binary directly so it inherits the env —

```sh
cd examples/kitchen-sink/flutter-host && flutter build macos --debug
SKAL_INSPECT=1 \
  build/macos/Build/Products/Debug/skal_flutter.app/Contents/MacOS/skal_flutter
```

On boot the app prints:

```
--------------------- Bun Inspector ---------------------
Listening:
  ws://localhost:6499/<token>
Inspect in browser:
  https://debug.bun.sh/#localhost:6499/<token>
```

### Connect

Open the printed **https://debug.bun.sh** URL (a hosted WebKit inspector), or use
the **VS Code Bun extension**. On a physical device the server binds `localhost`
*on the device*, so forward the port first: `adb forward tcp:6499 tcp:6499`
(Android) or an `iproxy`/usbmux tunnel (iOS).

### Caveats

- **A bind failure kills the app.** bun's debugger runs on its own thread; if it
  can't bind (port in use, privileged port, bad host) it calls `process.exit(1)`
  from that thread, which Skal **cannot intercept**. Only set `SKAL_INSPECT` in a
  dev shell, and prefer the default port unless you know your port is free.
- **Source maps to `.jsx` are not guaranteed.** Skal evaluates the bundle through
  `Bun__REPL__evaluate`, not bun's module pipeline, so protocol attach, pausing,
  the console, and breakpoints work, but breakpoints may land in compiled output
  rather than your original JSX.
- Web doesn't need this — DevTools already gives you breakpoints + a console.

---

## Boot & blank-page (web)

The bridge can fail silently and leave a blank canvas. The host
(`examples/kitchen-sink/flutter-host/lib/main_web.dart`) pins breadcrumbs to
`window` you poke from the DevTools console:

- **`window.__skalDartStep`** — the last boot stage Dart reached
  (`main:after-bridge-ctor`, …). Blank page? This tells you how far it got.
  (`kDebugMode`-gated.)
- **`window.__skalDartError`** — the pinned `stage` + stacktrace if boot threw.
- **`_ErrorApp`** — a visible red error screen rendered on any boot failure, so a
  failure shows a message instead of a blank canvas.
- **`window.__skal_isolation_info`** + the `[skal] threading: isolated=… cores=…`
  log — **unconditional**; this is how you confirm the COOP/COEP headers are set
  (cross-origin isolation is required for the threaded skwasm path). If this says
  `isolated=false`, your server isn't sending the headers — see
  `examples/kitchen-sink/scripts/serve-isolated.js` and [WEB_SUPPORT_PLAN.md](./WEB_SUPPORT_PLAN.md).

---

## Bridge & runtime state

- **`globalThis.skalStatus()`** (JS) — returns JSON with `handlerCount`,
  `opSeq`, `lastEventSeq`, `lastHandlerError`, and the prop diff-cache counters
  (`propWrites`/`propSkips`). On web, call it in the DevTools console; on native,
  have Dart run `skal.evaluate('skalStatus()')`. `lastHandlerError` is where a
  thrown JSX event handler is captured (the runtime can't always use `console`).
- **`bridge.debugReadHeader()`** (Dart) — snapshots `{opSeq, opWritePos,
  eventSeq}` from the shared header. If `opSeq` isn't advancing each frame, the
  op ring is stuck — JS isn't reaching Flutter.
- **`window.__skal_opRingResets`** (JS) — counts op-ring overflow resets. Nonzero
  means a render is overflowing the 4 MiB op ring; chunk large mounts
  (`ChunkedFor`). The kitchen-sink `?stress=<N>` route exercises this path.
- The node tree is `bridge.nodes` (`Map<int, NodeState>`), inspectable from a
  Dart debugger. Solid's reactive graph is JS-side and ephemeral.

---

## Performance

- **PerfHud** (`examples/kitchen-sink/flutter-host/lib/main.dart`) — an on-screen
  overlay (native) showing FPS + pump cost, reading `bridge.pumpAvgNs` /
  `bridge.pumpPeakNs` (EMA + 60-frame peak via a monotonic `Stopwatch`). If the
  pump cost climbs, that's the receive side getting expensive.
- `bridge.propWritesLastDrain` / `coldPropsTouchedLastDrain` quantify how much JS
  work hit the host that frame.
- **Web has no PerfHud** — use Chrome DevTools. The meaningful metric for the
  threaded-skwasm win is **INP**, not FPS.
- Budgets and the reasoning behind them: [PERFORMANCE.md](./PERFORMANCE.md)
  (pump < ~250 µs avg / < 500 µs peak).

---

## Errors at runtime

- Dart logs are tagged `[skal] …` (`print` / `debugPrint`).
- JS surfaces operational warnings via `console.warn` (op-ring overflow, drain
  spin-timeout) — on native these now reach the Flutter log via the console
  bridge.
- **RPC / stream failures become Promise rejections.** `_writeMethodError` /
  `_writeStreamError` ship a descriptive message back through the reply heap, so
  `await ref.someMethod()` rejects with a real message rather than hanging.
- A thrown JSX **event handler** is captured into `lastHandlerError` (read via
  `skalStatus()`), because the runtime can't always route to `console`.

---

## Native crashes

The one area with a full runbook: **[crash-symbolication.md](./crash-symbolication.md)**.
Native crashes (in libskal / the embedded bun) are symbolicated by matching the
Build ID from `adb logcat` / macOS Console to the **unstripped**
`libskal.unstripped.{so,dylib}` and running `llvm-addr2line` / `atos`. See also
**[bytecode-cache.md](./bytecode-cache.md)** for the JSC-version-coupling footgun
between the bytecode bundle and libskal.

---

## JS hot reload

Edit a `.jsx` file and see it in the **running native app** in well under a
second — no process restart. Skal re-evaluates the rebuilt bundle inside the
live VM and re-mounts the widget tree. (This is JS reload; Flutter's own `r`
only reloads *Dart*.)

Two ways to trigger it — same underlying mechanism, different transport:

| | Command | How to apply an edit |
|---|---|---|
| **Automatic** | `bun run dev:hot:macos` (`:ios` / `:android`) | Just save — the dev server rebuilds and pushes; the app updates itself |
| **Manual** | `bun run dev` in one shell + `flutter run` in another | Press **`r`** in the `flutter run` terminal |

`dev:hot:*` runs `scripts/hot-reload-server.js` (a `vite build --watch` + a
WebSocket on `:8765`) alongside `flutter run --dart-define=SKAL_HOT=1`; the
app's debug-only Dart client connects and re-evals each pushed bundle. The
manual route leans on Flutter's asset-sync: pressing `r` re-syncs the
vite-rebuilt `skal-app.js` and `SkalRoot.reassemble()` re-evals it.

**What survives a reload:**
- **Store-backed state** (`createSkalStore` persists through the native store).
- **Navigation** — `createRouter`'s route stack is restored automatically, so a
  reload lands you back on the screen you were on (not the initial route).
- **Opt-in signals** via `createHotState(initial)` (from `skal/runtime`) — a
  drop-in for `createSignal` whose value survives a reload. Use it for "where am
  I" state like a selected tab index: `const [tab, setTab] = createHotState(0)`.

**What resets:** any other in-component `createSignal` state — the tree is
re-mounted, so local UI state returns to its initial value (the same trade-off
as React without Fast Refresh). Preserved state is held in an in-memory stash on
the dev coordinator — it survives reloads but not a full app relaunch, and it's
keyed by call order, so use `createHotState`/`createRouter` in a stable spot
(component top level), not inside a loop or conditional.

**Gotchas:**
- **Clean up side effects.** A bare `setInterval` / external subscription from
  the old generation leaks across a reload. Register them with Solid's
  `onCleanup` so the teardown (`__skalHot.beginReload`) stops them.
- **Native + debug only.** Web reloads via Vite/the browser; release ships
  bytecode with no reload trigger. In release the host sets
  `globalThis.__skalRelease` before loading the bundle, so the coordinator,
  drain trampoline, and all `createHotState`/`createRouter` stash work are
  skipped entirely — zero release overhead.
- **Don't use `R` (hot restart)** with a native Skal app — it re-runs `main()`
  over the already-live VM and drops the connection. Use JS reload (`r` /
  socket) for JS edits; for Dart edits, `r` (hot reload) is fine.
- **Android:** the client reaches the host via `10.0.2.2` (the `dev:hot:android`
  script sets `--dart-define=SKAL_HOT_HOST=10.0.2.2`).

**Did it work?** You'll see `Performing hot reload…` (manual) or a
`[skal-hot] pushed reload` line from the server (auto), and your edit appears.
Mechanism: `packages/skal-js/src/hot.js` (the `__skalHot` coordinator) +
`OP_RESET_ROOT_SUBTREE` in `bridge.dart`.

## Dev loop & tooling

| Command | Target | Notes |
|---|---|---|
| `bun run dev:hot:macos` | native | **JS hot reload** — save a `.jsx`, app updates live (see above) |
| `bun run dev:web` | DOM preview | vite dev server with **HMR** — fastest loop |
| `bun run dev:web-flutter` | Flutter Web (skwasm) | `flutter run -d chrome --wasm` |
| `bun run dev:macos` / `dev:ios` / `dev:android` | native | `flutter run` → Flutter DevTools, hot reload, widget inspector |

- `examples/kitchen-sink/scripts/serve-isolated.js` serves built output with the COOP/COEP headers the
  threaded web path needs (so `__skal_isolation_info` reports `isolated=true`).
- Rebuilding native after a `skal_entry.zig` change: `bun run build:libskal`
  then `scripts/link-libskal-flutter-mac.sh` (macOS) to relink + embed the dylib.
  A `flutter build`/`run` re-embeds it into the `.app`.

---

## TL;DR

- **Web:** DevTools console + breakpoints; poke `window.__skal*` for boot/isolation.
- **Native:** `console.*` shows in the Flutter log stream (`[skal-js:…]`);
  `SKAL_INSPECT=1` opens a real JS debugger; PerfHud + `debugReadHeader()` for the
  bridge; `crash-symbolication.md` for native crashes.
