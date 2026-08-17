// The Duration default was read out of a PRIVATE SDK field (`_duration`).
// That name is not API: on a Dart SDK that calls it something else the read
// returns null, the `?? 0` fallback fires, and the generator emits
// `Duration(milliseconds: 0)` where the developer wrote 250. Nothing in the
// output looks wrong — it failed on Linux CI and passed on macOS.
//
// These cover the recovery path, which is the half that has to work when
// the field name does not match.
import 'package:test/test.dart';
import 'package:skal_codegen/src/type_mapper.dart';

void main() {
  group('duration default recovered from source text', () {
    test('milliseconds', () {
      expect(durationMicrosFromLiteral('const Duration(milliseconds: 250)'),
          250 * 1000);
    });
    test('seconds', () {
      expect(durationMicrosFromLiteral('Duration(seconds: 2)'), 2000000);
    });
    test('several units add up', () {
      expect(durationMicrosFromLiteral('Duration(minutes: 1, seconds: 30)'),
          90 * 1000000);
    });
    test('underscored digits', () {
      expect(durationMicrosFromLiteral('Duration(microseconds: 1_500)'), 1500);
    });
    test('zero stays zero', () {
      expect(durationMicrosFromLiteral('Duration(milliseconds: 0)'), 0);
    });
    test('a referenced constant is not guessed at', () {
      expect(durationMicrosFromLiteral('kThemeAnimationDuration'), 0);
    });
    test('null literal', () {
      expect(durationMicrosFromLiteral(null), 0);
    });
  });

  group('field read wins, text is the fallback', () {
    test('no constant at all falls back to the text', () {
      expect(durationMicrosFromDefault(null, 'Duration(milliseconds: 500)'),
          500 * 1000);
    });
    test('neither source available yields 0', () {
      expect(durationMicrosFromDefault(null, null), 0);
    });
  });
}
