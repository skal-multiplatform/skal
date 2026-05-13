#ifndef SKAL_H
#define SKAL_H

/*
 * Skal C ABI — the surface dart:ffi (and any future C/C++/Swift
 * embedder) talks to.
 *
 * Six entry points: create a runtime, evaluate JS source, acquire the
 * shared bridge memory region, wake the JS worker for event dispatch,
 * free result strings, dispose the runtime.
 *
 * Semantics:
 *   - `skal_acquire_bridge` returns a raw pointer + length to a 2 MiB
 *     shared region. Both JS (via JSObjectMakeArrayBufferWithBytesNo
 *     Copy) and the host (via Pointer<Uint8>.asTypedList on Dart, or
 *     equivalent in other languages) view the same bytes.
 *   - `skal_evaluate` is synchronous — blocks the calling thread
 *     until the JS worker returns. Result + error indicator come
 *     back via out parameters.
 *
 * Implementation lives in patches/skal_entry.zig (compiled into
 * libskal alongside bun + JSC).
 */

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Returns a non-zero opaque handle on success, 0 on failure to start
 * the embedded JS runtime. Single-runtime apps call this once at
 * launch and pass the result through to every other function. */
int64_t skal_create_runtime(void);

/* Stops the runtime and releases its resources. The handle is invalid
 * after this call. Pass 0 to no-op. */
void skal_dispose_runtime(int64_t handle);

/* Evaluate `source` as a Program with the given URL (used for stack
 * traces). Synchronous — blocks the calling thread until the JS
 * worker returns.
 *
 * Output:
 *   *out_result       — UTF-8 bytes (NOT null-terminated) of the
 *                       result's toString. Owned by Skal; caller
 *                       must release with skal_free_string.
 *   *out_result_len   — length of *out_result in bytes.
 *   *out_is_error     — 1 if the script threw, 0 otherwise. When 1,
 *                       *out_result holds the exception's toString. */
void skal_evaluate(
    int64_t handle,
    const char* source, size_t source_len,
    const char* url, size_t url_len,
    char** out_result, size_t* out_result_len,
    int* out_is_error);

/* Free a result buffer returned by skal_evaluate. Safe to pass NULL. */
void skal_free_string(char* str);

/* Returns the shared bridge memory region. The pointer is owned by
 * Skal and remains valid until skal_dispose_runtime. Both
 * out_ptr and out_len are required. */
void skal_acquire_bridge(int64_t handle, void** out_ptr, size_t* out_len);

/* Wakes the JS worker so it drains any events the host has written
 * into the event ring. Called once per dispatched event; cheap and
 * lock-free. */
void skal_wake_js(int64_t handle);

#ifdef __cplusplus
}
#endif

#endif /* SKAL_H */
