# kitchen-sink — build orchestration.
#
# The chain `JS source → bundle → bytecode → Flutter APK` has 3 hops
# and 2 places where stale files cause silent regressions:
#   1. If `skal-app.cjs.jsc` is older than the libskal JSC it has to
#      match, bun's module loader silently invalidates the cache and
#      falls back to parsing (~hundreds of ms penalty per cold launch
#      with no error). See `scripts/find-vendored-bun.sh`.
#   2. If `flutter-host/assets/skal-app.{cjs,cjs.jsc}` is older than
#      what the JS build just produced, the APK ships stale bytecode
#      (or no bytecode at all if the .cjs.jsc was deleted).
#
# This Makefile wires them up so a single `make` command always
# produces a current APK from current JS source.
#
# Portability note: the grouped-target syntax (`a b &: deps`) below
# is GNU Make 4.3+. Stock macOS ships Make 3.81, which treats `&` as
# just whitespace — each recipe still runs, and because every recipe
# in this file is idempotent the result is correct. Install a newer
# Make from Homebrew (`brew install make`, then `gmake`) for fully
# correct semantics.

# Run from `examples/kitchen-sink/` — paths are local-relative.
REPO       := $(realpath ../..)
APP_DIR    := $(realpath .)
SKAL_JS    := $(REPO)/packages/skal-js
FLUTTER    := $(APP_DIR)/flutter-host
ASSETS     := $(FLUTTER)/assets
APK_DIR    := $(FLUTTER)/build/app/outputs/flutter-apk

# Source files that, when touched, should trigger a rebundle. Both the
# framework JS (skal-js) and the app's own JSX sources count.
JS_SRC     := $(shell { find $(SKAL_JS)/src -name '*.js' -o -name '*.jsx'; \
                        find $(APP_DIR)/src -name '*.js' -o -name '*.jsx'; } 2>/dev/null)
JS_BUNDLE  := $(ASSETS)/skal-app.js
JS_CJS     := $(ASSETS)/skal-app.cjs
JS_JSC     := $(ASSETS)/skal-app.cjs.jsc

.PHONY: help all bundle release debug profile macos ios-sim sync-ios test clean

help:
	@echo "kitchen-sink make targets:"
	@echo ""
	@echo "  Android APK:"
	@echo "    debug      — bundle + flutter build apk --debug (arm64)"
	@echo "    profile    — bundle + flutter build apk --profile (arm64)"
	@echo "    release    — bundle + flutter build apk --release (arm64) — ships bytecode cache"
	@echo ""
	@echo "  Other targets:"
	@echo "    macos      — bundle + flutter build macos --release"
	@echo "    ios-sim    — bundle + flutter build ios --simulator --debug"
	@echo "    sync-ios   — refresh ios/Frameworks/ dylibs from build/skal-ios*/"
	@echo "    test       — flutter test (Dart unit tests; no bundle needed)"
	@echo "    bundle     — rebuild skal-app.{js,cjs,cjs.jsc} into flutter-host/assets/"
	@echo "    clean      — drop Flutter build artifacts"
	@echo ""
	@echo "  iOS device release builds require an Apple signing identity and are not"
	@echo "  in the Makefile; run \`flutter build ios --release\` from flutter-host/."

all: release

# ── Bytecode bundle pipeline ─────────────────────────────────────────
#
# `bun run build` in `examples/kitchen-sink/` produces all three
# artifacts directly into `flutter-host/assets/` (see vite.config.js's
# outDir + package.json's build:bytecode --outdir). No cp step needed.
$(JS_BUNDLE) $(JS_CJS) $(JS_JSC) &: $(JS_SRC)
	cd $(APP_DIR) && bun run build

bundle: $(JS_BUNDLE) $(JS_CJS) $(JS_JSC)

# ── APK builds ──────────────────────────────────────────────────────
#
# Each target depends on the bundle being current. Make's mtime
# check handles "did the JS source change since last bundle" for free.

release: bundle
	cd $(FLUTTER) && flutter build apk --release --target-platform android-arm64
	@echo "✓ $(APK_DIR)/app-release.apk"

profile: bundle
	cd $(FLUTTER) && flutter build apk --profile --target-platform android-arm64
	@echo "✓ $(APK_DIR)/app-profile.apk"

debug: bundle
	cd $(FLUTTER) && flutter build apk --debug --target-platform android-arm64
	@echo "✓ $(APK_DIR)/app-debug.apk"

# ── Other targets ────────────────────────────────────────────────────
#
# macOS Desktop and iOS Simulator targets are convenience wrappers
# around the underlying `flutter build` commands documented in the
# README. They depend on `bundle` for the same reason the APK targets
# do — Flutter's asset pipeline picks up `assets/skal-app.*` directly,
# so a stale bundle would silently ship in the .app.

macos: bundle
	cd $(FLUTTER) && flutter build macos --release
	@echo "✓ $(FLUTTER)/build/macos/Build/Products/Release/kitchen_sink.app"

# ── iOS libskal freshness ────────────────────────────────────────────
#
# `flutter-host/ios/Frameworks/{iphoneos,iphonesimulator}/libskal.dylib`
# are CHECKED-IN copies of what the link scripts produce under
# `build/skal-ios*/`. Rebuild bun for iOS without re-copying and the
# Flutter build silently ships the previous dylib — the app runs, it is
# just not the code you built. (The macOS/Android equivalents are copied
# by `scripts/skal-link.sh` on every run, so only iOS carries this.)
#
# Same mtime trick as the bundle above: declare the copies as targets of
# their sources and Make refuses to leave them stale. Each variant is
# included only if its source exists — the iOS *device* dylib needs a
# from-source WebKit JSC build most checkouts do not have, and a missing
# prerequisite would otherwise be a hard error rather than a skip.
IOS_SIM_SRC := $(REPO)/build/skal-iossim/libskal.dylib
IOS_DEV_SRC := $(REPO)/build/skal-ios-device/libskal.dylib
IOS_SIM_DST := $(FLUTTER)/ios/Frameworks/iphonesimulator/libskal.dylib
IOS_DEV_DST := $(FLUTTER)/ios/Frameworks/iphoneos/libskal.dylib

IOS_LIBS := $(strip $(if $(wildcard $(IOS_SIM_SRC)),$(IOS_SIM_DST)) \
                    $(if $(wildcard $(IOS_DEV_SRC)),$(IOS_DEV_DST)))

$(IOS_SIM_DST): $(IOS_SIM_SRC)
	@mkdir -p $(dir $@) && cp $< $@ && echo "→ refreshed iOS Simulator libskal"

$(IOS_DEV_DST): $(IOS_DEV_SRC)
	@mkdir -p $(dir $@) && cp $< $@ && echo "→ refreshed iOS device libskal"

sync-ios: $(IOS_LIBS)

ios-sim: bundle sync-ios
	cd $(FLUTTER) && flutter build ios --simulator --debug
	@echo "✓ $(FLUTTER)/build/ios/iphonesimulator/Runner.app"

# Dart-only tests — framework tests live in packages/skal_flutter/test/.
# Run them from the framework package, not the host app.
test:
	cd $(REPO)/packages/skal_flutter && flutter test

clean:
	cd $(FLUTTER) && flutter clean
