#!/usr/bin/env bash
# Run the native store's tests.
#
# `patches/skal_entry.zig` is a patch applied into vendor/bun, so it
# cannot be compiled on its own — but the store region inside it is
# std-only. This slices that region out VERBATIM between its markers,
# appends store_test.zig, and hands the result to `zig test`.
#
# Extracting rather than copying is the point: the tests run against the
# shipping source. If the markers move, or something bun-coupled lands
# between them, this fails instead of silently testing a stale duplicate.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
src="$repo/patches/skal_entry.zig"

# Bun's VENDORED zig, not whatever is on PATH. skal_entry.zig is
# compiled as part of bun, so it targets bun's pinned Zig — 0.15.2 at
# time of writing. Homebrew's 0.16 rejects it outright (std.fs.cwd() was
# removed), and "fixing" the source to satisfy the wrong compiler would
# break the actual build.
zig="$repo/vendor/bun/vendor/zig/zig"
if [ ! -x "$zig" ]; then
  echo "skal_native tests: vendored zig not found at $zig" >&2
  echo "  run scripts/setup.sh (or bun run build:libskal) first — skipping" >&2
  exit 0
fi

out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

{
  echo 'const std = @import("std");'
  awk '/─── SKAL STORE BEGIN/{f=1;next} /─── SKAL STORE END/{f=0} f' "$src"
  cat "$here/store_test.zig"
} > "$out/store_test.zig"

lines=$(wc -l < "$out/store_test.zig")
if [ "$lines" -lt 200 ]; then
  echo "skal_native tests: extraction produced only $lines lines — markers moved?" >&2
  exit 1
fi

"$zig" test "$out/store_test.zig"
