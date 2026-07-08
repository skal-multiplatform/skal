# Symbolicating native crashes

When `libskal.{so,dylib}` SIGSEGVs, the OS gives you a hex address into
the dylib's `__text` segment and not much else. This doc is the
runbook for turning that into a source line.

The unstripped sibling is the load-bearing part of every platform's
link script — `scripts/link-libskal-flutter.sh` (Android),
`scripts/link-libskal-flutter-mac.sh` (macOS),
`scripts/link-skal-iossim.sh`, and `scripts/link-skal-ios.sh` all keep
it next to the stripped output:

```
build/skal-android/libskal.unstripped.so
build/skal-darwin/libskal.unstripped.dylib
build/skal-iossim/libskal.unstripped.dylib
```

These are big (90 MB + DWARF) and gitignored, but **you must keep them
around for any crash you want to symbolicate**. CI uploads them as
build artifacts (`*.unstripped.*` — see `.github/workflows/{android,
desktop,ios-sim}.yml`); for local dev, they sit in
`build/skal-<platform>/` next to the stripped sibling.

Build IDs let you confirm a given crash trace matches a specific
unstripped binary — see § "Verifying you have the right unstripped
binary" below.

---

## Android

Crash log source: `adb logcat | grep -E "(SIGSEGV|tombstone|fault addr)"`
or `adb shell cat /data/tombstones/<latest>`.

### Example tombstone

```
DEBUG   :     #00 pc 00000000012ec5b0  /data/app/.../libskal.so (BuildId: 9890e957...)
DEBUG   :     #01 pc 00000000012f08c4  /data/app/.../libskal.so (BuildId: 9890e957...)
```

The relevant fields:
- `pc` — program counter offset into the dylib (we want this)
- `BuildId` — UUID matching the unstripped sibling (verify before symbolicating)

### Resolving to source

```sh
# Verify the build-id matches the unstripped binary you have
/opt/homebrew/opt/llvm@21/bin/llvm-readelf -n build/skal-android/libskal.unstripped.so | grep -i "build id"

# Symbolicate one frame
/opt/homebrew/opt/llvm@21/bin/llvm-addr2line \
    -e build/skal-android/libskal.unstripped.so \
    -fpC \
    0x12ec5b0
# → outputs e.g. "Skal.workerMain at vendor/bun/src/skal_entry.zig:230"

# Symbolicate the whole stack at once (paste pc list to stdin)
echo "0x12ec5b0
0x12f08c4
0x12fa1bc" | /opt/homebrew/opt/llvm@21/bin/llvm-addr2line \
    -e build/skal-android/libskal.unstripped.so -fpC
```

### Common gotchas

* Tombstone shows `pc = 0xXXXXXXXX_relative_to_libskal_load_addr`,
  NOT absolute virtual address. `llvm-addr2line -e <unstripped.so>
  <pc>` already does the right thing — it treats the offset as
  module-relative.
* If `BuildId` doesn't match your local unstripped, the binary on
  device was built somewhere else (CI upload, prior dev session). Pull
  the matching unstripped from the relevant CI artifact and re-run.
* Some PC values resolve to `??:0` — those are inside compiler-rt or
  WTF helpers that bun's debug info doesn't cover. Walk one frame up
  in the trace; the caller usually does have debug info.

---

## macOS Desktop

Crash log source:
- `~/Library/Logs/DiagnosticReports/skal_flutter-*.ips` (modern format)
- `Console.app` → Crash Reports

### Example .ips snippet

```json
{
  "exception": {"type":"EXC_BAD_ACCESS","signal":"SIGSEGV"},
  "threads": [{"frames":[
    {"imageOffset":15822512,"imageIndex":7},
    {"imageOffset":15823456,"imageIndex":7}
  ]}],
  "usedImages": [
    {"name":"libskal.dylib","uuid":"9890E957-...","base":4400611328}
  ]
}
```

The key: `imageOffset` (relative to the image's base) and the
`uuid` of the matching image entry.

### Resolving to source

```sh
# Verify uuid matches your unstripped dylib
xcrun dwarfdump --uuid build/skal-darwin/libskal.unstripped.dylib

# Symbolicate via atos. The -l flag is the load address from .ips
# `usedImages[i].base`; -o points at the unstripped binary; the hex
# at the end is the absolute address (base + imageOffset).
xcrun atos \
    -o build/skal-darwin/libskal.unstripped.dylib \
    -l 0x106800000 \
    0x107D71810
# → outputs e.g. "Skal.workerMain (in libskal.dylib) (skal_entry.zig:230)"

# Or, simpler: ask atos with image-relative offset (use -o without -l)
xcrun atos \
    -o build/skal-darwin/libskal.unstripped.dylib \
    -arch arm64 \
    --offset 0xf17ab0
```

---

## iOS Simulator

Crash log source: `~/Library/Logs/DiagnosticReports/Runner-*.ips` —
Simulator crashes land in the host machine's DiagnosticReports dir,
named after the iOS Runner.app process (Flutter's default iOS target
is named `Runner`). Real iOS device crashes come via `Window →
Devices and Simulators → View Device Logs` in Xcode.

The `usedImages` entry to look for is `libskal.dylib` from inside the
embedded `.app` bundle (path includes `/Frameworks/libskal.dylib`).

### Resolving to source

Same commands as macOS Desktop, but pointing at the iOS Sim
unstripped sibling:

```sh
xcrun atos \
    -o build/skal-iossim/libskal.unstripped.dylib \
    -arch arm64 \
    --offset 0xf17ab0
```

The vtool re-stamp from MACOS to IOSSIMULATOR doesn't change the
DWARF debug info — line numbers resolve correctly against the
pre-stamp dylib too if that's what you happen to have around.

---

## Verifying you have the right unstripped binary

Every native lib produced by Skal embeds a build-id (Android:
`--build-id=sha1` in `scripts/link-libskal-flutter.sh`;
macOS: linker default, computed from the input hashes). The crash
log includes it; if your local unstripped's
build-id doesn't match, **don't trust the line numbers** — they'll
either be wrong or `llvm-addr2line` will resolve to `??:0`.

```sh
# Android
/opt/homebrew/opt/llvm@21/bin/llvm-readelf -n libskal.unstripped.so \
    | grep -i "build id"

# macOS / iOS Sim
xcrun dwarfdump --uuid libskal.unstripped.dylib
```

The hex that comes back must equal the `BuildId` (Android) or `uuid`
(Mach-O) field in the crash log.

---

## Bun-side crashes

Crashes inside `vendor/bun/build/release/bun-zig.*.o` symbolicate the
same way — they're in libskal.{so,dylib} like everything else.
Filenames in the resolved source position will look like
`vendor/bun/src/<something>.zig:<line>`, since Zig debug info is
preserved through the link.

If the crash is in a deps tree (e.g. `vendor/lsquic/...`), you may
need bun's own dSYM bundle for full Apple-style symbolication on
macOS:

```sh
ls vendor/bun/build/release/bun-profile.dSYM
xcrun dsymutil --symbol-map vendor/bun/build/release/bun-profile.dSYM \
    libskal.unstripped.dylib
```

Most crashes won't need this; the `.unstripped.dylib`'s embedded
DWARF covers all the common paths.

---

## Why we keep the unstripped sibling instead of a separate dSYM

macOS supports separate `.dSYM` bundles (DWARF in a sidecar). Linux
typically uses split debug via `objcopy --only-keep-debug`. We could
go either way, but keeping a single `*.unstripped.{so,dylib}` works
on every platform, plays well with the link scripts (`xcrun strip
-o stripped unstripped`), and `addr2line` / `atos` accept the
unstripped binary directly. The downside is one ~90 MB file per
platform that has to live somewhere CI can find. We accept that
cost.

The alternative — extracting `.dSYM` per build and uploading
separately — is something to revisit when CI artifact storage cost
becomes a real concern.
