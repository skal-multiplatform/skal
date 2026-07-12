#!/usr/bin/env bash
# shoot-gallery.sh — regenerate the docs component screenshots.
#
#   examples/gallery/scripts/shoot-gallery.sh
#
# Pipeline: gen flow + docs data → JS bundle → iOS sim build → install →
# Maestro walks every demo (screenshot each) → crop/resize → copy into
# website/assets/components/ → rebuild docs/components.html.
#
# Prereqs: Xcode + an iPhone simulator, maestro CLI, Java 17+ (falls
# back to Android Studio's bundled JBR), python3 with PIL.
set -euo pipefail

APP="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$(cd "${APP}/../../website" && pwd)"

# Pin the device model so crops stay stable (status-bar/home-indicator
# offsets below assume the iPhone 15 Pro's 1179×2556 @3x screen).
UDID="${SKAL_GALLERY_SIM:-$(xcrun simctl list devices available | sed -n 's/.*iPhone 15 Pro (\([0-9A-F-]*\)).*/\1/p' | head -1)}"
[[ -n "${UDID}" ]] || { echo "error: no iPhone 15 Pro simulator found (set SKAL_GALLERY_SIM)" >&2; exit 1; }

cd "${APP}"
echo "→ generating flow + docs data"
bun scripts/gen-gallery.js

echo "→ building JS bundle"
bun run build > /dev/null

echo "→ building iOS simulator app"
( cd flutter-host && flutter build ios --simulator --debug )

echo "→ booting simulator ${UDID}"
xcrun simctl boot "${UDID}" 2>/dev/null || true
xcrun simctl bootstatus "${UDID}" -b > /dev/null

echo "→ installing app"
xcrun simctl install "${UDID}" flutter-host/build/ios/iphonesimulator/Runner.app

# Maestro 2.x needs Java 17+; fall back to Android Studio's JBR.
if ! java -version 2>&1 | grep -qE 'version "(1[7-9]|[2-9][0-9])' ; then
  export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

echo "→ walking demos with maestro"
rm -rf shots && mkdir shots
maestro test .maestro/gallery.yaml

echo "→ cropping + resizing → ${SITE}/assets/components/"
mkdir -p "${SITE}/assets/components"
python3 - "${SITE}/assets/components" <<'EOF'
import sys, glob, os
from PIL import Image

OUT = sys.argv[1]
# iPhone 15 Pro @3x: trim the status bar up top and the gallery's own
# prev/next bar + home indicator at the bottom. Tuned by eye against
# real captures — re-tune if the driver bar in src/App.jsx changes.
TOP, CROP_H, WIDTH = 380, 1200, 620

for p in sorted(glob.glob('shots/*.png')):
    im = Image.open(p)
    w, h = im.size
    im = im.crop((0, TOP, w, TOP + CROP_H))
    im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, os.path.basename(p)), optimize=True)
    print(f'  {os.path.basename(p)} → {im.width}x{im.height}')
EOF

echo "→ rebuilding docs/components.html"
node "${SITE}/build-components.mjs"

echo
echo "✓ component reference regenerated ($(ls shots | wc -l | tr -d ' ') shots)"
