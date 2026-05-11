# Skal — path to public dev platform

Skal isn't an app — it's a tool other devs use to write apps. This
doc tracks what's between today's monorepo (where the demo IS the
project) and "third party can `npx skal create my-app && skal build
android` on a clean machine without ever touching `vendor/bun` or
Compose Multiplatform's gradle internals."

The previous edition of this doc was framed around shipping the
bench app to app stores. That work isn't wasted (the SDK has to
deliver signed APKs, stripped dylibs, R8 minification etc. as the
defaults users get) but the bar is different. Lots of items that were
P0 for "ship the demo" are now infrastructure underneath the SDK; new
items appear because we're now responsible for someone else's app
shipping cleanly through our toolchain.

---

## 0. Definition of "ready to be public"

A third-party Solid dev should be able to:

```sh
$ npm install -g @skal/cli           # or `npx skal …` — no global needed
$ skal create my-app
$ cd my-app
$ skal dev                           # hot reload on iOS Sim or Desktop
$ skal build android                 # → dist/my-app.apk, signable
$ skal build desktop --target=mac    # → dist/my-app.dmg
$ skal build ios-sim                 # → dist/my-app.app
```

…on a clean macOS box with Xcode, JDK 17, Android NDK installed.
Specifically:

- **Zero `vendor/bun` build** — the SDK ships pre-built native runtimes
  per platform.
- **Zero Gradle / Xcode visibility** — the user's mental model is
  "write Solid, run skal commands". Gradle/Xcode/Compose are
  implementation details the SDK orchestrates.
- **Stable wire format + ABI** — a Skal SDK upgrade doesn't silently
  break the user's `.cjs.jsc` or their custom widgets. Semver on the
  CLI; migration guides for breaking changes.
- **Documented widget API** — the user knows what `<column>`,
  `<button>`, `<text>` etc. accept as props, what events they emit,
  how layout works. Plus a path to add their own widgets without
  forking Skal.
- **Public docs site** — getting started, widget reference,
  architecture deep-dive (for plugin authors), troubleshooting.

What we have today:

- A **monorepo** where android-app/, desktop-app/, ios-app/ each
  point at `../android-app/app/src/main/assets/` for the JS bundle.
- A **bench app** baked into android-app's `MainActivity`.
- **Manual build steps** the user has to run in order: `setup.sh`
  → `bun run build:release` → `link-skal-*.sh` → per-platform
  Gradle/Xcode invocation.
- **No widget API doc** — the JSX tags `<column>` / `<button>` etc.
  are the bridge's hardcoded `WT_*` constants in `SkalBridge.kt`.

Production-grade as a dev platform = collapsing the gap between
those two states.

---

## 0.5. Modularity invariants — keep platforms decoupled

Carries over from the previous edition because the SDK depends on
it: each platform's pipeline ships independent binaries. A bug in
the iOS link doesn't break the Android APK; a Skal CLI release can
roll forward Android without re-validating Desktop.

### Invariants

1. **One platform's CI failure must never block another's release.**
   Per-platform GitHub Actions jobs (already done — see
   `.github/workflows/{android,desktop,ios-sim}.yml`).

2. **Each platform owns its own native artifact.** `libskal.so`
   (Android) ≠ `libskal.dylib` macOS Desktop ≠ `libskal.dylib`
   iossim ≠ `libskal.dylib` iOS Device (future). Same `bun-zig.*.o`
   source feeds them; link step is per-platform; outputs in distinct
   `build/skal-<platform>/` dirs (already done).

3. **Platform-specific code lives only in platform-specific source
   trees.** Android-only Kotlin/Java in `android-app/`, Desktop-only
   in `desktop-app/`, iOS-only in `ios-app/` and `shared/iosMain/`
   and `native/ios/`. `shared/commonMain` and `shared/jvmMain` must
   not reference iOS types (already done).

4. **Platform-specific build flags don't leak.** A `-Wl,-U,...`
   flag added for iOS Simulator must not appear in the Android or
   Desktop link command (already done — link scripts split since
   2026-05-10).

5. **Per-platform consumer test in CI** — build, install, launch,
   screenshot/golden-compare (`desktop.yml`'s 10s smoke run +
   `ios-sim.yml`'s simctl screenshot are scaffolded; Android phone
   test is awaiting an emulator action).

6. **No upstream-bun patches that affect a platform that doesn't use
   the patched code.** `patches/0001-bun-main-android-skal-import.patch`
   gates the `skal_entry.zig` import to `android OR macos`; both
   targets need it. Adding iOS to that list when Phase 2-Device
   lands is fine.

For the SDK, one more invariant emerges:

7. **The user's app code never sees the monorepo layout.** Today
   `desktop-app/Main.kt` reads `../android-app/app/src/main/assets/`.
   The SDK's per-platform shells must take a CLI-provided bundle
   path, not assume a monorepo sibling. § 2.1 below.

---

## 1. SDK / CLI distribution (P0 — the foundation)

### 1.1. `@skal/cli` npm package — the entry point (P0, ~1 week)

```js
// What `npx skal …` dispatches to:
skal create <name>          // scaffold a new project
skal dev                    // hot-reload dev server
skal build <platform>       // produce shippable artifact
skal install-runtime        // download native libs for current host
skal doctor                 // diagnose toolchain issues
```

Implementation:
- Node CLI written in TypeScript (matches Solid users' ecosystem).
- Bundled with `tsup` to a single `dist/cli.js`.
- Published to npm as `@skal/cli`. Version number tracks the
  bridge ABI version (semver: major bump = breaking wire format /
  widget API change).
- `npm bin` script `skal` points at `dist/cli.js`.

The CLI is a thin orchestration layer. The heavy lifting (Gradle,
xcodebuild) stays in this repo's existing scripts; the CLI generates
project files + invokes them.

### 1.2. Per-platform native runtime distribution (P0, ~3 days)

The SDK can't make users build `vendor/bun` — that's a 30 min cold
build with rust nightly + Xcode + LLVM and a 30 GB working set. We
ship pre-built `libskal.{so,dylib}` per platform.

Two options — pick one:

**Option A: `@skal/native-<platform>` npm packages.**
Each Skal release publishes:
- `@skal/native-android-arm64@<version>` (libskal.so + .unstripped.so)
- `@skal/native-darwin-arm64@<version>`
- `@skal/native-darwin-x64@<version>` (post-Rosetta-only; revisit)
- `@skal/native-iossim-arm64@<version>`
- `@skal/native-ios-arm64@<version>` (post-Phase 2-Device)
- `@skal/native-linux-x64@<version>`, `…-arm64@<version>`
- `@skal/native-windows-x64@<version>`

`@skal/cli` declares them as optional peerDependencies and pulls only
the ones matching the user's host + targets.

Pros: standard npm distribution, version-pinned with the CLI,
deduped via npm's hoisting.
Cons: ~65 MB per package, npm packages aren't great for big binaries.

**Option B: GitHub releases + `skal install-runtime`.**
First-run command downloads the right binary into
`~/.skal/runtime/<version>/<platform>/`. Cached, content-hashed.

Pros: no npm bloat, faster install.
Cons: needs a separate cache + integrity story.

I'd lean Option A (npm-canonical, fewer moving parts), but Option B
is what tools like Tauri / Electron / esbuild do at our binary size.

### 1.3. Project scaffolding via `skal create` (P0, ~2 days)

`skal create my-app` produces:

```
my-app/
├── package.json              # peerDeps on @skal/cli, solid-js
├── skal.config.ts            # widgets, bundle entry, native opts
├── src/
│   ├── App.tsx               # Hello-world Solid component
│   └── main.tsx              # render(App, root)
├── public/                   # static assets bundled into the .app
│   └── icon.png              # placeholder icon
├── tsconfig.json
└── vite.config.ts            # @skal/vite-plugin pre-configured
```

`skal.config.ts` shape:
```ts
import { defineConfig } from '@skal/cli'
export default defineConfig({
    name: 'My App',
    bundleId: 'com.example.myapp',
    entry: 'src/main.tsx',
    widgets: ['column', 'row', 'text', 'button'],  // built-ins
    plugins: [],   // custom widget plugins
    android: { minSdk: 28 },
    desktop: { targets: ['mac-arm64'] },
    ios: { deploymentTarget: '14.0' },
})
```

The CLI uses this to generate the Gradle / Xcode project under
`.skal/<platform>/` at `skal build` time.

### 1.4. Hide the monorepo layout (P0, ~3 days)

Today `desktop-app/Main.kt` has:
```kotlin
private val ASSETS_DIR = File(System.getProperty("user.dir"),
                              "../android-app/app/src/main/assets")
```

This assumes a sibling android-app/ directory exists, which is wrong
for a user's standalone app. Refactor:

- The SDK's per-platform Main.kt / MainActivity templates take the
  bundle path via a system property or app-bundle resource (Desktop:
  `compose.application.resources.dir`, iOS: NSBundle path, Android:
  assets/).
- `skal build` populates that resource with the user's `.cjs` +
  `.cjs.jsc` produced by Vite + bytecode pass.
- The bench app (`android-app/`, `desktop-app/`, `ios-app/`) becomes
  a *consumer* of the same SDK — eat-our-own-dogfood — rather than
  the canonical app structure.

This is the biggest structural refactor on the path to public.

---

## 2. Per-platform build ergonomics (P0)

### 2.1. `skal build android` (P0, ~1 week)

The user runs one command, gets a signable APK. The CLI:

1. Checks `~/.skal/runtime/.../android/libskal.so` exists; downloads if not.
2. Generates an Android Gradle module under `.skal/android/`:
   - `build.gradle` from a template, parameterized by `skal.config.ts`.
   - `MainActivity.kt` from a template (loads bundle from assets,
     creates Skal runtime, mounts SkalRoot).
   - Copies `libskal.so` into `jniLibs/arm64-v8a/`.
   - Copies the user's `.cjs` + `.cjs.jsc` into `assets/`.
3. Invokes `./gradlew :app:assembleRelease` (or `assembleDebug` for
   `skal dev`).
4. Copies the APK to `dist/<name>.apk`.

The Gradle invocation is hidden — the user never sees `gradlew`.

Signing config matches today's env-var-based scheme (already in
`android-app/app/build.gradle`); the CLI surfaces it via
`SKAL_RELEASE_*` env vars or `--signing-keystore=…` CLI flags.

### 2.2. `skal build desktop` (P0, ~1 week)

Same shape: generate `.skal/desktop/` Compose Desktop module, invoke
`./gradlew packageDmg / packageDeb / packageMsi` based on `--target`
flag (or host OS default).

Code-signing slots: env vars (`SKAL_DESKTOP_APPLE_ID`,
`SKAL_DESKTOP_TEAM_ID`, etc.). Without them, produces an unsigned
artifact with a clear "this won't pass Gatekeeper" warning.

### 2.3. `skal build ios-sim` + `skal build ios-device` (P0 sim, P0 device after Phase 2)

Wraps the Kotlin/Native + xcodebuild + xcodegen pipeline.
- ios-sim: works today via the vtool re-stamp shortcut, just needs
  CLI plumbing.
- ios-device: blocked on § 4.1 (bun cross-compile to aarch64-apple-ios).

### 2.4. Cross-platform `skal build all` (P1, ~2 days)

Convenience: build all configured platforms in parallel, fail-fast
if any one breaks.

---

## 3. Dev loop (P0)

### 3.1. `skal dev` — hot reload (P0, ~1 week)

Today the dev cycle is "rebuild the bundle, force-stop, reinstall".
For a public dev platform we need <1 sec round-trip:

- Vite watcher rebuilds `.cjs` + `.cjs.jsc` on save (~500 ms).
- A WebSocket broadcasts the new bundle bytes (Stage B from
  TODO.md § "Hot reload").
- Dev-mode `bridge.js` connects on startup; on receive, calls
  `dispose()` on the previous Solid root, `__skal_reset_bridge()`
  (a host fn that clears nodes), `(0, eval)(newSource)` to remount.
- Per-platform connectivity glue:
  - Android: `adb reverse tcp:9999 tcp:9999`
  - iOS Simulator: localhost works directly
  - Desktop: localhost works directly
  - iOS device: bind dev server to `0.0.0.0`, mDNS or LAN IP

Already documented in `TODO.md` § "Hot reload Stage B"; promote to
P0 for the SDK launch.

### 3.2. `console.log` / `console.error` → terminal (P0, ~3 hr)

Currently `bridge.js` swallows them because bun's embedded Console
segfaults. Real fix: register a console handler in `skal_entry.zig`
that bridges to:
- Android: `__android_log_write` → `adb logcat`
- Desktop: `stderr` → `skal dev` terminal (the CLI tails the stderr
  of the spawned app).
- iOS: `os_log` → `xcrun simctl spawn booted log stream` →
  `skal dev` terminal.

Without this, JS-side debugging is blind.

### 3.3. Source maps (P0, ~1 day)

Vite already produces source maps for the .js bundle. The SDK needs:
- The SourceMap shipped alongside the bundle in dev builds.
- A JS-side error handler that transforms .js stack frames to
  .tsx via the source map.
- The `console.error` bridge displays the transformed trace.

### 3.4. Devtools / inspector (P2, ~1 week)

Solid has [Solid DevTools](https://github.com/thetarnav/solid-devtools)
for browser debugging. For Skal we'd want either:
- A "View Bridge State" panel that dumps `bridge.nodes` as a tree.
- An overlay that shows op-rate / pump-time live.

PerfHud (already in MainActivity / Main.kt) is the start.

---

## 4. Widget API (P0)

### 4.1. Document existing widgets (P0, ~1 day)

Today: `<column>`, `<row>`, `<scrollColumn>`, `<box>`, `<text>`,
`<button>`. Document each:
- Props it accepts.
- Events it emits.
- Layout semantics (e.g. `<scrollColumn>` is fillMaxSize +
  verticalScroll; can't nest).
- Performance caveats (e.g. Solid fragment-children footgun in
  TODO.md § "Solid universal-renderer fragment footgun").

Land as `docs/widgets.md` or as the docs site's reference section.

### 4.2. Plugin API for custom widgets (P0, ~1 week)

Today, adding a new widget requires:
- Editing `bridge.js` to add a `WT_FOO` constant + `createElement`
  case.
- Editing `shared/.../SkalBridge.kt` to add the constant.
- Editing `shared/.../SkalRoot.kt` to add a `SkalFoo` composable.

For external plugins: a registry the SDK reads at build time.

```ts
// skal.config.ts
import slider from '@skal-plugins/slider'
export default defineConfig({
  plugins: [slider()],
})
```

The plugin's package contains:
- A `bridge.ts` snippet (registers `<slider>` in JS-side renderer).
- A Compose composable (Kotlin source compiled into the user's
  `.skal/android` etc. modules).
- Schema for props (TypeScript types + Zig wire-format mapping).

This is a meaningful design effort — postponed to its own RFC, but
flagged P0 because without it Skal is just a fixed-widget toy.

### 4.3. Missing core widgets (P1, varies)

Things real apps need that Skal's bridge doesn't have today:
- **TextInput** (P0 — almost any real app has one). Needs keyboard
  handling on iOS (TODO_PLATFORMS old § 4.6).
- **Image** (URL + bundled). ~1 day per platform.
- **Lazy list / virtualization** — TODO.md flagged "5000-tweet
  Column re-measures all 5000 every relayout" as a perf issue. ~3
  days for a `<lazyColumn>` widget that only renders the viewport.
- **Modal / dialog**. ~1 day per platform.
- **Navigation** — stack/tab/drawer. The biggest surface; probably
  RFC'd as a separate library (`@skal/navigation`) on top of the
  base bridge.
- **Form helpers** — controlled inputs, validation. Solid's
  reactivity covers this naturally; just need TextInput first.

### 4.4. Layout primitives (P1, ~3 days)

Today the layout is "Compose's Column/Row with hardcoded paddings".
A real platform needs flexbox-like or yoga-style props
(`flexDirection`, `flexGrow`, `padding`, `margin`, `gap`). Map to
Compose's `Modifier.padding/weight` etc.

---

## 5. Stability contracts (P0)

### 5.1. Wire format versioning (P0, ~3 hr)

`patches/SKAL_WIRE.md` specifies the bridge's 2 MiB layout. Add a
version byte at offset 32 (currently unused header space). The
runtime checks at startup; mismatch → clear error ("bridge format
v3 expected, JS bundle is v2; rebuild with @skal/cli ≥ 0.4.0").

### 5.2. Bytecode validation (P0, ~3 hr)

Carries from the prev edition § 1.7. JSC silently rejects
mismatched bytecode → fallback to parsing → user sees "huh, why
is cold start slow now". Add a build-time hash of
`getJSCBytecodeCacheVersion()` baked into the .jsc; runtime checks
at load time, logs a clear warning.

### 5.3. Semver for `@skal/cli` (P0, doc + discipline)

Major bump = breaking change in widgets / bridge / wire format.
Each breaking PR ships a migration guide in
`docs/migration/v<old>-to-v<new>.md`.

### 5.4. ABI compat between native runtime and JS bundle (P0, ~3 hr)

`@skal/cli@0.5.x` produces a bundle that requires
`@skal/native-*@0.5.x`. The CLI checks compatibility at install
time. If user pins `@skal/cli` and lets `@skal/native-*` float, we
catch the mismatch and refuse to build with a clear error.

---

## 6. Documentation site (P0)

### 6.1. Getting started (P0, ~2 days)

5-minute tutorial:
```
$ npx skal create my-app
$ cd my-app
$ skal dev   # iOS Sim / Desktop window opens, hot-reload live
…edit src/App.tsx, see changes…
$ skal build android
$ skal build ios-sim
```

Each step has a screenshot or GIF.

### 6.2. Widget reference (P0, ~3 days)

One page per widget. Auto-generated from JSDoc-style annotations on
the widget definitions if possible, else hand-written.

### 6.3. Architecture deep-dive (P1, ~3 days)

Currently spread across:
- `docs/bytecode-cache.md` (JSC bytecode story)
- `patches/SKAL_WIRE.md` (wire format)
- `docs/ios-port.md` (Phase 2-Device)
- `docs/crash-symbolication.md` (debugging)

Consolidate into a "How Skal Works" section. Audience: plugin
authors + folks evaluating Skal vs RN/Flutter.

### 6.4. Troubleshooting (P0, ~1 day)

Common errors with fixes:
- "Symbol not found: `__clear_cache`" — outdated SDK; run
  `skal install-runtime --force`.
- "Bundle format v2 expected" — see § 5.1.
- "Compose iOS fails on launch with `CADisableMinimumFrameDurationOnPhone`"
  — the CLI's iOS template should set this; if missing, fix Info.plist.
- "Bytecode cache rejected" — see § 5.2.

### 6.5. Site infrastructure (P0, ~2 days)

Docusaurus or Vitepress, hosted on GitHub Pages or Vercel. Domain:
`skal.dev` or similar. Includes an interactive playground? (P2.)

---

## 7. Examples / showcase (P1)

### 7.1. Bigger sample apps (P1, ~3 days each)

Beyond counter+tweets:
- **Todo** — TextInput + persistence + filter (covers core widget set).
- **Weather** — fetch + image + animations.
- **Photo grid** — lazy list + image lazy-load + tap-to-fullscreen.
- **Chat** — keyboard handling + scroll-to-bottom + WebSocket.

Live in `examples/` in the repo. CI builds them on every release to
catch regressions in widget behavior.

### 7.2. Performance benchmarks vs RN / Flutter (P2, ~1 week)

Standard benchmarks (twomey, JankBench-style):
- 10K-row list scroll FPS.
- Cold start time (Skal cold start with bytecode is already
  documented at 71-83 ms for the current bench; comparison data is
  what's missing).
- Bundle size for a hello-world app.

Numbers go on the docs site landing page.

---

## 8. Community / governance (P0 for public launch)

### 8.1. License (P0, 5 min)

Currently TBD. MIT or Apache 2.0 is the standard for OSS dev tools.
Pick one, add `LICENSE` at repo root.

### 8.2. Contributing guide (P0, ~half day)

`CONTRIBUTING.md`:
- Local development setup (run `setup.sh` etc.).
- How to test changes against the bench app.
- How to add a widget (preview of § 4.2).
- PR template.

### 8.3. Code of conduct (P0, 30 min)

Standard Contributor Covenant.

### 8.4. Issue / discussion templates (P0, ~1 hr)

GitHub `.github/ISSUE_TEMPLATE/`:
- Bug report
- Feature request
- Plugin proposal

### 8.5. Security policy (P1, ~1 hr)

`SECURITY.md` — how to report vulnerabilities. Standard for any
public OSS project given Skal embeds JSC (a JIT compiler with a
nontrivial CVE history).

### 8.6. Release process (P0, ~1 day)

GitHub Actions workflow that:
1. On `git tag v0.x.y`, builds all platforms (already in
   `nightly.yml` shape — promote to a release workflow).
2. Publishes `@skal/cli` + `@skal/native-*` packages to npm.
3. Drafts a release on GitHub with the binaries + auto-generated
   changelog.

---

## 9. Foundation work (carried from previous edition)

These are still relevant — the SDK delivers them as defaults to
user apps. Most are already done; the rest are unblocked.

### 9.1. Modularity refactor — link scripts split per platform — ✅ done (§ 0.5/V1)
### 9.2. Per-platform export filtering — ✅ done (§ 0.5/V3)
### 9.3. Strip + unstripped sibling for symbolication — ✅ done (Android + Desktop + iOS Sim)
### 9.4. Per-platform CI workflows + paths filters — ✅ done (`.github/workflows/`)
### 9.5. Auto-build native via Gradle — ✅ done (Desktop)
### 9.6. macOS version pin — ✅ done
### 9.7. Bytecode pipeline uses vendored bun — ✅ done
### 9.8. Bytecode cache for Desktop — ✅ done (842 → 71 ms cold start)
### 9.9. R8 + signing config scaffold (Android) — ✅ done (80 → 38 MB APK)
### 9.10. Asset extraction caching (Android) — ✅ done
### 9.11. Crash symbolication runbook — ✅ done (`docs/crash-symbolication.md`)
### 9.12. Repo-root README — ✅ done
### 9.13. Modular Window menu + state persistence (Desktop) — ✅ done
### 9.14. iOS device cross-compile (Phase 2-Device) — ⏳ ~1 week, see `docs/ios-port.md`
### 9.15. Linux + Windows desktop builds — ⏳ 3-5 days each
### 9.16. Code signing certificates (Apple Developer ID, Play Store keystore) — ⏳ awaiting accounts

---

## 10. Suggested ordering for "v0.1 public alpha"

Three phases, roughly a quarter of work end-to-end.

**Phase A — Standalone-app refactor (~3 weeks)**
The bench is currently the project structure. Pull it apart so the
SDK can generate any user's project against the same shells.
1. Extract per-platform shells into templates the CLI consumes
   (§ 1.4). Bench app rebuilt as a *consumer* of the SDK.
2. Generic asset path / bundle entry plumbing — no
   `../android-app/app/src/main/assets/` constants.
3. Plugin API stub for widgets (§ 4.2 — design phase, no API
   guarantee yet).

**Phase B — CLI + dev loop (~3 weeks)**
4. `@skal/cli` skeleton: `create`, `dev`, `build` (§ 1.1, 1.3, 2.1-2.3).
5. `@skal/native-*` distribution (§ 1.2).
6. Hot reload (§ 3.1) — Stage B from existing TODO.md.
7. Console + source maps (§ 3.2, 3.3).

**Phase C — Stability + docs (~2 weeks)**
8. Wire format versioning + bytecode validation (§ 5.1, 5.2).
9. Widget reference docs (§ 4.1, 6.2).
10. Getting-started tutorial + troubleshooting (§ 6.1, 6.4).
11. License + CONTRIBUTING + COC + release workflow (§ 8.*).
12. One bigger sample app for the docs site (§ 7.1 — todo).

**Phase D — Post-alpha (months, not weeks)**
- iOS device (Phase 2-Device, blocking iOS production).
- Linux + Windows desktop.
- Performance benchmarks (§ 7.2).
- Plugin API stable contract (§ 4.2 — promote stub to API).
- Missing widgets: TextInput, Image, lazyColumn, Modal,
  Navigation (§ 4.3).

---

## 11. Build variants — every platform has working debug + release

All six variants (Android × {Debug, Release}, Desktop × {Debug,
Release}, iOS Sim × {Debug, Release}) are built, verified, and
documented with perf baselines in `docs/build-variants.md`. The
SDK's `skal build` will surface them through CLI flags; today
they're reachable via the per-platform Gradle tasks. Highlights:

- **Android Release**: APK 80 MB → **38 MB** with R8. Bytecode
  cache path on first launch.
- **Desktop Release**: `:runRelease` cold start **65 ms** (warm),
  vs 83 ms for debug. Compose Desktop's ProGuard runs on the JVM
  jar.
- **iOS Sim Release**: Skal.framework **25.8 MB** (was 45.9 in
  debug — 44% smaller via Kotlin/Native LTO). libskal.dylib stays
  65 MB stripped.
- **iOS Sim bytecode loader**: parity with Desktop —
  `evaluateModuleAtPath` when `.cjs+.cjs.jsc` are bundled. Verified:
  iOS UI now shows `bytecode → skal-app loaded` instead of
  `source (18265 chars) → undefined`. **Critical on iOS where JSC
  has no JIT** — parse is the entire cold-start cost; bytecode
  cache eliminates it.

Per-platform symbol audit confirms § 0.5 modularity invariants
hold: Android's `libskal.so` has 6 JNI exports + 0 C exports;
Desktop's has 6 JNI + 0 C + 0 local `__clear_cache`; iOS Sim's has
6 C + 0 JNI + 1 local `__clear_cache` shim.

---

## 12. Verification matrix — what "ready to be public" looks like

| Capability | Today | v0.1 alpha target |
|------------|-------|-------------------|
| `npx skal create my-app` works | ✗ | ✓ |
| `skal dev` with hot reload | ✗ | ✓ on Desktop + iOS Sim |
| `skal build android` produces APK | ✗ (must use Gradle directly) | ✓ |
| `skal build desktop` produces .dmg | ✗ (must use Gradle directly) | ✓ on macOS; Linux/Windows post-alpha |
| `skal build ios-sim` produces .app | ✗ (must use xcodebuild directly) | ✓ |
| `skal build ios-device` | ✗ | ⏳ post-alpha (Phase 2-Device) |
| Pre-built native runtime distribution | ✗ (must build vendor/bun locally) | ✓ via @skal/native-* npm packages |
| User project doesn't reference monorepo paths | ✗ | ✓ |
| Widget reference doc | ✗ | ✓ |
| Plugin API for custom widgets | ✗ | ⚠️ stub (no stability guarantee) |
| TextInput widget | ✗ | ⚠️ likely not in 0.1 |
| Image widget | ✗ | ⚠️ likely not in 0.1 |
| Lazy list / virtualization | ✗ | ⚠️ likely not in 0.1 |
| Console.log → terminal | ✗ | ✓ |
| Source maps for stack traces | ✗ | ✓ |
| Bridge wire format versioned | ✗ | ✓ |
| Bytecode cache validated against runtime | ✗ | ✓ |
| Public docs site | ✗ | ✓ |
| Getting-started tutorial | ✗ | ✓ |
| LICENSE + CONTRIBUTING | ✗ (TBD) | ✓ |
| GitHub release workflow auto-publishes npm packages | ✗ | ✓ |
| Code-signed Desktop dmg by default | ✗ (config slot exists) | ⚠️ needs Apple cert |
| Code-signed Android APK by default | ✗ (config slot exists) | ⚠️ needs keystore |
| Per-platform CI green | ✓ | ✓ |
| Modular link scripts (no cross-platform coupling) | ✓ | ✓ |
| Strip + unstripped sibling for symbolication | ✓ Android + Desktop + iOS Sim | ✓ |
| Crash symbolication runbook | ✓ | ✓ |

The "✓" rows in the "Today" column are this session's accumulated
work; everything else is what stands between us and a public alpha
launch. Roughly 6-8 person-weeks of work to land Phase A + B + C
above.
