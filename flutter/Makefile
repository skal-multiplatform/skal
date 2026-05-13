# Skal-Flutter — build orchestration.
#
# The chain `JS source → bundle → bytecode → Flutter APK` has 3 hops
# and 2 places where stale files cause silent regressions:
#   1. If `skal-app.cjs.jsc` is older than the libskal JSC it has to
#      match, bun's module loader silently invalidates the cache and
#      falls back to parsing (~hundreds of ms penalty per cold launch
#      with no error). See `js-app/scripts/find-vendored-bun.sh`.
#   2. If `flutter/skal_flutter/assets/skal-app.{cjs,cjs.jsc}` is
#      older than what `js-app/` just built, the APK ships stale
#      bytecode (or no bytecode at all if the .cjs.jsc was deleted).
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

REPO       := $(realpath ..)
JS_APP     := $(REPO)/js-app
FLUTTER    := $(REPO)/flutter/skal_flutter
ASSETS     := $(FLUTTER)/assets
APK_DIR    := $(FLUTTER)/build/app/outputs/flutter-apk

JS_SRC     := $(shell find $(JS_APP)/src -name '*.js' -o -name '*.jsx' 2>/dev/null)
JS_BUNDLE  := $(ASSETS)/skal-app.js
JS_CJS     := $(ASSETS)/skal-app.cjs
JS_JSC     := $(ASSETS)/skal-app.cjs.jsc

.PHONY: help all bundle release debug profile clean

help:
	@echo "Skal-Flutter make targets:"
	@echo "  bundle    — rebuild skal-app.{js,cjs,cjs.jsc} from js-app/ sources"
	@echo "              and sync into flutter/skal_flutter/assets/"
	@echo "  debug     — bundle + flutter build apk --debug (arm64)"
	@echo "  profile   — bundle + flutter build apk --profile (arm64)"
	@echo "  release   — bundle + flutter build apk --release (arm64) — ships bytecode cache"
	@echo "  clean     — drop Flutter build artifacts"

all: release

# ── Bytecode bundle pipeline ─────────────────────────────────────────
#
# `bun run build` in js-app/ produces all three artifacts directly
# into `flutter/skal_flutter/assets/` (via vite.config.js's outDir +
# package.json's build:bytecode --outdir). No cp step needed.
$(JS_BUNDLE) $(JS_CJS) $(JS_JSC) &: $(JS_SRC)
	cd $(JS_APP) && bun run build

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

clean:
	cd $(FLUTTER) && flutter clean
