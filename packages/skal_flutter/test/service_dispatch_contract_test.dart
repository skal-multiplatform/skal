// The BEHAVIOURAL half of the codegen contract.
//
// skal_codegen's tests assert what the generator EMITS (structural
// assertions plus, since 2026-07-25, a real compile check on the demo's
// generated file). Neither can catch an emitted shape that compiles
// perfectly and does the wrong thing at runtime — which is exactly what
// shipped:
//
//   • a host controller's `Future<void>` method was emitted as
//     `ctl.m(); return null;`. Compiles. Discards the future. An
//     awaiting JS caller resolved on DISPATCH instead of completion,
//     and a throw inside became an unhandled Dart async error instead
//     of a promise rejection.
//
// These tests pin the runtime contract the generator targets, through
// the real `registerService` / `dispatchService` path. What the bridge
// does with the return value (`packages/skal_flutter/lib/skal/bridge.dart`,
// `case opInvokeMethod`) is:
//
//   result is Stream        → subscribe
//   result is Future        → .then(reply, onError: error)   ← awaited
//   otherwise               → reply immediately with the value
//
// So "did the generator hand the bridge a Future?" IS "will the JS
// promise settle on completion?". That is the property under test.
//
// The dispatcher bodies below deliberately mirror the two shapes the
// generator emits, byte for byte in structure. They are a mirror, not
// the generated code itself — skal_codegen is a pure-Dart package and
// its output imports Flutter, so it cannot be run from here. The
// generator's structural assertions are what keep the mirror honest;
// these tests are what say the mirrored shapes behave correctly.


import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/services.dart';

/// Stand-in for a wrapped class, so a test can observe whether the work
/// actually ran before the dispatcher's return value settled.
class _Probe {
  int value = 0;
  bool syncVoidRan = false;

  void bareVoid() {
    syncVoidRan = true;
  }

  Future<void> slowReset() async {
    await Future<void>.delayed(const Duration(milliseconds: 30));
    value = 0;
  }

  Future<void> boom() async {
    await Future<void>.delayed(const Duration(milliseconds: 5));
    throw StateError('boom');
  }

  Future<int> answer() async => 42;
}

void main() {
  late _Probe probe;

  setUp(() {
    probe = _Probe()..value = 7;

    // EXACTLY the arm shapes skal_codegen emits.
    registerService('probe', (String method, List<Object?> args) {
      switch (method) {
        // Bare synchronous void: called as a STATEMENT, then `return
        // null`. A void expression has no value, so it cannot be
        // returned — putting one in return position makes the whole
        // dispatcher closure infer as void and refuses to compile.
        case 'bareVoid':
          probe.bareVoid();
          return null;
        // Future<void>: RETURNED, so the bridge awaits it.
        case 'slowReset':
          return probe.slowReset();
        case 'boom':
          return probe.boom();
        case 'answer':
          return probe.answer();
      }
      throw 'unknown method "$method"';
    });
  });

  group('service dispatch contract', () {
    test('bare sync void replies immediately, and the work already ran',
        () async {
      final r = dispatchService('probe.bareVoid', const []);

      expect(r, isNot(isA<Future>()),
          reason: 'a sync void must NOT hand the bridge a Future — the '
              'bridge would then wait on something that never carries a '
              'result');
      expect(r, isNull, reason: 'replies with void/null');
      expect(probe.syncVoidRan, isTrue,
          reason: 'the call is a statement, so it has already happened '
              'by the time the dispatcher returns');
    });

    test('Future<void> is RETURNED, so completion is observable', () async {
      final r = dispatchService('probe.slowReset', const []);

      expect(r, isA<Future>(),
          reason: 'THE regression: emitting `m(); return null;` here '
              'discards the future, and the bridge replies on dispatch '
              'instead of on completion');
      // The work must NOT be done yet — that is what makes the future
      // meaningful rather than decorative.
      expect(probe.value, 7,
          reason: 'slowReset delays before resetting; if this were '
              'already 0 the test would be proving nothing');

      await r;
      expect(probe.value, 0,
          reason: 'awaiting the dispatcher result waits for the real work');
    });

    test('a throw inside Future<void> surfaces as a rejection, not an '
        'unhandled async error', () async {
      final r = dispatchService('probe.boom', const []);

      expect(r, isA<Future>());
      await expectLater(r, throwsA(isA<StateError>()),
          reason: 'the bridge attaches onError to what the dispatcher '
              'returns; discarding the future orphans the error into the '
              'zone instead of rejecting the JS promise');
    });

    test('Future<T> carries its value through', () async {
      final r = dispatchService('probe.answer', const []);
      expect(r, isA<Future>());
      expect(await r, 42);
    });

    test('an unknown method throws rather than silently replying null',
        () async {
      expect(() => dispatchService('probe.nope', const []), throwsA(anything));
    });
  });
}
