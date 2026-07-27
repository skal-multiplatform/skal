#ifndef SKAL_H
#define SKAL_H

/*
 * Skal C ABI — the surface dart:ffi (and any future C/C++/Swift
 * embedder) talks to.
 *
 * Ten entry points: create a runtime (one per process), ask whether
 * that create reused an existing one, evaluate JS source, acquire the
 * shared bridge memory region, wake the JS worker for event dispatch,
 * free result strings, dispose the runtime, prewarm the native store
 * on a background thread, and register the host doorbell (two calls).
 *
 * Semantics:
 *   - `skal_acquire_bridge` returns a raw pointer + length to a 6 MiB
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
 * the embedded JS runtime. Call once at launch and pass the result
 * through to every other function.
 *
 * ONE runtime per process: a second call returns the FIRST runtime's
 * handle (see skal_runtime_was_reused for why, and for what the host
 * must do about the JS state that survived).
 *
 * `dir` is the host's base data directory, published to JS as
 * `globalThis.__skal_data_dir` so the store can read it synchronously
 * instead of via an async round trip. UTF-8, NOT null-terminated;
 * `dir_len` is its byte length. Pass NULL/0 to opt out.
 *
 * (This declaration previously read `skal_create_runtime(void)` — a
 * silent ABI drift of exactly the kind README.md warns about, since a
 * non-Dart embedder compiling against it would have passed no
 * arguments at all.) */
int64_t skal_create_runtime(const char* dir, size_t dir_len);

/* Retires the handle. Pass 0 to no-op.
 *
 * Do NOT use the handle after this call — but be aware of what the
 * implementation actually does, because the two differ: bun's VM has no
 * teardown short of process exit, so this is currently a no-op and the
 * runtime is leaked deliberately (patches/skal_entry.zig). Nothing is
 * freed and nothing is invalidated.
 *
 * The contract is still "the handle is dead", so that a future release
 * CAN free it without breaking callers. This comment previously stated
 * the release as fact. */
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

/* Begin opening the native key/value store on a background thread, so
 * its segment scan overlaps JS runtime init + bundle evaluation. Call
 * once, right after skal_create_runtime, passing the directory the JS
 * side will later request via __skal_store_open. `dir` is UTF-8, NOT
 * null-terminated; `dir_len` is its byte length. Best-effort — any
 * failure just means the store opens synchronously on first use. */
void skal_prewarm_store(int64_t handle, const char* dir, size_t dir_len);

/* ── Host doorbell (optional) ──────────────────────────────────────
 *
 * The mirror of skal_wake_js. JS calls `globalThis.__skal_notifyHost()`
 * after committing a batch containing a logic RPC; libskal then posts to
 * a Dart native port so the host can drain the op ring immediately
 * instead of waiting for its next frame. The signal carries no payload —
 * everything the host needs is already in the shared ring.
 *
 * A host that registers neither keeps whatever drain schedule it had.
 *
 * Dart-only today: it is deliberately built on Dart's native-port ABI
 * rather than a plain callback, because posting to a DEAD port is
 * refused, while calling a stale function pointer after the owning
 * isolate is gone is undefined behaviour. Skal's runtime is never
 * disposed and its JS worker outlives a Flutter hot restart, so a stale
 * target is a routine occurrence, not an edge case. */

/* Returns 1 when the most recent skal_create_runtime handed back an
 * EXISTING runtime rather than building one.
 *
 * There is ONE runtime per process, by necessity: the JS VM is created
 * with `is_main_thread = true` and mutates process-global JSC state, so
 * a second init invalidates the first VM's heap and the first VM traps
 * on its next allocation. A host that tears down and re-enters main()
 * — Flutter hot restart does exactly this — therefore gets the same
 * handle and the same bridge buffer back.
 *
 * The JS side is still the PREVIOUS generation at that point. A host
 * seeing 1 here must reset it (skal_flutter does this via
 * `Skal.evaluateApp`, which prepends the hot coordinator's teardown)
 * rather than evaluating a second copy of the bundle on top. */
int32_t skal_runtime_was_reused(void);

/* Hand libskal dart:ffi's `NativeApi.initializeApiDLData` so it can
 * resolve `Dart_PostInteger` from the VM's API table. Returns 1 on
 * success, 0 if the symbol wasn't found (doorbell stays disabled).
 * Call once before skal_set_host_port. */
int32_t skal_init_dart_api(void* initialize_api_dl_data);

/* Register the native port to post to; 0 clears it. Re-registering
 * replaces the previous port. */
void skal_set_host_port(int64_t handle, int64_t port);

#ifdef __cplusplus
}
#endif

#endif /* SKAL_H */
