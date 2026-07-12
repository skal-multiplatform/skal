#!/usr/bin/env python3
"""Inject the "Embed libskal" build phase into a Flutter Runner.xcodeproj.

`flutter create` generates a vanilla Xcode project that does NOT copy
libskal.dylib into the built `.app`, so the runtime `dlopen('libskal.dylib')`
in skal_ffi_io.dart fails and the app black-screens at launch. This adds a
Run Script build phase that copies + ad-hoc-codesigns the dylib into the
bundle's Frameworks/ on every build, where the default
`@executable_path/../Frameworks` rpath finds it.

The phase blocks live verbatim in sidecar files (single source of truth —
kitchen-sink and every scaffolded app get the same block injected, and the
sidecars ship with standalone runtimes where examples/ doesn't exist):

  embed-libskal-macos.phase.pbxproj   macOS: $(SRCROOT)/Frameworks/libskal.dylib
  embed-libskal-ios.phase.pbxproj     iOS:   $(SRCROOT)/Frameworks/$(PLATFORM_NAME)/…
                                             (device vs simulator picked at build time)

Idempotent — a no-op if the phase is already present.

Usage: embed-libskal-macos.py <path/to/Runner.xcodeproj/project.pbxproj> [phase-file]
       (phase-file defaults to the macOS sidecar; pass the iOS one for ios/)
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_REF = os.path.join(HERE, "embed-libskal-macos.phase.pbxproj")


def main(path, ref):
    if not os.path.exists(ref):
        sys.stderr.write("embed-libskal: phase file not found at %s\n" % ref)
        return 1

    # The phase block, verbatim (avoids any hand-escaping of the embedded
    # shellScript string). Its id is on the first line — a pbxproj id only
    # has to be unique within its own file, so reusing it never collides
    # with the ids `flutter create` generates.
    block = open(ref).read()
    m = re.match(r"\s*([0-9A-F]{24}) /\* (.*?) \*/", block)
    if not m:
        sys.stderr.write("embed-libskal: can't parse phase id from %s\n" % ref)
        return 1
    uuid, label = m.group(1), m.group(2)

    s = open(path).read()
    if uuid in s:
        print("embed-libskal: phase already present — skipping")
        return 0

    # 1. Insert the block before the section's End marker.
    END = "/* End PBXShellScriptBuildPhase section */"
    if END not in s:
        sys.stderr.write("embed-libskal: no PBXShellScriptBuildPhase section in target\n")
        return 1
    s = s.replace(END, block + END, 1)

    # 2. Reference the phase in the Runner native target's buildPhases list.
    #    Anchored on `/* Runner */ ... isa = PBXNativeTarget` so it's robust to
    #    Flutter template id changes.
    m = re.search(
        r"/\* Runner \*/ = \{\s*\n\s*isa = PBXNativeTarget;.*?buildPhases = \(\n(.*?)\n(\s*)\);",
        s, re.S)
    if not m:
        sys.stderr.write("embed-libskal: Runner target buildPhases not found\n")
        return 1
    entries, close_indent = m.group(1), m.group(2)
    new_entries = entries + "\n" + close_indent + "\t" + uuid + " /* " + label + " */,"
    s = s[:m.start(1)] + new_entries + s[m.end(1):]

    open(path, "w").write(s)
    print("embed-libskal: build phase added (%s)" % label)
    return 0


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.stderr.write("usage: embed-libskal-macos.py <project.pbxproj> [phase-file]\n")
        sys.exit(2)
    sys.exit(main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else DEFAULT_REF))
