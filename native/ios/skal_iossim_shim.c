/*
 * iOS Simulator shims for libSystem symbols that exist on macOS's
 * libSystem.B.dylib but not on iOS Simulator's. Linked into
 * libskal.dylib by scripts/link-skal-dylib.sh so the resulting binary
 * is self-contained for the symbols WTF/JSC may call into.
 *
 * Currently the only such symbol is __clear_cache, called by JIT code
 * generators to invalidate the instruction cache. JSC's JIT is disabled
 * on iOS (no executable mmap entitlement in third-party apps), so this
 * is unreachable in practice — but the linker still needs to find a
 * definition at load time.
 *
 * On arm64 the compiler intrinsic __builtin___clear_cache emits the
 * required `dc cvau` / `ic ivau` / `dsb ish` / `isb` sequence inline,
 * so this wrapper is essentially a no-cost forward.
 */

#if defined(__APPLE__) && defined(__aarch64__)

void __clear_cache(void *begin, void *end) {
    /* __builtin___clear_cache is a clang intrinsic that emits the
     * appropriate cache-invalidation sequence for the target arch.
     * On arm64 it expands inline to no syscall. */
    __builtin___clear_cache((char *)begin, (char *)end);
}

#endif
