#!/usr/bin/env bash
# Re-link bun's Android object files as libskal.so (shared library) with
# our JNI entry symbols added. Takes the same input set bun's build used
# for the bun-profile executable, but flips -pie to -shared and drops the
# version-script + dynamic-list so JNI exports are visible.
#
# Prerequisites:
#   1. bun's Android build completed (build/android/bun-profile exists)
#   2. scripts/build/skal-android/skal_jni.o compiled (our JNI entry)
set -euo pipefail

SKAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUN_DIR="${SKAL_ROOT}/vendor/bun"
BUN_BUILD="${BUN_DIR}/build/android"
SKAL_BUILD="${SKAL_ROOT}/build/skal-android"
NDK="/opt/homebrew/share/android-ndk"
SYSROOT="${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/sysroot"
LLVM_BIN="/opt/homebrew/opt/llvm@21/bin"
LLD="${LLVM_BIN}/ld.lld"
CXX="${LLVM_BIN}/clang++"

if [[ ! -f "${BUN_BUILD}/build.ninja" ]]; then
  echo "error: bun Android build not found at ${BUN_BUILD}" >&2
  echo "       run: cd vendor/bun && bun scripts/build.ts --profile=android-release --build-dir=$(realpath --relative-to=. ${BUN_BUILD})" >&2
  exit 1
fi

# Note: src/skal_jni.c was the original C stub. The real JNI bridge now
# lives in vendor/bun/src/skal_entry.zig and is baked into the bun-zig.*.o
# files. We don't link skal_jni.o anymore.

# Extract the input .o + .a list from bun's build.ninja "build bun-profile: link"
# Drop the "build bun-profile: link " prefix, line continuations, and the
# implicit-input markers (| at end). The file references at the end
# (symbols.dyn, linker.lds) are dropped — they're inputs to the version-script
# and dynamic-list flags, which we're not using.
INPUTS_FILE="${SKAL_BUILD}/skal-link-inputs.rsp"

# Note on symbol-version handling: we used to combine bun's linker.lds with
# a SKAL_1.0 script. Switching to -pie + --no-dynamic-linker (below) made
# the version-script unnecessary — JSC bun-zig generic mangling embeds `@`
# chars that lld misparses as `symbol@version` only under -shared, and
# -pie bypasses that path. We rely on --export-dynamic-symbol to pin JNI
# exports.

# Ninja stmt format:
#   build bun-profile: link a.o b.o $\n    c.o d.o $\n    e.o\n  ldflags = ...\n
# Each non-empty content line ends with " $" (line continuation). Final line
# of inputs has no trailing $. After that comes "  ldflags = ..." (variable
# binding, indented, contains =). Stop there.
awk '
  /^build bun-profile: link / {
    capture = 1
    sub(/^build bun-profile: link /, "")
    sub(/[[:space:]]*\$$/, "")   # strip trailing line-continuation
    print
    next
  }
  capture {
    # Variable binding lines are 2-space-indented "key = value" — stop here.
    if ($0 ~ /^[[:space:]]+[a-zA-Z_][a-zA-Z_0-9]*[[:space:]]*=/) { capture = 0; next }
    sub(/^[[:space:]]+/, "")     # leading whitespace
    sub(/[[:space:]]*\$$/, "")   # trailing line-continuation
    print
  }
' "${BUN_BUILD}/build.ninja" \
  | tr ' ' '\n' \
  | grep -vE '^\s*$|^\|$|symbols\.dyn$|linker\.lds$|^\$$' \
  > "${INPUTS_FILE}"

echo "$(wc -l < "${INPUTS_FILE}") link inputs extracted from build.ninja"

# JNI symbols come from skal_entry.zig (compiled into bun-zig.*.o by bun's build)

# Link flags — derived from bun's ldflags but:
#   -pie  → -shared       (we're producing a .so, not an executable)
#   --version-script and --dynamic-list dropped (they constrain exports;
#     we want JNI symbols visible)
LDFLAGS=(
  --target=aarch64-unknown-linux-android28
  --sysroot="${SYSROOT}"
  --rtlib=compiler-rt
  --unwindlib=libunwind
  -stdlib=libc++
  -static-libstdc++
  -L"${NDK}/toolchains/llvm/prebuilt/darwin-x86_64/lib/clang/21/lib/linux/aarch64"
  -Wl,--eh-frame-hdr
  --ld-path="${LLD}"
  -fPIC
  # bun's bun-zig.*.o files contain Zig generic instantiation symbols
  # whose names embed `@` (e.g. `clap.Args(@as(...))`). lld parses these
  # as `symbol@version` whenever -shared is set. -pie is a position-
  # independent executable (ET_DYN with an interpreter) and Android's
  # dlopen accepts ET_DYN files even with an interpreter set, so we link
  # as -pie and strip the interpreter at the linker step.
  -pie
  -Wl,--no-dynamic-linker
  -Wl,--as-needed
  -Wl,-z,stack-size=12800000
  -Wl,-z,lazy
  -Wl,-z,norelro
  -Wl,-O2
  -Wl,-z,combreloc
  -Wl,--hash-style=both
  -Wl,--build-id=sha1
  -Wl,--gc-sections
  -Wl,-icf=safe
  -Wl,-Bsymbolic-functions
  # JNI symbols come from skal_jni.o which is otherwise unreferenced (the
  # bun runtime doesn't know about Skal's JNI bridge). --undefined keeps
  # the symbol from being GC'd; --export-dynamic-symbol puts it in the
  # dynamic symtab so dlsym/JNI lookup finds it.
  -Wl,--undefined=JNI_OnLoad
  -Wl,--undefined=Java_com_skal_Skal_nativeCreateRuntime
  -Wl,--undefined=Java_com_skal_Skal_nativeDisposeRuntime
  -Wl,--undefined=Java_com_skal_Skal_nativeEvaluate
  -Wl,--export-dynamic-symbol=JNI_OnLoad
  -Wl,--export-dynamic-symbol=Java_com_skal_Skal_*
  # bun's Zig objects carry symbol-version annotations referring to the
  # BUN_1.2 version. We use a combined version script that includes both
  # bun's BUN_1.2 (so dangling references resolve) and our SKAL_1.0 (so
  # JNI symbols are visible).
  # Note: bun's executable build uses --version-script + --dynamic-list to
  # restrict exports. We cannot reuse that script: bun's bun-zig.*.o files
  # contain Zig generic instantiations whose names embed `@` (e.g.
  # `clap.Args(@as(...))`). lld parses every `@` in a symbol as the start
  # of a version annotation, and any version not declared in the script
  # becomes an error. With -shared (instead of -pie) this rejection is
  # strict. So we omit the version script entirely; default visibility is
  # already `hidden` for the bun .o files (`-fvisibility=hidden` in CXXFLAGS),
  # and our JNI symbols are explicitly JNIEXPORT (default visibility), so
  # only what we want ends up in the dynamic symbol table.
  -lc -lm -llog
)

UNSTRIPPED="${SKAL_BUILD}/libskal.unstripped.so"
OUT="${SKAL_BUILD}/libskal.so"
echo "linking ${UNSTRIPPED}"
cd "${BUN_BUILD}"   # so relative paths in the .rsp resolve
"${CXX}" "@${INPUTS_FILE}" "${LDFLAGS[@]}" -o "${UNSTRIPPED}"

# Strip non-export symbols from the shipped .so. --strip-unneeded drops
# everything not needed for relocations or dynamic linking; -x adds
# "remove all local symbols" (debug syms etc.). Keeps the JNI export
# table intact — those symbols are hard-anchored via --export-dynamic-symbol
# above, so the linker marked them as required-dynamic.
#
# Why two outputs: ART loads libskal.so via System.loadLibrary, which only
# needs the dynamic symbol table — debug syms are dead weight in the APK
# (~60 MB of dead weight for our build). We keep the unstripped sibling
# under build/skal-android/ for symbolicating native crashes via
# llvm-addr2line + the build-id from logcat. See docs/crash-symbolication.md
# (TODO_PLATFORMS § 1.4).
"${LLVM_BIN}/llvm-strip" --strip-unneeded -x "${UNSTRIPPED}" -o "${OUT}"

echo
echo "✓ libskal.so produced (stripped + unstripped):"
ls -la "${OUT}" "${UNSTRIPPED}"
file "${OUT}"
echo
echo "JNI symbols (stripped binary, must still be present):"
"${LLVM_BIN}/llvm-nm" -D "${OUT}" 2>/dev/null | grep -E "JNI_OnLoad|Java_com_skal" || true
