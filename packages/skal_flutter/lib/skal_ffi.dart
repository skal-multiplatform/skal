// dart:ffi bindings for libskal's C ABI.
//
// libskal bundles an entire bun + JavaScriptCore runtime (~87 MB on
// arm64). The seven exported entry points (`skal_create_runtime`,
// `skal_dispose_runtime`, `skal_evaluate`, `skal_free_string`,
// `skal_acquire_bridge`, `skal_wake_js`, `skal_prewarm_store`) are
// what dart:ffi binds to; the contract is in
// packages/skal_native/include/skal.h.
//
// Two things matter for performance:
//
//   - `skal_acquire_bridge` returns a pointer + length to a 2 MiB
//     shared region that both JS (via JSObjectMakeArrayBufferWithBytes
//     NoCopy) and any embedder (here, Dart) write into. We materialize
//     it as a `Pointer<Uint8>` and view it as a `Uint8List` via
//     `asTypedList(len)` — zero copy, zero per-byte FFI cost.
//
//   - Once the bridge pointer is acquired, ops & strings pass through
//     the shared buffer; only ~3 FFI calls fire per frame
//     (skal_wake_js to nudge the JS worker, skal_evaluate for one-off
//     scripts). dart:ffi overhead (~100 ns/call) is negligible at
//     this rate.

import 'dart:convert';
import 'dart:ffi';
import 'dart:io' show Platform;
import 'dart:typed_data';
import 'package:ffi/ffi.dart';

/// Lazy-loaded handle to libskal — `.so` on Android, `.dylib` on
/// macOS/iOS. We never close it; bun's VM tear-down is process-exit
/// only (see `skal_dispose_runtime` no-op in skal_entry.zig).
///
/// Per-platform lookup:
///
///   - Android: jniLibs/<abi>/libskal.so is auto-extracted by the
///     loader; `DynamicLibrary.open('libskal.so')` finds it.
///
///   - macOS: Xcode's "Embed Frameworks" build phase copies
///     `Frameworks/libskal.dylib` into `Contents/Frameworks/` of
///     the .app bundle. We registered `@rpath/libskal.dylib` as the
///     install_name and the bundle has `@executable_path/../Frameworks`
///     in its rpath search list, so `DynamicLibrary.open('libskal.dylib')`
///     resolves through the standard dyld path.
///
///   - iOS: same as macOS — Frameworks/ inside the .app, code-signed
///     by Xcode's embed-and-sign step. Simulator and device share
///     the loader path; only the dylib's binary architecture differs.
final DynamicLibrary _lib = () {
  if (Platform.isAndroid) {
    return DynamicLibrary.open('libskal.so');
  }
  if (Platform.isMacOS || Platform.isIOS) {
    return DynamicLibrary.open('libskal.dylib');
  }
  throw UnsupportedError(
    'skal_ffi: no libskal mapping for ${Platform.operatingSystem}',
  );
}();

// ──────────────────────────────────────────────────────────────────────
// Native function signatures.
// Naming convention: `_N` = native C signature, no underscore = Dart side.
// ──────────────────────────────────────────────────────────────────────

typedef _NCreateRuntime = Int64 Function(Pointer<Uint8>, IntPtr);
typedef _CreateRuntime = int Function(Pointer<Uint8>, int);
final _CreateRuntime _createRuntime =
    _lib.lookupFunction<_NCreateRuntime, _CreateRuntime>('skal_create_runtime');

typedef _NDisposeRuntime = Void Function(Int64);
typedef _DisposeRuntime = void Function(int);
final _DisposeRuntime _disposeRuntime =
    _lib.lookupFunction<_NDisposeRuntime, _DisposeRuntime>('skal_dispose_runtime');

typedef _NEvaluate = Void Function(
  Int64 handle,
  Pointer<Uint8> source,
  IntPtr sourceLen,
  Pointer<Uint8> url,
  IntPtr urlLen,
  Pointer<Pointer<Uint8>> outResult,
  Pointer<IntPtr> outResultLen,
  Pointer<Int32> outIsError,
);
typedef _Evaluate = void Function(
  int handle,
  Pointer<Uint8> source,
  int sourceLen,
  Pointer<Uint8> url,
  int urlLen,
  Pointer<Pointer<Uint8>> outResult,
  Pointer<IntPtr> outResultLen,
  Pointer<Int32> outIsError,
);
final _Evaluate _evaluate =
    _lib.lookupFunction<_NEvaluate, _Evaluate>('skal_evaluate');

typedef _NFreeString = Void Function(Pointer<Uint8>);
typedef _FreeString = void Function(Pointer<Uint8>);
final _FreeString _freeString =
    _lib.lookupFunction<_NFreeString, _FreeString>('skal_free_string');

typedef _NAcquireBridge = Void Function(
  Int64 handle, Pointer<Pointer<Void>> outPtr, Pointer<IntPtr> outLen);
typedef _AcquireBridge = void Function(
  int handle, Pointer<Pointer<Void>> outPtr, Pointer<IntPtr> outLen);
final _AcquireBridge _acquireBridge =
    _lib.lookupFunction<_NAcquireBridge, _AcquireBridge>('skal_acquire_bridge');

typedef _NWakeJs = Void Function(Int64);
typedef _WakeJs = void Function(int);
final _WakeJs _wakeJs = _lib.lookupFunction<_NWakeJs, _WakeJs>('skal_wake_js');

typedef _NPrewarmStore = Void Function(Int64, Pointer<Uint8>, IntPtr);
typedef _PrewarmStore = void Function(int, Pointer<Uint8>, int);
final _PrewarmStore _prewarmStore = _lib
    .lookupFunction<_NPrewarmStore, _PrewarmStore>('skal_prewarm_store');

// ──────────────────────────────────────────────────────────────────────
// Dart-side ergonomics.
// ──────────────────────────────────────────────────────────────────────

/// Result of `Skal.evaluate`.
class EvalResult {
  final String value;
  final bool isError;
  EvalResult(this.value, this.isError);

  @override
  String toString() => isError ? 'EvalError($value)' : 'Eval($value)';
}

/// A handle to a live bun runtime + its shared bridge buffer.
class Skal {
  final int handle;
  final Pointer<Uint8> bridgePtr;
  final int bridgeLen;

  /// Zero-copy Dart view of the bridge memory. Reads and writes here
  /// are visible to JS (and vice versa) within the same memory model
  /// constraints as the JS-side `Uint8Array` view.
  final Uint8List bridge;

  Skal._(this.handle, this.bridgePtr, this.bridgeLen) : bridge = bridgePtr.asTypedList(bridgeLen);

  /// [dataDir] is the host's base data directory. libskal installs it
  /// as `globalThis.__skal_data_dir` so the JS store reads it
  /// synchronously instead of an async RPC. Pass '' to opt out.
  static Skal? create(String dataDir) {
    final dirBytes = utf8.encode(dataDir);
    // calloc<Uint8>(0) is undefined — allocate at least one byte.
    final dirPtr = calloc<Uint8>(dirBytes.isEmpty ? 1 : dirBytes.length);
    final int h;
    try {
      if (dirBytes.isNotEmpty) {
        dirPtr.asTypedList(dirBytes.length).setAll(0, dirBytes);
      }
      h = _createRuntime(dirPtr, dirBytes.length);
    } finally {
      calloc.free(dirPtr);
    }
    if (h == 0) return null;

    final outPtr = calloc<Pointer<Void>>();
    final outLen = calloc<IntPtr>();
    try {
      _acquireBridge(h, outPtr, outLen);
      final p = outPtr.value;
      final n = outLen.value;
      if (p == nullptr || n == 0) {
        _disposeRuntime(h);
        return null;
      }
      return Skal._(h, p.cast<Uint8>(), n);
    } finally {
      calloc.free(outPtr);
      calloc.free(outLen);
    }
  }

  EvalResult evaluate(String source, {String url = 'skal:eval'}) {
    // PROPER UTF-8 encoding. Earlier impl used `source.codeUnits`
    // which returns UTF-16 code units — for any non-ASCII codepoint
    // (emoji, smart quotes, etc.) those are > 0xFF and would be
    // truncated by `& 0xff`, corrupting the source. JSC then either
    // fails to parse (silent undefined return) or runs garbled code.
    // utf8.encode produces the byte sequence JSC's parser expects.
    final srcBytes = utf8.encode(source);
    final urlBytes = utf8.encode(url);
    final srcPtr = calloc<Uint8>(srcBytes.length);
    final urlPtr = calloc<Uint8>(urlBytes.length);

    final outResult = calloc<Pointer<Uint8>>();
    final outResultLen = calloc<IntPtr>();
    final outIsError = calloc<Int32>();

    try {
      // Copy via the asTypedList view so we get a SIMD-friendly memcpy
      // path (Dart AOT lowers Uint8List.setAll on contiguous buffers).
      srcPtr.asTypedList(srcBytes.length).setAll(0, srcBytes);
      urlPtr.asTypedList(urlBytes.length).setAll(0, urlBytes);
      _evaluate(handle, srcPtr, srcBytes.length, urlPtr, urlBytes.length,
          outResult, outResultLen, outIsError);

      final resultPtr = outResult.value;
      final resultLen = outResultLen.value;
      final isError = outIsError.value != 0;

      String value;
      if (resultPtr == nullptr || resultLen == 0) {
        value = '';
      } else {
        // The result buffer is owned by Skal (libc-malloc'd inside
        // bun). It's UTF-8 too — use utf8.decode for correctness;
        // allowMalformed for defense against unexpected non-UTF-8
        // (shouldn't happen but errors here shouldn't crash the app).
        final view = resultPtr.asTypedList(resultLen);
        value = utf8.decode(view, allowMalformed: true);
        _freeString(resultPtr);
      }
      return EvalResult(value, isError);
    } finally {
      calloc.free(srcPtr);
      calloc.free(urlPtr);
      calloc.free(outResult);
      calloc.free(outResultLen);
      calloc.free(outIsError);
    }
  }

  void wakeJs() => _wakeJs(handle);

  /// Begin opening the native store on a background thread so its
  /// segment scan overlaps JS runtime init + bundle evaluation. Call
  /// once, right after create(), with the directory the JS side will
  /// request. Best-effort — `__skal_store_open` falls back to a
  /// synchronous open if the prewarm hasn't run or failed.
  void prewarmStore(String dir) {
    final bytes = utf8.encode(dir);
    final ptr = calloc<Uint8>(bytes.length);
    try {
      ptr.asTypedList(bytes.length).setAll(0, bytes);
      _prewarmStore(handle, ptr, bytes.length);
    } finally {
      calloc.free(ptr);
    }
  }

  void dispose() => _disposeRuntime(handle);
}
