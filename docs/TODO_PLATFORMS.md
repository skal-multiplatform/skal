# Skal — path to public dev platform

Skal isn't an app — it's a tool other devs use to write apps. This
doc tracks what's between today's monorepo (where the demo IS the
project) and "third-party can `npx skal create my-app && skal build
android` on a clean machine without ever touching `vendor/bun` or
Flutter's gradle internals."

For the perf decision log see [`PERFORMANCE.md`](PERFORMANCE.md).
For deferred items see [`TODO.md`](TODO.md).

---

## 0. Definition of "ready to be public"

A third-party dev on a fresh macOS/Linux machine can:

1. `npx skal create my-app` — scaffold a new Skal project
2. `cd my-app && skal dev` — boots an Android emulator + iOS
   simulator + Desktop + Web in parallel; live-reloads on JS edits
3. `skal build android --release` — produces a signed, ready-to-
   upload APK with bytecode cache + R8 minification
4. `skal build ios --release` — produces a signed `.ipa` for
   TestFlight
5. `skal build macos / linux / windows --release` — produces a
   signed installer
6. `skal build web --release` — produces a static-site bundle

None of those steps require:
- Cloning bun
- Setting up an Android NDK + LLVM 21 toolchain
- Knowing what `link-libskal-flutter.sh` does

## 1. Per-platform status

### 1.1 Android
- ✓ Working release APK (41 MB compressed, bytecode cache, AOT
  Dart, lazyColumn virtualization)
- ◇ Signing: today uses Flutter's debug-key fallback. Need
  Play-Store-uploadable signing flow.
- ◇ ABI splits: today arm64-v8a only. Some apps will need
  armeabi-v7a (32-bit) for older devices. bun cross-compiles to
  armeabi-v7a — link script needs minor adaptation.
- ◇ App Bundle (.aab) over APK for Play Store.

### 1.2 iOS
- ✓ Simulator: working, fast (60 FPS, 2 ms frame, pump 5 ms)
- ✓ Device release: build pipeline produces an unsigned 79 MB
  Runner.app for arm64. Verified the right dylib is embedded
  (LC_BUILD_VERSION platform=IPHONEOS).
- ◇ Code signing: needs a configured Apple Developer team. Open
  Xcode, set Team ID + Bundle Identifier, then `flutter build ipa`.
- ◇ TestFlight upload: post-signing, `xcrun altool --upload-app` or
  Xcode Organizer. Test with at least one real device.
- ◇ JSC version sanity on real iOS: the iOS dylib's JSC must
  produce the same bytecode the host bun produces. Verify by
  installing a release-built `.ipa` and checking the cold-launch
  log shows `result=skal-app loaded` (bytecode hit) not a stack
  trace (silent parser fallback).

### 1.3 Desktop (macOS / Linux / Windows)
- ✓ macOS: working, fastest target (init 11 ms, eval 31 ms).
  Sandboxed by default; `getApplicationSupportDirectory()` works.
- ◇ Linux: `flutter create --platforms=linux .`, then a
  `link-libskal-flutter-linux.sh` that takes bun's linux build
  output (`vendor/bun/build/linux/`) and produces a `libskal.so`
  with skal_* exports. Wire into `linux/CMakeLists.txt` as an
  imported target.
- ◇ Windows: same shape for win64. bun's Windows build target
  exists; the libskal link script + Visual Studio project
  integration are the new work.

### 1.4 Web
- ✓ Solid + DOM via `js-app/src/renderer-web.js` + `vite.config.web.js`
- ◇ Production build pipeline: `vite build --config vite.config.web.js`
  produces a `dist/` static site, but it's not part of the
  Makefile yet.
- ◇ Component parity with the Flutter side: when adding a new
  `<widget>` type, the web renderer must learn to emit the
  matching DOM shape. Today this is hand-maintained; should be
  code-gen'd from a single schema (see [TODO.md](TODO.md) §"Web
  target — Flutter→DOM consistency").

## 2. Plugin ecosystem (the "RN replacement" promise)

A Skal app needs to be able to call:

- Camera (`pub.dev/packages/camera`)
- Geolocation (`pub.dev/packages/geolocator`)
- Biometric auth (`pub.dev/packages/local_auth`)
- File picker
- Push notifications (FCM / APNs)
- Deep links
- In-app purchase
- Contacts, calendar, photos
- Bluetooth / NFC
- Sensors

Each of these is a published Flutter plugin with federated platform
implementations. Wiring them into Skal:

1. Dart-side shim: `@skal/camera/lib/skal_camera.dart` exports a
   Dart function `openCamera(...)` that calls the pub.dev camera
   plugin's Dart API.
2. JS-side stub: `@skal/camera/index.js` exports an `openCamera`
   function that crosses the bridge to call the Dart shim.
3. Bridge protocol extension: a new opcode (or extension of
   `OP_BIND_HANDLER`) carries the "call plugin function" payload.
   Async results come back via the event ring with a correlation ID.

~50 LOC of Dart per plugin once the dispatcher is built. The
dispatcher itself is ~200 LOC and lives in
`flutter/skal_flutter/lib/skal/plugins.dart` (not yet written).

## 3. SDK distribution

### 3.1 Build artifact distribution
Today: clone the repo, build everything from source. Each platform's
libskal takes 30+ min to build from a cold checkout.

End state: per-platform pre-built libskal binaries live on a CDN,
keyed by:
- Skal version (1.0.0)
- Bun commit hash (the bytecode-version compat anchor)
- Platform (android-arm64, ios-arm64-device, ios-arm64-sim, etc.)

`npx skal create` downloads the right binary for the user's target
and stashes it under `node_modules/@skal/native-android-arm64/lib/`
or similar. Flutter shells pick them up via the same Frameworks/
pattern we use now.

### 3.2 `skal` CLI
The orchestration that today lives in `flutter/Makefile` becomes a
proper CLI:

```
skal create <name>      # scaffold
skal build <platform>   # produce release artifact
skal dev                # all platforms, live-reload
skal upgrade            # bump skal-native binaries
```

Likely ~1000 LOC of TypeScript wrapping `flutter build` / `xcrun` /
`adb`.

### 3.3 Documentation site
- Getting started (5-min counter app)
- Component reference (`<column>`, `<lazyColumn>`, `<text>`, …)
- Prop reference (with platform-quirk callouts)
- Plugin recipes (camera, geo, …)
- Performance guide (when to use hot vs cold props, when to use
  `<lazyColumn>` vs `<scrollColumn>`, etc.)
- Migration guides (RN → Skal, native → Skal)

## 4. Open questions

### 4.1 Versioning model
Today: monorepo, no versions. End state: `@skal/runtime` versions
pin to specific `libskal` builds. How granular? Per-bun-commit feels
right since that's the bytecode-compat anchor.

### 4.2 Browser DevTools integration
For development we currently use logcat / Xcode console / Flutter
DevTools. End state: a unified inspector that knows about Skal's
node tree, can pause + step through Solid effects, can view the
bridge wire state. Probably a Flutter DevTools extension.

### 4.3 Background JS execution
The bridge today is foreground-only (JS worker thread lives only
while the app is in foreground). For push-notification handlers,
background fetch, etc., we'd need to keep the JS runtime alive
across app states. Not impossible (bun's worker can outlive the
UI), but lifecycle ownership needs design.
