// Unit coverage for the conditional-export import fix.
//
// The snapshot fixtures resolve classes via file:// URIs, so
// _addCanonicalImport's package-URI path never runs in those tests —
// the live failure it fixes ("`XFile` is imported from both
// …interface.dart and …io.dart", from cross_file's conditional export)
// only reproduces against a real pub package. These tests pin the
// extracted decision function instead; the SKAL_INTEGRATION=1 build
// covers the wired-up path empirically.
import 'package:skal_codegen/src/type_mapper.dart'
    show canonicalImportUriFor;
import 'package:test/test.dart';

void main() {
  group('canonicalImportUriFor', () {
    String? crossFileBarrel(String pkg) =>
        pkg == 'cross_file' ? 'package:cross_file/cross_file.dart' : null;

    test('src/-declared class prefers the package barrel when one exists',
        () {
      expect(
        canonicalImportUriFor(
            Uri.parse('package:cross_file/src/types/interface.dart'),
            crossFileBarrel),
        'package:cross_file/cross_file.dart',
        reason: 'the analyzer resolves conditional exports to the STUB; '
            'importing the stub path collides with the barrel at compile '
            'time, so the barrel must win',
      );
    });

    test('src/-declared class with no <pkg>.dart barrel keeps its URI', () {
      // latlong2 exports via latlong.dart, not latlong2.dart — the
      // resolver returns null and the declaring URI is the fallback.
      expect(
        canonicalImportUriFor(
            Uri.parse('package:latlong2/src/latlng.dart'), (_) => null),
        'package:latlong2/src/latlng.dart',
      );
    });

    test('non-src package URI passes through untouched', () {
      expect(
        canonicalImportUriFor(
            Uri.parse('package:flutter_map/flutter_map.dart'),
            crossFileBarrel),
        'package:flutter_map/flutter_map.dart',
      );
    });

    test('top-level src-less file named src is not confused', () {
      // package:foo/src.dart — segments[1] does not exist / is not a
      // directory marker; must pass through.
      expect(
        canonicalImportUriFor(
            Uri.parse('package:foo/src.dart'), (_) => 'package:foo/foo.dart'),
        'package:foo/src.dart',
      );
    });

    test('dart: core libraries are never imported', () {
      expect(canonicalImportUriFor(Uri.parse('dart:core'), (_) => null),
          isNull);
    });

    test('no resolver behaves like no barrel', () {
      expect(
        canonicalImportUriFor(
            Uri.parse('package:cross_file/src/types/interface.dart'), null),
        'package:cross_file/src/types/interface.dart',
      );
    });
  });
}
