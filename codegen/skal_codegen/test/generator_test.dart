// Snapshot test for the codegen.
//
// Strategy: resolve the test fixture file via package:analyzer's
// `AnalysisContextCollection`, hand the [ResolvedUnitResult] to the
// generator, compare the output against the expected fixture.
//
// What this proves:
//
//   1. We can analyze a Dart file with `flutter/material.dart` imports
//      without a full Flutter installation (analyzer resolves types
//      via the SDK + pub cache).
//   2. The generator's AST walk finds the right class.
//   3. The type mapper picks the right encoder for String / Color /
//      double (the three FancyText param types — Slice 2 MVP scope).
//   4. The default-value extraction reads param.defaultValueCode
//      verbatim, so 'Hello' / const Color(0xFF000000) / 14.0 round-trip
//      into the output unchanged.
//   5. The registry key is the camelCase of the class name
//      (FancyText → fancyText), matching the babel macro's lowering
//      convention.
//
// When this test fails after a generator change, the diff between the
// produced source and the .expected.dart fixture tells you exactly
// what broke.

import 'dart:io';

import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/file_system/physical_file_system.dart';
import 'package:path/path.dart' as p;
import 'package:test/test.dart';

import 'package:skal_codegen/src/generator.dart';

void main() {
  group('generator — snapshot', () {
    test('FancyText fixture matches expected output', () async {
      // p.absolute returns an unnormalized path for '.' ("…/codegen/skal_codegen/.")
      // — analyzer rejects that. p.normalize fixes it.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/fancy_text.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/fancy_text.expected.dart');

      // Spin up an analyzer context rooted at the package. Analyzer
      // discovers `pubspec.yaml` and the SDK paths from this anchor,
      // so type lookups for `String`, `Color`, `Widget`, etc. work
      // without us hand-wiring the SDK location.
      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);

      expect(unitResult, isA<ResolvedUnitResult>(),
          reason: 'analyzer failed to resolve fixture — likely missing '
              'flutter dependency in test environment. See package '
              'pubspec.yaml setup notes.');

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['fancy_text.dart'],
      );

      // Confirm we generated exactly one widget — the fixture has
      // only FancyText.
      expect(result.generated, hasLength(1));
      expect(result.generated.first.className, 'FancyText');
      expect(result.generated.first.registryKey, 'fancyText');
      expect(result.skipped, isEmpty);

      // Compare against the expected fixture. Normalize trailing
      // whitespace so a stray editor-induced newline doesn't fail
      // the test for cosmetic reasons.
      final expected = File(expectedPath).readAsStringSync();
      expect(_normalize(result.source), _normalize(expected),
          reason: 'generator output does NOT match '
              'test/fixtures/fancy_text.expected.dart');
    });

    test('mini_pack: multi-file scan emits one combined adapter', () async {
      // Three input files: two Widget classes (Badge, Panel) + one
      // helpers-only file. The generator should:
      //   1. Walk all three.
      //   2. Emit one `_build_*` per Widget (Badge, Panel) — two total.
      //   3. Skip the helpers file silently (no Widget classes inside).
      //   4. Produce ONE registerAll() with both registrations.
      final pkgRoot = p.normalize(p.absolute('.'));
      final packDir = p.join(pkgRoot, 'test/fixtures/mini_pack');
      final inputs = [
        p.join(packDir, 'badge.dart'),
        p.join(packDir, 'helpers.dart'),
        p.join(packDir, 'panel.dart'),
      ]..sort(); // mirror CLI's deterministic ordering

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );

      final units = <ResolvedUnitResult>[];
      final relImports = <String>[];
      for (final input in inputs) {
        final ctx = collection.contextFor(input);
        final r = await ctx.currentSession.getResolvedUnit(input);
        expect(r, isA<ResolvedUnitResult>());
        units.add(r as ResolvedUnitResult);
        // Relative path the generator should emit as the import — from
        // the (hypothetical) output location alongside the fixtures.
        relImports.add('mini_pack/${p.basename(input)}');
      }

      final result = generate(
        units: units,
        sourceRelativeImports: relImports,
      );

      expect(result.generated.map((w) => w.className), ['Badge', 'Panel']);
      expect(result.skipped, isEmpty,
          reason: 'helpers.dart contributes nothing but mustn\'t error');

      final expected = File(p.join(pkgRoot,
              'test/fixtures/mini_pack.expected.dart'))
          .readAsStringSync();
      expect(_normalize(result.source), _normalize(expected),
          reason: 'multi-file generator output does NOT match '
              'mini_pack.expected.dart');
    });

    test('complex types: enum + Duration encoded correctly', () async {
      // Exercises the post-primitive type mapper:
      //   • enum BannerStyle → values[index] decode with int default
      //     pulled from constant evaluation
      //   • Duration → ms-encoded u32, default reconstructed via
      //     analyzer's toDurationValue()
      //   • String alongside, to confirm primitive encoding still works
      //     when interleaved with complex types in the same widget.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/complex_types.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/complex_types.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['complex_types.dart'],
      );

      expect(result.generated.map((w) => w.className), ['Banner']);
      expect(result.skipped, isEmpty,
          reason: 'enum + Duration should NOT skip the widget');

      final expected = File(expectedPath).readAsStringSync();
      expect(_normalize(result.source), _normalize(expected),
          reason: 'complex-types generator output does NOT match '
              'complex_types.expected.dart');
    });
  });
}

/// Strip trailing whitespace on each line + collapse multiple blank
/// lines to one. Defensive against editor settings; the meaningful
/// shape of the generated code is what we're snapshotting.
String _normalize(String s) =>
    s.split('\n').map((l) => l.trimRight()).join('\n').trimRight();
