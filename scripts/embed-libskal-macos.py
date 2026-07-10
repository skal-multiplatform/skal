#!/usr/bin/env python3
"""Inject the "Embed libskal" build phase into a Flutter macOS Runner.xcodeproj.

`flutter create` generates a vanilla macOS project that does NOT copy
libskal.dylib into the built `.app`, so the runtime `dlopen('libskal.dylib')`
in skal_ffi_io.dart fails and the app black-screens at launch. This adds a
Run Script build phase that copies + ad-hoc-codesigns
`$(SRCROOT)/Frameworks/libskal.dylib` into the bundle's
`Contents/Frameworks/` on every build, where the default
`@executable_path/../Frameworks` rpath finds it.

The phase block lives verbatim in the sidecar file
embed-libskal-macos.phase.pbxproj (single source of truth — kitchen-sink
and every scaffolded app get the same block injected, and the sidecar
ships with standalone runtimes where examples/ doesn't exist).
Idempotent — a no-op if the phase is already present.

Usage: embed-libskal-macos.py <path/to/Runner.xcodeproj/project.pbxproj>
"""
import os
import re
import sys

# The embed-libskal phase id. Reused verbatim: a pbxproj id only has to be
# unique within its own file, and this one will never collide with the ids
# `flutter create` generates.
UUID = "C340D20DED384C259A635795"

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "embed-libskal-macos.phase.pbxproj")


def main(path):
    s = open(path).read()
    if UUID in s:
        print("embed-libskal: phase already present — skipping")
        return 0
    if not os.path.exists(REF):
        sys.stderr.write("embed-libskal: phase file not found at %s\n" % REF)
        return 1

    # 1. The phase block, verbatim (avoids any hand-escaping of the
    #    embedded shellScript string).
    block = open(REF).read()

    # 2. Insert the block before the section's End marker.
    END = "/* End PBXShellScriptBuildPhase section */"
    if END not in s:
        sys.stderr.write("embed-libskal: no PBXShellScriptBuildPhase section in target\n")
        return 1
    s = s.replace(END, block + END, 1)

    # 3. Reference the phase in the Runner native target's buildPhases list.
    #    Anchored on `/* Runner */ ... isa = PBXNativeTarget` so it's robust to
    #    Flutter template id changes.
    m = re.search(
        r"/\* Runner \*/ = \{\s*\n\s*isa = PBXNativeTarget;.*?buildPhases = \(\n(.*?)\n(\s*)\);",
        s, re.S)
    if not m:
        sys.stderr.write("embed-libskal: Runner target buildPhases not found\n")
        return 1
    entries, close_indent = m.group(1), m.group(2)
    new_entries = entries + "\n" + close_indent + "\t" + UUID + " /* ShellScript */,"
    s = s[:m.start(1)] + new_entries + s[m.end(1):]

    open(path, "w").write(s)
    print("embed-libskal: build phase added")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.stderr.write("usage: embed-libskal-macos.py <project.pbxproj>\n")
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
