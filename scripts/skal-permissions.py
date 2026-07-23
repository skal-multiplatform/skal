#!/usr/bin/env python3
"""Apply a Skal app's declared permissions to each platform's config.

docs/NATIVE_SUPPORT.md § "What no bridge design fixes": per-package
platform config — Info.plist usage strings, entitlements, AndroidManifest
entries — is real friction with nothing to do with the bridge. It is also
the half of the permissions story that no amount of Dart or JS solves,
because the OS reads these files before the app runs.

The dev declares INTENT once, in `flutter-host/skal-permissions.json`:

    {
      "camera":   "Scan QR codes and take profile photos",
      "location": "Show places near you",
      "photos":   "Attach images to a post"
    }

and this script translates it into four platform dialects. That
translation is the value: a dev should not have to know that "camera"
means `NSCameraUsageDescription` on iOS, the same key PLUS a
`com.apple.security.device.camera` entitlement on macOS, and
`android.permission.CAMERA` in a manifest — nor that forgetting the
macOS entitlement produces a silent failure rather than a prompt.

The usage string is not decoration. Apple rejects builds whose plist
keys are missing, and shows the string in the prompt itself, so a vague
one costs installs. Android ignores it, which is why it lives at the
capability level rather than per-platform.

Idempotent: safe to re-run on every link. Only ever ADDS keys — an
existing value (hand-edited, or from a previous run with different
copy) is left alone, so this never silently reverts a dev's wording.

Usage:  skal-permissions.py <app-root>
"""

import json
import os
import plistlib
import re
import sys

# ── Capability table ─────────────────────────────────────────────────
#
# The knowledge worth encoding. Each capability maps to:
#   ios/macos_plist:  Info.plist keys that take the usage string
#   macos_ent:        macOS App Sandbox entitlements (bool true)
#   android:          <uses-permission> names
#
# Capabilities are named for what the app WANTS, not for any one
# platform's spelling — that is the whole point of the indirection.
CAPABILITIES = {
    "camera": {
        "plist": ["NSCameraUsageDescription"],
        "macos_ent": ["com.apple.security.device.camera"],
        "android": ["android.permission.CAMERA"],
    },
    "microphone": {
        "plist": ["NSMicrophoneUsageDescription"],
        "macos_ent": ["com.apple.security.device.audio-input"],
        "android": ["android.permission.RECORD_AUDIO"],
    },
    "location": {
        "plist": ["NSLocationWhenInUseUsageDescription"],
        "macos_ent": ["com.apple.security.personal-information.location"],
        "android": [
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.ACCESS_COARSE_LOCATION",
        ],
    },
    # Background location is a separate, much harder review on both
    # stores — deliberately its own capability so nobody opts into it
    # by asking for "location".
    "locationAlways": {
        "plist": [
            "NSLocationWhenInUseUsageDescription",
            "NSLocationAlwaysAndWhenInUseUsageDescription",
        ],
        "macos_ent": ["com.apple.security.personal-information.location"],
        "android": [
            "android.permission.ACCESS_FINE_LOCATION",
            "android.permission.ACCESS_COARSE_LOCATION",
            "android.permission.ACCESS_BACKGROUND_LOCATION",
        ],
    },
    "photos": {
        "plist": ["NSPhotoLibraryUsageDescription"],
        "macos_ent": ["com.apple.security.assets.pictures.read-write"],
        "android": ["android.permission.READ_MEDIA_IMAGES"],
    },
    "photosAdd": {
        "plist": ["NSPhotoLibraryAddUsageDescription"],
        "macos_ent": ["com.apple.security.assets.pictures.read-write"],
        "android": ["android.permission.READ_MEDIA_IMAGES"],
    },
    "contacts": {
        "plist": ["NSContactsUsageDescription"],
        "macos_ent": ["com.apple.security.personal-information.addressbook"],
        "android": ["android.permission.READ_CONTACTS"],
    },
    "calendar": {
        "plist": ["NSCalendarsUsageDescription"],
        "macos_ent": ["com.apple.security.personal-information.calendars"],
        "android": ["android.permission.READ_CALENDAR"],
    },
    "bluetooth": {
        "plist": ["NSBluetoothAlwaysUsageDescription"],
        "macos_ent": ["com.apple.security.device.bluetooth"],
        "android": [
            "android.permission.BLUETOOTH_CONNECT",
            "android.permission.BLUETOOTH_SCAN",
        ],
    },
    "faceId": {
        "plist": ["NSFaceIDUsageDescription"],
        "macos_ent": [],
        "android": ["android.permission.USE_BIOMETRIC"],
    },
    # No plist key exists for notifications; the prompt is API-driven.
    # Android 13+ does require a manifest entry, which is exactly the
    # kind of asymmetry a dev should not have to remember.
    "notifications": {
        "plist": [],
        "macos_ent": [],
        "android": ["android.permission.POST_NOTIFICATIONS"],
    },
    "network": {
        "plist": [],
        "macos_ent": ["com.apple.security.network.client"],
        "android": ["android.permission.INTERNET"],
    },
    "files": {
        "plist": [],
        "macos_ent": ["com.apple.security.files.user-selected.read-write"],
        "android": [],
    },
}


# ── permission_handler Podfile macros ────────────────────────────────
#
# permission_handler compiles each iOS permission strategy only when its
# PERMISSION_* macro is set in the Podfile; without the macro, every
# request for that permission answers `permanentlyDenied` with no hint
# why (verified live on the iOS Simulator, 2026-07-23). That is exactly
# the class of per-platform folklore this script exists to encode, so
# when the app depends on permission_handler, the declared capabilities
# also inject their macros into ios/Podfile's post_install hook.
#
# Only capabilities that permission_handler models appear here (faceId
# is local_auth's, network/files need no macro).
PODFILE_MACROS = {
    "camera": "PERMISSION_CAMERA",
    "microphone": "PERMISSION_MICROPHONE",
    "location": "PERMISSION_LOCATION",
    "locationAlways": "PERMISSION_LOCATION",
    "photos": "PERMISSION_PHOTOS",
    "photosAdd": "PERMISSION_PHOTOS",
    "contacts": "PERMISSION_CONTACTS",
    "calendar": "PERMISSION_EVENTS_FULL_ACCESS",
    "bluetooth": "PERMISSION_BLUETOOTH",
    "notifications": "PERMISSION_NOTIFICATIONS",
}

_PODFILE_BLOCK_BEGIN = "    # skal-permissions: permission_handler macros (generated — edit skal-permissions.json)"
_PODFILE_BLOCK_END = "    # /skal-permissions"
_PODFILE_ANCHOR = "flutter_additional_ios_build_settings(target)"


def _apply_podfile_macros(app_root, caps):
    """Inject PERMISSION_* macros into ios/Podfile when the app uses
    permission_handler. Idempotent: a previously generated block is
    replaced in place; hand-written Podfile content is never touched."""
    pubspec = os.path.join(app_root, "pubspec.yaml")
    podfile = os.path.join(app_root, "ios", "Podfile")
    if not (os.path.exists(pubspec) and os.path.exists(podfile)):
        return 0
    pub_lines = open(pubspec, encoding="utf-8").read().splitlines()
    uses_ph = any(
        line.split("#", 1)[0].strip().startswith("permission_handler")
        for line in pub_lines)
    if not uses_ph:
        return 0

    macros = sorted({PODFILE_MACROS[c] for c in caps if c in PODFILE_MACROS})
    if not macros:
        return 0

    macro_lines = "".join(
        f"        '{m}=1',\n" for m in macros)
    block = (
        f"{_PODFILE_BLOCK_BEGIN}\n"
        "    target.build_configurations.each do |config|\n"
        "      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= "
        "['$(inherited)']\n"
        "      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] += [\n"
        f"{macro_lines}"
        "      ]\n"
        "    end\n"
        f"{_PODFILE_BLOCK_END}")

    src = open(podfile, encoding="utf-8").read()
    if _PODFILE_BLOCK_BEGIN in src and _PODFILE_BLOCK_END in src:
        pattern = re.compile(
            re.escape(_PODFILE_BLOCK_BEGIN) + r".*?" +
            re.escape(_PODFILE_BLOCK_END), re.DOTALL)
        updated = pattern.sub(lambda _: block, src)
        if updated == src:
            return 0
        open(podfile, "w", encoding="utf-8").write(updated)
        _log("  → ios/Podfile: refreshed permission_handler macro block")
        return 1
    if _PODFILE_ANCHOR not in src:
        _log("  ! ios/Podfile: no post_install "
             f"`{_PODFILE_ANCHOR}` anchor found — add the "
             "permission_handler macros manually (see its README)")
        return 0
    updated = src.replace(
        _PODFILE_ANCHOR, _PODFILE_ANCHOR + "\n" + block, 1)
    open(podfile, "w", encoding="utf-8").write(updated)
    _log(f"  → ios/Podfile: added {len(macros)} permission_handler "
         "macro(s) to post_install")
    return 1


def _log(msg):
    print(f"  {msg}")


def _load_declaration(app_root):
    path = os.path.join(app_root, "skal-permissions.json")
    if not os.path.isfile(path):
        return None, path
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, ValueError) as e:
        print(f"error: {path} is not valid JSON — {e}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(raw, dict):
        print(f"error: {path} must be a JSON object of "
              f"capability → usage string", file=sys.stderr)
        sys.exit(1)

    caps = {}
    unknown = []
    for name, usage in raw.items():
        if name.startswith("//") or name.startswith("_"):
            continue  # comment key
        if name not in CAPABILITIES:
            unknown.append(name)
            continue
        caps[name] = usage if isinstance(usage, str) else ""
    if unknown:
        known = ", ".join(sorted(CAPABILITIES))
        print(f"  ! unknown capability: {', '.join(unknown)}. Known: {known}")
    return caps, path


def _apply_plist(plist_path, caps, label):
    """Add usage strings. Never overwrites — a dev's wording wins."""
    if not os.path.isfile(plist_path):
        return 0
    try:
        with open(plist_path, "rb") as f:
            data = plistlib.load(f)
    except Exception as e:  # noqa: BLE001 - malformed plist, keep going
        print(f"  ! skipped {label}: {e}")
        return 0
    # A valid plist whose root is an array parses fine and then blows
    # up on `data[key] = ...` with an uncaught TypeError — which would
    # abort the whole script and leave every LATER platform
    # unconfigured. Same skip-and-continue treatment as a parse error.
    if not isinstance(data, dict):
        print(f"  ! skipped {label}: root is {type(data).__name__}, "
              f"expected dict")
        return 0
    added = 0
    for cap, usage in sorted(caps.items()):
        for key in CAPABILITIES[cap]["plist"]:
            if key in data:
                continue
            data[key] = usage or f"This app uses {cap}."
            added += 1
    if added:
        with open(plist_path, "wb") as f:
            # sort_keys=False: the default alphabetizes EVERY key on
            # the first write, burying the two added lines in a
            # full-file reorder diff of a file the dev owns — the exact
            # noise the Android function's text-insertion approach
            # exists to avoid.
            plistlib.dump(data, f, sort_keys=False)
        _log(f"→ {label}: added {added} usage string(s)")
    return added


def _apply_entitlements(ent_path, caps, label):
    if not os.path.isfile(ent_path):
        return 0
    try:
        with open(ent_path, "rb") as f:
            data = plistlib.load(f)
    except Exception as e:  # noqa: BLE001
        print(f"  ! skipped {label}: {e}")
        return 0
    if not isinstance(data, dict):
        print(f"  ! skipped {label}: root is {type(data).__name__}, "
              f"expected dict")
        return 0
    added = 0
    for cap in sorted(caps):
        for key in CAPABILITIES[cap]["macos_ent"]:
            if key in data:
                continue
            data[key] = True
            added += 1
    if added:
        with open(ent_path, "wb") as f:
            plistlib.dump(data, f, sort_keys=False)
        _log(f"→ {label}: added {added} entitlement(s)")
    return added


def _apply_android(manifest_path, caps):
    """Insert <uses-permission> before <application>.

    Text manipulation rather than an XML parse on purpose:
    ElementTree drops comments and rewrites attribute order, which
    would produce a large, unreviewable diff on a file the dev owns
    and Flutter's own tooling also edits.
    """
    if not os.path.isfile(manifest_path):
        return 0
    with open(manifest_path, "r", encoding="utf-8") as f:
        src = f.read()

    # The presence check must not see commented-out XML: a dev who
    # disables a permission the idiomatic way (<!-- <uses-permission
    # …/> -->) would otherwise satisfy the substring test, the entry
    # would never be (re)added, and Android alone silently lacked the
    # permission while iOS/macOS got their keys.
    live_src = re.sub(r"<!--.*?-->", "", src, flags=re.DOTALL)

    wanted = []
    for cap in sorted(caps):
        for perm in CAPABILITIES[cap]["android"]:
            if perm not in wanted:
                wanted.append(perm)
    missing = [p for p in wanted
               if f'android:name="{p}"' not in live_src]
    if not missing:
        return 0

    lines = "".join(
        f'    <uses-permission android:name="{p}"/>\n' for p in missing
    )
    m = re.search(r"^([ \t]*)<application\b", src, re.MULTILINE)
    if m:
        src = src[:m.start()] + lines + src[m.start():]
    else:
        m = re.search(r"<manifest\b[^>]*>\s*\n", src)
        if not m:
            print("  ! AndroidManifest.xml: no <manifest> or <application> "
                  "element found; skipped")
            return 0
        src = src[:m.end()] + lines + src[m.end():]

    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(src)
    _log(f"→ AndroidManifest.xml: added {len(missing)} permission(s)")
    return len(missing)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    app_root = sys.argv[1]
    caps, path = _load_declaration(app_root)
    if caps is None:
        return  # no declaration — nothing to do, and that is the default
    if not caps:
        return

    print(f"→ applying {len(caps)} declared permission(s) "
          f"from {os.path.basename(path)}")

    total = 0
    total += _apply_plist(
        os.path.join(app_root, "ios", "Runner", "Info.plist"),
        caps, "ios/Runner/Info.plist")
    total += _apply_plist(
        os.path.join(app_root, "macos", "Runner", "Info.plist"),
        caps, "macos/Runner/Info.plist")
    for variant in ("DebugProfile", "Release"):
        total += _apply_entitlements(
            os.path.join(app_root, "macos", "Runner",
                         f"{variant}.entitlements"),
            caps, f"macos/{variant}.entitlements")
    total += _apply_android(
        os.path.join(app_root, "android", "app", "src", "main",
                     "AndroidManifest.xml"),
        caps)
    total += _apply_podfile_macros(app_root, caps)

    if total == 0:
        _log("→ permissions already applied (nothing to change)")


if __name__ == "__main__":
    main()
