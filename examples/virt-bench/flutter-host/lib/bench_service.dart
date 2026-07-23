// Bench-only service — the Dart half of the bridge-RPC benchmarks.
//
// docs/NATIVE_SUPPORT.md § "Measure before A2 — five numbers" requires
// real numbers for the RPC path before codegen emits hundreds of
// methods on top of it. This file is the instrumented counterpart the
// JS bench calls; the numbers land in docs/BENCHMARKS.md § Bench 4.
//
// Every method is deliberately trivial on the Dart side — the point is
// to measure the *transport*, so the host work must round to zero. The
// one exception is `makeJson` / `makeString`, where producing the
// payload IS the thing under test.
//
// This is a bench harness, not an example of how to write a service.
// For that, see the doc comment on registerService in
// packages/skal_flutter/lib/skal/services.dart.

import 'dart:async';

import 'package:skal_flutter/skal/services.dart';

/// Deterministic filler so payload sizes are reproducible run to run
/// and the JSON encoder can't cheat on repeated substrings the way it
/// might with a single repeated character.
const String _alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

String _filler(int bytes) {
  if (bytes <= 0) return '';
  final buf = StringBuffer();
  while (buf.length < bytes) {
    buf.write(_alphabet);
  }
  return buf.toString().substring(0, bytes);
}

/// A Map whose `jsonEncode` output is approximately [bytes] long.
/// Shaped like a realistic service reply (a handful of scalar fields
/// plus one list of records) rather than one giant string, so the
/// encoder cost reflects structure walking and not just a memcpy.
Map<String, Object?> _payload(int bytes) {
  const overheadPerRecord = 48; // rough: keys, braces, commas, quotes
  final records = <Map<String, Object?>>[];
  var produced = 0;
  var i = 0;
  while (produced < bytes) {
    final textLen = (bytes ~/ 8).clamp(4, 64);
    records.add({
      'id': i,
      'lat': 38.7223 + i * 0.0001,
      'lng': -9.1393 - i * 0.0001,
      'ok': i.isEven,
      'label': _filler(textLen),
    });
    produced += textLen + overheadPerRecord;
    i++;
    if (i > 20000) break; // safety valve
  }
  return {
    'platform': 'bench',
    'count': records.length,
    'records': records,
  };
}

int _asInt(Object? v, int fallback) =>
    v is int ? v : (v is num ? v.toInt() : fallback);

/// Register the `bench` service. Call before `runApp`.
void registerBenchService() {
  registerService('bench', (String method, List<Object?> args) {
    switch (method) {
      // ── 1. Round-trip latency ───────────────────────────────────
      // The cheapest possible method. Anything measured here is pure
      // transport: op write → ring drain → dispatch → reply write →
      // event drain → Promise resolve.
      case 'nop':
        return 1;

      // ── 2. JSON encode / decode cost ────────────────────────────
      // `makeJson` measures Dart-encode + JS-parse (reply direction).
      // `echoJson` measures both directions: JS-stringify + Dart-decode
      // on the way in, Dart-encode + JS-parse on the way out.
      case 'makeJson':
        return _payload(_asInt(args.isEmpty ? null : args[0], 1024));
      case 'echoJson':
        return args.isEmpty ? null : args[0];

      // Same payload size, no JSON: the control for benchmark 2. The
      // delta between makeString(n) and makeJson(n) is what the
      // encoder actually costs.
      case 'makeString':
        return _filler(_asInt(args.isEmpty ? null : args[0], 1024));

      // Arg-shape control: how much does an inbound JSON arg cost when
      // the reply is trivial? Isolates the JS→Dart half.
      case 'sink':
        return args.length;

      // ── 3/4/5. Streams ──────────────────────────────────────────
      // burst(count, payloadBytes) emits `count` events as fast as the
      // event loop allows. payloadBytes == 0 emits bare ints (typed,
      // zero heap traffic); > 0 emits a JSON map of that size, which is
      // what a naively generated frame-rate service would do.
      //
      // Emission is scheduled through a plain async* loop so Dart's
      // microtask queue — not a timer — governs the rate. That is the
      // worst case for the JS side, which is the case worth measuring.
      case 'burst':
        final count = _asInt(args.isEmpty ? null : args[0], 1000);
        final payloadBytes = _asInt(args.length > 1 ? args[1] : null, 0);
        return _burst(count, payloadBytes);

      // Slow, human-paced stream — the low-rate class from the
      // performance contract. Sanity check that JSON per event at
      // ≤10 Hz is genuinely free.
      case 'ticker':
        final periodMs = _asInt(args.isEmpty ? null : args[0], 100);
        final count = _asInt(args.length > 1 ? args[1] : null, 20);
        return Stream<Object?>.periodic(
          Duration(milliseconds: periodMs),
          (i) => {'tick': i, 'at': DateTime.now().microsecondsSinceEpoch},
        ).take(count);
    }
    throw 'bench: unknown method "$method"';
  });
}

Stream<Object?> _burst(int count, int payloadBytes) async* {
  final payload = payloadBytes > 0 ? _payload(payloadBytes) : null;
  for (var i = 0; i < count; i++) {
    yield payload == null ? i : {'i': i, ...payload};
  }
}
