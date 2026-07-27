# Testing Skal

Skal spans three runtimes, so testing lands in a few places. From fastest /
narrowest to slowest / broadest:

| Layer | Runner | Language | What it covers |
|---|---|---|---|
| JS unit | `bun test` | JS | framework + plugin logic (`*.test.js`) |
| Codegen | `dart test` | Dart | the build_runner codegen pipeline |
| Host | `flutter test` | Dart | the bridge decoder, wire format, widget builders |
| **E2E** | **Maestro** | **YAML** | the whole stack on a real device |

```bash
bun run test                              # codegen (dart test) + host (flutter test)
cd packages/skal-js && bun test           # the JS framework: encoder, diff cache, doorbell
cd examples/kitchen-sink && bun test      # an app's own JS unit tests (bun:test)
bun --filter kitchen-sink test:e2e        # E2E (Maestro) — needs the maestro CLI + a device
```

## E2E with Maestro

[Maestro](https://docs.maestro.dev) drives the **real app** on an iOS
simulator / Android emulator and asserts against what's on screen. Flows are
declarative **YAML** — no Dart, no JS — so you test in neither of the app's two
languages, you just describe the user journey.

### How Maestro sees Skal widgets

Maestro reads Flutter's **Semantics tree** (it can't see Flutter `Key`s).

**Assert by `id:` (a `testID`), not by visible text.** A Skal widget's text
lands in its accessibility *label* (the Android content-desc / iOS a11y label),
and the node's plain `text` field is left empty — so Maestro's plain-string
matcher (`assertVisible: "Welcome"`) does **not** match Skal widgets. The
`testID` prop sets the Semantics `identifier`, which surfaces as the Android
`resource-id` that `id:` matches. So:

```jsx
<text label="Welcome" testID="home-title" />        // -> Semantics(identifier:) -> id: "home-title"  ✅ matchable
<button testID="submit" onTap={...}>Save</button>   // -> Semantics(identifier:) -> id: "submit"      ✅ matchable
<text label="Welcome" />                             // label only -> a11y content-desc, NOT Maestro `text`  ❌ not matchable by "Welcome"
```

Give every widget you assert or tap a **`testID`**. (It's also separate from the
a11y label, so test ids don't reach screen readers, and it won't break when
visible copy changes.)

### Writing a flow

A flow lives in `<app>/.maestro/*.yaml` (the template scaffolds a starter). The
JS bundle renders a beat or two *after* launch, so wait for a `testID` rather
than asserting immediately:

```yaml
appId: com.example.myapp     # Android applicationId / iOS bundle id
---
- launchApp
- extendedWaitUntil:                    # covers async JS boot
    visible: { id: "home-title" }
    timeout: 15000
- assertVisible: { id: "home-title" }   # by testID
- tapOn: { id: "submit" }               # give it a testID to tap it
- inputText: "hello"
- assertVisible: { id: "echo" }
```

**Bottom-bar tabs** (`<Tabs>`) carry no Maestro-matchable id or text, so switch
tabs with a coordinate tap, retrying until the target screen appears (taps fired
mid-boot are no-ops; the first post-boot one lands):

```yaml
- repeat:
    while: { notVisible: { id: "store-title" } }
    commands:
      - tapOn: { point: "90%,92%" }     # 5th of 5 tabs, bottom-right
      - waitForAnimationToEnd: { timeout: 1200 }
- assertVisible: { id: "store-title" }
```

Run it:
```bash
bun run test:e2e            # = maestro test .maestro   (from the app dir)
# or target one device / id:
maestro test .maestro --app-id com.example.myapp
```

(Install Maestro per its docs; you need a simulator/emulator with the app
installed — run `bun run dev:android` / `dev:ios` once first. `dev:android`
auto-boots an Android emulator if none is attached and targets it by its real
device id, since `flutter run -d android` doesn't match a booted emulator —
see `scripts/android-emulator.sh`.)

### Caveats

- **iOS + Android only.** Flutter desktop isn't supported by Maestro; macOS
  desktop E2E isn't covered here.
- **Semantics must be forced on.** Flutter only builds its semantics tree when
  an accessibility service is active, and Maestro's query doesn't reliably
  trigger that — so the tree is invisible to Maestro (an empty
  `maestro hierarchy`) unless the app forces it. Both entries already do:
  `WidgetsBinding.instance.ensureSemantics()`, gated to **debug builds** (where
  `dev:android` E2E runs) plus `--dart-define=SKAL_E2E=true` for **profile /
  release** E2E. Release otherwise never pays the always-on semantics cost. Do
  the same in your own entry. To confirm what Maestro sees, run
  `maestro hierarchy` with the app foregrounded.
- **A widget must be in the semantics tree to be found** — give interactive /
  asserted widgets a `testID` (or `semanticLabel`); dynamic widgets without one
  are invisible to Maestro.
- **A `<Navigator>`/overlay nested inside a `<scrollView>` erases the whole
  scroll's semantics.** This is an upstream **Flutter** behavior, not a Skal one
  — it reproduces in a pure-Flutter widget test with zero Skal (Flutter 3.41.9):
  a `SingleChildScrollView` wrapping a `Navigator` (or any `Overlay`) collapses
  the parent scroll's semantics tree to almost nothing, so the visible top — and
  every `testID` in that scroll — never reaches the a11y tree (it can even drop
  sibling semantics like an app-bar/HUD outside the scroll). The trigger is the
  **nested Navigator/overlay, not the scroll height**: a 9000px `<scrollView>`
  with plain content is fine; add an embedded `<Navigator>`/`<Tabs>` and it
  breaks. This is why the kitchen-sink smoke asserts on the **Store** tab (plain
  scroll) rather than the home tab (which embeds nested nav/tab demos). If a
  `testID` you expect is missing, check whether it lives in a scroll that also
  contains a nested `<Navigator>`/`<Tabs>`; the fix is to **virtualize that
  screen with `<listView>`** (an off-screen nested Navigator is never built, so
  it can't poison the tree) or to not nest a Navigator inside a scrollable.
  (Tracked as a known issue with a minimal repro.)
- **appId** differs per platform if your iOS bundle id and Android
  applicationId diverge; pass `--app-id` or keep a flow per platform.

## Where the framework itself is tested

`flutter test` (in `packages/skal_flutter`) covers the Dart half — the wire
format (`wire_test.dart`, incl. the prop/opcode table), the op drain
(`bridge_drain_test.dart`), node state, the registry, and the generated
service-dispatch contract (`service_dispatch_contract_test.dart`).

### Testing anything that needs a bridge

`SkalBridge` takes a `SkalRuntime` (`lib/skal/runtime.dart`), not the
concrete `Skal` — precisely so tests don't need a 60 MB dlopen. Hand it
`FakeSkalRuntime` from `test/fake_skal_runtime.dart`:

```dart
late FakeSkalRuntime js;
late SkalBridge bridge;

setUp(() {
  js = FakeSkalRuntime();
  bridge = SkalBridge(js)..ensureRoot();
});

// The constructor ARMS the doorbell, so disarm it. Harmless against the
// fake, but the native `enableHostNotify` allocates a RawReceivePort
// that only this releases — leak one per test and each stays a live
// target for a ring from a JS worker outliving the test.
tearDown(() => bridge.disableOffFrameDrain());

test('...', () {
  js..createNode(2, wtBox)..setPropU32(2, propWidth, 100)..commit();
  bridge.pumpOps();                     // a frame drain

  js..setPropU32(2, propWidth, 200)..commitAndRing();   // + the doorbell
});
```

The fake is a producer, not a stub: it writes real 16-byte ops at real
`wire.dart` offsets into a real 6 MiB `Uint8List`. `commit()` mirrors
bridge.js's `publishProgress`; `commitAndRing()` mirrors a batch
carrying a ROOT-targeted invoke, which publishes and then rings
`__skal_notifyHost()`. If the wire format drifts, these tests break.

This seam exists because it was missing: the drain path had no coverage
at all, and a stranded-update bug shipped past a 13-finding review and
was only found by a 45-second benchmark on a real macOS build. See
`docs/TODO_OPTIMIZATIONS.md` §2c. **If you touch `pumpOps` / `_drain` /
`_flushTouched`, add a case there** — and check your test actually fails
against the unfixed code before you trust it.

### The JS side

`bun test` in `packages/skal-js` covers the bridge's encoder, diff cache
and the §2b doorbell — the ringing rule (ROOT-targeted invokes only) and
the coalescing gate. `test/bridge.test.js` installs
`globalThis.__skal_acquireBridge` + `__skal_notifyHost` over a plain
6 MiB `ArrayBuffer` **before** dynamically importing `bridge.js`, which
grabs its buffer at module-eval time.

Everything asserts through the published wire contract — header cursors,
raw op bytes — never module internals, so the tests break if the format
moves. Both halves are mutation-checked: making the doorbell ring for
every node id, or dropping the coalescing gate, each fails exactly one
test.

The rest of the **JS framework** (renderer, `hot.js`, store) has no
`bun test` suite of its own; it's exercised end-to-end by the kitchen-sink plus
the render bench (`docs/BENCHMARKS.md`). New pure-JS logic is a good candidate
for a `bun test` suite (mock `globalThis.__skal_acquireBridge` to render the
bundle headless).
