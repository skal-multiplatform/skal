# Changelog

Versions here track **`@skal/cli`**, the package `npm create skal` installs —
it is the one version a user sees. `skal_flutter`, `create-skal` and
`@skal/create` version independently; where they moved, it is noted.

The **runtime** — the prebuilt `libskal` binaries and source tree the CLI
downloads — is versioned separately by GitHub release tag. See
[Runtime releases](#runtime-releases) at the bottom, because which runtime you
got is not implied by your CLI version.

## Unreleased

Everything on `main` since `@skal/cli` 0.1.3. A few packages from this window
are already published (table below). The rest reaches apps with the next
`libskal-dev` runtime release; apps that take `skal_flutter` from pub.dev also
need a new `skal_flutter` release.

> **Important — release apps kept running the JS they were first installed
> with.** Every app `skal create` has made so far is affected, on Android, iOS
> and macOS. Update the CLI, run `skal upgrade` inside the app, then rebuild
> and ship.
>
> - **What happened.** The app template copied `skal-app.cjs` and its `.jsc`
>   out of the assets only when no copy existed yet. An update keeps the app's
>   data directory — Play Store and App Store updates, `adb install -r`,
>   `flutter run`, a rebuilt macOS app — so after every update the app ran
>   the JS from its first install. After a Skal upgrade that old JS can also
>   fail to boot against the new libskal.
> - **The fix.** The copy moved to `flutter-host/lib/skal_bundle.dart` and is
>   re-checked on every launch. `bun run build` now writes
>   `flutter-host/assets/skal-app.stamp` (both sizes and a SHA-256 of the
>   pair), so a relaunch with nothing new compares those ~80 bytes and stats
>   two files instead of reading the bundle. A build without a stamp falls
>   back to comparing the `.cjs` byte for byte. The copy is flushed to disk
>   before its stamp is written, to guard against a power cut leaving a stamp
>   that vouches for bytes that never landed.
> - **Existing apps.** `skal doctor` reports the old code. `skal upgrade` and
>   `skal doctor --fix` add `skal_bundle.dart`, point the old
>   `_extractBytecodeAssets()` at it (in `main.dart` or wherever under `lib/`
>   it lives), add the stamp step to `build:bytecode`, and — for apps made
>   before 2026-07-19 — list `assets/` in `pubspec.yaml` so the stamp is
>   bundled at all. They replace only text Skal generated, `skal_bundle.dart`
>   included: once you edit it they leave it alone, and `skal doctor` says
>   so. The fix ships in the runtime, so it arrives with the first
>   `libskal-dev` release that includes it. Until then `skal doctor` warns
>   that your runtime predates it, and `skal upgrade` says there is nothing
>   to apply yet.
> - **Cost.** The first launch after each update now pays the copy that only a
>   fresh install paid before. On a Galaxy A14 release build with a 2 MB
>   bundle, content reached the screen a median 76 ms later than after an
>   update with nothing to copy (IQR 68–115 ms, n = 10; an earlier run read
>   50 ms). The copy itself is 22 ms of work, 6 ms of it the flush; the
>   template's 0.4 MB bundle copies in 12.8 ms. A relaunch pays +0.42 ms for
>   the new check (0.58 ms against the old code's 0.16 ms), with no
>   measurable difference in time to content on screen. On an M2 Mac release
>   build the same 2 MB copy took 2.9 ms (n=31), and relaunches were
>   unchanged within the noise. The flush gives only limited power-cut
>   protection: on both, `fsync` returns once the bytes are in the drive's
>   own cache, not yet on its flash (the A14 mounts `/data` as f2fs with
>   `fsync_mode=nobarrier`).
> - **kitchen-sink's earlier fix** compared only the `.cjs`, so the same JS
>   rebuilt by a different bun kept its stale bytecode and parsed from source
>   on every launch. It now uses `skal_bundle.dart` too.

- **`<pageView>` now pages horizontally unless you pass `axis={0}`; apps
  that relied on vertical paging must add it.** On native it read `axis`
  with the scrollers' fallback, so a `<pageView>` with no `axis` paged
  vertically, while its docs and the web target paged sideways. `axis`
  keeps the meaning it has on `<scrollView>` and `<listView>` (0 vertical,
  1 horizontal), so `axis={1}` is unchanged. The docs had said `axis={1}`
  made it vertical, which neither target ever did. On web, `axis={0}` now
  snaps page by page (it scrolled freely before), and clearing `axis` puts
  the pager back to horizontal instead of leaving it unable to scroll.
- **Builder-mode `<listView>` no longer shows blank rows on fast flings.** A
  `count` + `renderItem` list now builds rows one viewport past each edge
  once it has measured a row (Flutter's default is 250 px), sizes the rows it
  has not built from the mean of those it has measured instead of a fixed
  48 dp, and keeps images loading mid-fling, where Flutter by default holds
  back any image not yet cached until the list slows down. On a Galaxy A14
  release build, six max-speed flings through an image feed showed blank
  rows in 49–52% of frames before, and no blank row or unpainted image in any
  frame after (3 takes each). The look-ahead has a cost: every scroll,
  gentle ones included, now builds and lays out the rows one viewport past
  each edge.
- **An empty slot no longer takes a line and a gap, so existing layouts can
  shift.** Solid anchors a `{cond ? <X/> : null}` slot with an empty text
  node, and Skal drew it as a blank line of text. `<column>`, `<row>`,
  `<scrollView>` and `<wrap>` now leave it out, with gaps only between the
  children that remain; anywhere else it has zero size, and lists drop the
  gap beside it. A text-only post in the benchmark feed is 29.2 dp shorter
  (235.0 → 205.9 dp on a Galaxy A14). An empty `<text>` you wrote keeps its
  line, so a form's `<text label={error() ?? ''}>` still reserves the space
  before the error appears: the renderer now flags the text nodes it makes
  itself (`CREATE_ANON_TEXT`, below), and only those collapse.
- **An empty string child is not content either.** `{''}`, or `{name()}`
  while `name()` is `''`, reaches the host exactly as a slot marker does —
  Solid creates both with `createTextNode('')` — so it too takes no space
  and does not count as an item. The DOM, which Skal uses on web, lays out
  neither. A blank cell, option or line needs an element, such as
  `<text label="">` or `<box>`.
- **Slot markers no longer count as items.** `<tabs>`, `<navigator>`,
  `<segmentedButton>`, `<dropdown>`, `<stepper>`, `<lazyGrid>`,
  `<pageView>`, `<sliverGrid>` and `<reorderableListView>` each counted a
  marker as an item of its own — a blank tab, screen, segment, option, step,
  page or grid cell — and shifted every index after it, so `activeTab`,
  `onChange` and `onReorder` could name a different item in JS than on
  screen. They now skip markers, and that moves nothing: a tab or screen
  that a condition adds or removes leaves the others mounted, with their
  state. `<navigator>` counts only real screens when deciding whether system
  back pops a screen or passes through. Elements that show one child —
  `<tab>`, `<screen>`, `<step>`, `<dismissible>`, `<crossFade>` and others —
  show the first real one, not a marker ahead of it.
- **`OP_CREATE_NODE`'s third argument is now a flags field**, documented in
  `docs/PROPS.md`. Every create sent 0 there and no host read it.
  `CREATE_ANON_TEXT` (1) marks a text node the renderer made itself — a
  string child or a slot marker — rather than a `<text>` element. Either
  side can be older than the other: an older host ignores the flag and
  older JS sends 0, and either way every empty text keeps its line, as
  before.
- **New apps draw edge to edge, and their light or dark follows
  `setDesign`.** The template's host put every app in a light Material
  theme inside a `SafeArea`, so a dark app had light strips behind the
  status bar and the home indicator, dark status-bar icons and light
  Material widgets. The host now takes its theme from
  `setDesign(mode, 'light' | 'dark')` — the background, Material and
  Cupertino widgets, and the status-bar icons — and makes the status bar
  transparent. It leaves the insets to your JSX: wrap a screen's content in
  `<SafeArea>` (a route with a `title` gets a bar that insets itself). The
  starter `App.jsx`, `AGENTS.md` and the agent skill now do this. Existing
  apps keep their host; to adopt it, copy `SkalApp` from the template's
  `flutter-host/lib/main.dart` and add `<SafeArea>` where your screens need
  it.
- **`skal create --platforms ios` (or `macos`) gets its launcher icons.** It
  failed with `PathNotFoundException` on
  `android/app/src/main/AndroidManifest.xml` and kept Flutter's logo:
  flutter_launcher_icons does Android first and gave up at the missing
  `android/` project. `skal-icons.sh` (run by `skal create`, `bun run link`
  and `bun run icons`) now hands it the app's icon config without the
  platforms the app does not have.
- **`flutter test` works in a new app.** `flutter create` wrote its
  counter-app test to `flutter-host/test/widget_test.dart`, and it needs a
  `MyApp` that no Skal host has, so it did not compile. The template now
  ships its own, which tests the host's theme, status bar and edge-to-edge
  layout, and `flutter create` leaves it alone. `bun run test` also builds
  the JS bundle first, because the pubspec requires `assets/skal-app.js`.
  In an existing app, delete the stub.
- **Native builds no longer ship the web favicon.** The native vite build
  copied `public/favicon.png` into `flutter-host/assets/`, which the
  pubspec bundles whole, adding 37 KB to every app. The template's
  `vite.config.js` now sets `publicDir: false`; the web build still uses
  `public/`. In an existing app, add that line and delete
  `flutter-host/assets/favicon.png`.
- **On web, clearing `axis` no longer leaves a scroller unable to scroll.** A
  `<scrollView>`, `<listView>`, `<reorderableListView>` or
  `<customScrollView>` whose `axis` went back to `null` (say
  `axis={wide() ? 1 : null}`) lost its direction and overflow, which lays it
  out as a flex row that does not scroll. A cleared `axis` now restores the
  default vertical scroller, as `<pageView>` now does for its horizontal
  strip. Native was not affected.
- **New apps build without vite's `__dirname` warning.** A new app installs
  vite 8.3, which warned on every build that the template's
  `vite.config.js` used `__dirname`. ES modules don't have it, and vite's
  planned native config loader will not supply it. The template now uses
  `import.meta.dirname`. In an existing app, make the same change in
  `vite.config.js`.
- **`<scrollView>` and `<listView>` document `axis`.** Both scroll sideways
  with `axis={1}`, but neither their JSDoc nor the agent skill generated
  from it said so. Both now do, including that a horizontal `<listView>`
  needs a `height`.
- **Store** — engine handles are reused across hot-reload generations rather
  than leaked (`__skal_store_open` has no matching close, so every reload used
  to strand one). Covered by a 60-generation soak on both the native and JS
  branches, and by a test for the teardown flush that lands a debounced write
  before a reload tears its generation down.
- **`stats()` / `compact()`** guard their host hooks like their three
  siblings, so a JS bundle newer than the dylib degrades instead of throwing
  during store init.
- **`skal doctor`** gates Flutter 3.47, the floor `analyzer ^14` created via
  `meta >=1.18.3`.
- **`--hot` is now a no-op everywhere.** `skal dev` has always run the hot
  script; `--hot` selected nothing and `skal dev web --hot` exited non-zero on
  a flag that did nothing. Accepted and ignored on every target.
- **Scaffold** doc references point at GitHub rather than a `docs/` directory
  that does not exist in a generated app.
- **`Column`'s centring guidance was wrong** — `<Row alignment={1}>` centres
  nothing without `width="fill"`, because a Row is built `MainAxisSize.min`.
  Corrected in the JSDoc and the generated Claude skill reference.
- **Flutter Web (wasm) is now covered by CI.** The shape built and rendered
  but nothing guarded it.
- **CI cache**: one shared `vendor-src` entry instead of three that evicted
  each other inside a 10 GB budget.

Already published from this window, ahead of a CLI cut:

| package | version | date |
|---|---|---|
| `skal_flutter` | 0.2.0 | 2026-08-19 |
| `create-skal` | 0.1.1 | 2026-08-20 |
| `@skal/create` | 0.1.1 | 2026-08-20 |

`create-skal` / `@skal/create` 0.1.1 fix the launcher's dependency on
`@skal/cli`, which resolved through workspace hoisting locally but not from a
clean `npx` install.

### Known issues

Found while dogfooding, not yet fixed — see the repo issues:

- `weight` is accepted by the prop encoder but not implemented on Flutter, so
  flex layouts silently differ from web.
- On web, `onChange` hands the callback a DOM `Event` where native hands a
  value.
- Writing a collection element's field updates the store but does not appear
  to refresh bindings or memos reading it until an unrelated signal changes.

## 0.1.3 — 2026-08-17

Almost entirely store correctness and performance. Thirty-one fixes and twenty
performance changes, most of them in `createSkalStore` and the native engine.

- Hydration reads what is on disk rather than walking the shape of
  `initState`.
- The array format has a single owner, closing the notification gaps that
  split ownership hid.
- Key listing refuses a malformed buffer instead of silently returning a
  partial answer.
- Element release has one owner, and the holes around it are closed.
- `skal_codegen` reads `Duration` defaults from the constructor's own default
  expression instead of a private SDK field.
- **Breaking, toolchain**: `skal_codegen` moved to `analyzer ^14`, which
  requires `meta >=1.18.3` and therefore **Flutter 3.47+**. Older Flutters pin
  `meta 1.17.0` and will not resolve.

## 0.1.1 — 2026-07-18

- JS hot reload became the default dev command, and works on fresh apps across
  macOS, iOS and Android.
- Every scaffolded app ships an AI agent skill, mirrored into `.agents/`.
- Branded launcher icons and web favicon.
- Fixed a `dev:android` SIGPIPE crash.
- Docs site: `.md` mirrors, `llms.txt`, and a Copy-for-AI control.

`create-skal` and `@skal/create` stayed at 0.1.0 — they are thin launchers and
did not change.

## 0.1.0 — 2026-07-12

First public release. `npm create skal <name>` scaffolds a standalone app
against a shared `~/.skal` runtime. `create-skal` and `@skal/create` 0.1.0
shipped the same day; `skal_flutter` 0.1.0 followed on 2026-07-19.

---

## Runtime releases

The CLI downloads prebuilt `libskal` binaries from a GitHub release. The tag it
uses is **not** tied to your CLI version.

| tag | kind | notes |
|---|---|---|
| `libskal-dev` | **rolling** | The default (`runtime.js`). Overwritten on every release build, so two scaffolds days apart can differ with no version to tell them apart. |
| `libskal-v0.1.0` | immutable | First pinned runtime. Set `SKAL_RELEASE_TAG=libskal-v0.1.0` to hold one build. |

Each release carries a `manifest.json` recording `skal_commit`, the bun and
WebKit pins, and the `skal_entry.zig` hash — so a scaffolded app can always say
exactly which runtime it holds.

## Versions that never shipped

`@skal/cli` 0.1.2 was never published; npm goes 0.1.1 → 0.1.3.
