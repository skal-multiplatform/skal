// SkalRegistry — process-wide name-keyed dispatch table for custom
// widget + value builders.
//
// Tests focus on:
//
//   • registerWidget / widgetBuilderFor: round-trip happy path
//   • registerValue<T> / valueBuilderFor: type erasure + retrieval
//   • Re-registration replaces silently (hot-reload friendly,
//     also means codegen-then-manual override is well-defined)
//   • Missing name lookups return null instead of throwing
//
// The registry is global state, so each test calls
// `SkalRegistry.resetForTesting()` to avoid cross-test pollution.

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:skal_flutter/skal/bridge.dart';
import 'package:skal_flutter/skal/node_state.dart';
import 'package:skal_flutter/skal/registry.dart';
import 'package:skal_flutter/skal/wire.dart';

void main() {
  setUp(() {
    SkalRegistry.resetForTesting();
  });

  group('SkalRegistry — widgets', () {
    test('registerWidget round-trips through widgetBuilderFor', () {
      Widget builder(NodeState n, SkalBridge b) => const SizedBox(width: 7);
      SkalRegistry.registerWidget('greeting', builder);

      final got = SkalRegistry.widgetBuilderFor('greeting');
      expect(got, isNotNull);
      expect(got, same(builder),
          reason: 'registry stores the same function reference');
    });

    test('unknown widget name returns null', () {
      expect(SkalRegistry.widgetBuilderFor('absent'), isNull);
      // Still null after some unrelated registrations.
      SkalRegistry.registerWidget(
          'a', (n, b) => const SizedBox.shrink());
      SkalRegistry.registerWidget(
          'b', (n, b) => const SizedBox.shrink());
      expect(SkalRegistry.widgetBuilderFor('absent'), isNull);
    });

    test('re-register replaces silently', () {
      Widget first(NodeState n, SkalBridge b) => const SizedBox(width: 1);
      Widget second(NodeState n, SkalBridge b) => const SizedBox(width: 2);
      SkalRegistry.registerWidget('foo', first);
      expect(SkalRegistry.widgetBuilderFor('foo'), same(first));
      SkalRegistry.registerWidget('foo', second);
      expect(SkalRegistry.widgetBuilderFor('foo'), same(second),
          reason: 'last registration wins — codegen runs first, '
              'manual overrides run after');
    });

    test('registeredWidgetNames returns snapshot', () {
      expect(SkalRegistry.registeredWidgetNames, isEmpty);
      SkalRegistry.registerWidget('a', (n, b) => const SizedBox.shrink());
      SkalRegistry.registerWidget('b', (n, b) => const SizedBox.shrink());
      // Order is insertion order (Dart Map preserves it).
      expect(SkalRegistry.registeredWidgetNames, ['a', 'b']);
      // The returned list is immutable — caller can't accidentally
      // poison the registry via a mistaken `.add(…)`.
      expect(() => SkalRegistry.registeredWidgetNames.add('c'),
          throwsUnsupportedError);
    });
  });

  group('SkalRegistry — values', () {
    test('registerValue<T> preserves the value type', () {
      // Use a primitive Dart type to avoid pulling in a fake "Marker"
      // class just for the test. The mechanics are identical regardless
      // of T.
      SkalRegistry.registerValue<int>(
          'magic', (n, b) => 42);

      final builder = SkalRegistry.valueBuilderFor('magic');
      expect(builder, isNotNull);
      // The registry erases the generic internally, but the wrapped
      // builder still returns 42 (an int) at the call site.
      final result = builder!(NodeState(wtCustom), _NullBridge());
      expect(result, 42);
      expect(result, isA<int>());
    });

    test('unknown value name returns null', () {
      expect(SkalRegistry.valueBuilderFor('absent'), isNull);
    });

    test('value and widget namespaces are independent', () {
      // Registering 'foo' as a widget should NOT register it as a value,
      // and vice versa. Adapters that need both must call both.
      SkalRegistry.registerWidget('foo',
          (n, b) => const SizedBox.shrink());
      SkalRegistry.registerValue<int>('bar', (n, b) => 1);

      expect(SkalRegistry.widgetBuilderFor('foo'), isNotNull);
      expect(SkalRegistry.valueBuilderFor('foo'), isNull);
      expect(SkalRegistry.widgetBuilderFor('bar'), isNull);
      expect(SkalRegistry.valueBuilderFor('bar'), isNotNull);
    });
  });

  group('SkalRegistry — reset', () {
    test('resetForTesting clears both maps', () {
      SkalRegistry.registerWidget(
          'w', (n, b) => const SizedBox.shrink());
      SkalRegistry.registerValue<int>('v', (n, b) => 1);
      expect(SkalRegistry.registeredWidgetNames, isNotEmpty);
      expect(SkalRegistry.registeredValueNames, isNotEmpty);

      SkalRegistry.resetForTesting();
      expect(SkalRegistry.registeredWidgetNames, isEmpty);
      expect(SkalRegistry.registeredValueNames, isEmpty);
    });
  });
}

/// Minimal stand-in for SkalBridge — SkalRegistry's value builder
/// callback is `(NodeState, SkalBridge) → Object?`, but the real
/// SkalBridge constructor needs an FFI handle we can't easily provide
/// in unit tests. The test value builders here don't dereference the
/// bridge argument, so a noop subclass suffices.
class _NullBridge implements SkalBridge {
  @override
  dynamic noSuchMethod(Invocation i) => null;
}
