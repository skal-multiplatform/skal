/*
 * Stub implementation of the Skal C entry surface for iOS.
 *
 * This file exists so the Kotlin/Native cinterop pipeline links cleanly
 * end-to-end before Phase 2 of docs/ios-port.md (real bun cross-compile
 * to iOS) ships. Every function returns sentinels:
 *
 *   skal_create_runtime    →   1   (success-shaped sentinel; non-zero so
 *                                  callers don't trip "init failed")
 *   skal_dispose_runtime   →  no-op
 *   skal_evaluate          →  out_result = duplicated "skal-ios:stub" string,
 *                              out_is_error = 1
 *   skal_free_string       →  free()
 *   skal_acquire_bridge    →  out_ptr = malloc'd zeroed 2 MiB region,
 *                              out_len = 2 MiB. The pointer is leaked
 *                              (one allocation per process; acceptable
 *                              for a stub that's about to be replaced).
 *   skal_wake_js           →  no-op
 *
 * The stub buffer is a per-process allocation, NOT shared with any JS
 * runtime — there's no real bun here. SkalBridge will see an all-zero
 * header forever, so pumpOps will always early-return and SkalRoot
 * mounts an empty tree. That matches expectations: the iOS placeholder
 * UI we already ship doesn't try to use SkalRoot anyway.
 *
 * Replace this file with a real implementation (or just stop linking it
 * in favor of the iOS-built skal_entry.zig output) when Phase 2 lands.
 */

#include "skal.h"

#include <stdlib.h>
#include <string.h>

#define SKAL_BRIDGE_SIZE (2 * 1024 * 1024)

int64_t skal_create_runtime(void) {
    /* Return a non-zero handle so callers don't bail with "init failed".
     * The value itself is meaningless — every other stub function
     * ignores it. Real impl will return a pointer-sized opaque handle. */
    return 1;
}

void skal_dispose_runtime(int64_t handle) {
    (void)handle;
}

void skal_evaluate(
    int64_t handle,
    const char* source, size_t source_len,
    const char* url, size_t url_len,
    char** out_result, size_t* out_result_len,
    int* out_is_error)
{
    (void)handle;
    (void)source;
    (void)source_len;
    (void)url;
    (void)url_len;

    static const char kStubMessage[] = "skal-ios:stub (no real runtime yet)";
    const size_t n = sizeof(kStubMessage) - 1;
    char* buf = (char*)malloc(n);
    if (buf == NULL) {
        *out_result = NULL;
        *out_result_len = 0;
        *out_is_error = 1;
        return;
    }
    memcpy(buf, kStubMessage, n);
    *out_result = buf;
    *out_result_len = n;
    /* Always flag as an error so callers know they're running without a
     * real runtime — the message goes through Skal's error path on the
     * Kotlin side, not its result path. */
    *out_is_error = 1;
}

void skal_free_string(char* str) {
    free(str);
}

void skal_acquire_bridge(int64_t handle, void** out_ptr, size_t* out_len) {
    (void)handle;
    /* Lazy single-allocation. We don't track per-runtime ownership; Skal
     * iOS in this stub form has at most one runtime per process. */
    static void* gBridge = NULL;
    if (gBridge == NULL) {
        void* p = calloc(1, SKAL_BRIDGE_SIZE);
        /* If alloc fails, we just return NULL — the Kotlin side already
         * checks for that case and surfaces it as a runtime error. */
        gBridge = p;
    }
    *out_ptr = gBridge;
    *out_len = (gBridge != NULL) ? SKAL_BRIDGE_SIZE : 0;
}

void skal_wake_js(int64_t handle) {
    (void)handle;
}
