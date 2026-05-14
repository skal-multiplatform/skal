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
//      double (the three FancyText param types — the primitive baseline,
//      with the other tests covering complex types on top).
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
// ignore_for_file: experimental_member_use
import 'package:analyzer/dart/element/element2.dart';
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

    test('widget-child param emits SkalNode reader + extra import', () async {
      // Wrapper has `required Widget child`, Tinted has `Widget?
      // child` plus a primitive. Both should emit the same
      // `n.childCount > 0 ? SkalNode(...) : SizedBox.shrink()`
      // pattern, and the generated file should include the
      // `package:skal_flutter/skal/root.dart` import for SkalNode.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/widget_child.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/widget_child.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['widget_child.dart'],
      );

      expect(
        result.generated.map((w) => w.className).toSet(),
        {'Wrapper', 'Tinted'},
      );
      expect(result.skipped, isEmpty,
          reason: 'Widget child params should NOT cause skips anymore');

      final expected = File(expectedPath).readAsStringSync();
      expect(_normalize(result.source), _normalize(expected),
          reason: 'widget-child generator output does NOT match '
              'widget_child.expected.dart');
    });

    test('List<Widget> children: emits per-child SkalNode reader', () async {
      // Two classes with `List<Widget>` params (named children + layers
      // respectively) to confirm:
      //   1. The encoding fires for List<Widget>, regardless of param name.
      //   2. Generated reader walks NodeState.childCount — one SkalNode
      //      per child, all keyed by node id.
      //   3. Sibling primitive params (int, Color) compose with it.
      //   4. The SkalNode import is pulled in just like for single-child.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/widget_list.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/widget_list.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['widget_list.dart'],
      );

      expect(
        result.generated.map((w) => w.className).toSet(),
        {'Grid', 'LayerStack'},
      );
      expect(result.skipped, isEmpty,
          reason: 'List<Widget> children should NOT cause skips');

      final expected = File(expectedPath).readAsStringSync();
      expect(_normalize(result.source), _normalize(expected),
          reason: 'widget-list generator output does NOT match '
              'widget_list.expected.dart');
    });

    test('named constructors: default + named both emit, redirect skipped',
        () async {
      // Three classes exercising the named-ctor matrix:
      //   • Card    — default + named: emits <Card> AND <CardOutlined>
      //   • Sheet   — only named:      emits <SheetElevated> (no <Sheet>)
      //   • Link    — default + REDIRECTING named: emits ONLY <Link>
      //                (the redirecting ctor delegates to the default,
      //                so wrapping it would be a duplicate adapter)
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/named_ctors.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/named_ctors.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['named_ctors.dart'],
      );

      // Four adapters expected — Card, Card.outlined, Sheet.elevated,
      // Link. NOT five: Link.empty redirects, so the eligibility filter
      // drops it before emission.
      expect(
        result.generated.map((w) => w.className).toList(),
        ['Card', 'CardOutlined', 'SheetElevated', 'Link'],
      );
      expect(result.skipped, isEmpty,
          reason: 'named-ctor handling should not produce skip warnings '
              '(redirecting ctors are silently filtered, not skipped)');

      final expected = File(expectedPath).readAsStringSync();
      expect(_normalize(result.source), _normalize(expected),
          reason: 'named-ctor generator output does NOT match '
              'named_ctors.expected.dart');
    });

    test('callbacks: VoidCallback + ValueChanged<T> emit typed dispatch',
        () async {
      // Three classes covering every callback shape:
      //
      //   • Tappable    — VoidCallback alias       → dispatchEvent()
      //   • Refreshable — raw void Function()?     → dispatchEvent()
      //   • Form        — ValueChanged<bool>       → dispatchEventBool()
      //                   ValueChanged<double>     → dispatchEventDouble()
      //                   ValueChanged<int>        → dispatchEventInt()
      //
      // The JS-side renderer's `_setCustomProperty` auto-binds
      // function-valued JSX props via newHandlerId+bindCustomHandler.
      // Bridge writes the typed payload into bytes 8-11 of the event
      // record; JS's __skal_drainEvents decodes per argType and
      // forwards the value to the bound JSX function.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/callbacks.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/callbacks.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['callbacks.dart'],
      );

      expect(
        result.generated.map((w) => w.className).toSet(),
        {'Tappable', 'Refreshable', 'Form'},
      );
      expect(result.skipped, isEmpty,
          reason: 'VoidCallback + ValueChanged<T> should not cause skips');

      final expected = File(expectedPath).readAsStringSync();
      expect(_normalize(result.source), _normalize(expected),
          reason: 'callbacks generator output does NOT match '
              'callbacks.expected.dart');
    });

    test('host pattern: sync + async factories emit StatefulWidget wrappers',
        () async {
      // Loads test/fixtures/host.dart which exports two factories
      // (sync + async) returning a FakeController. The host fixture
      // emission should produce:
      //   1. `_FakeSyncHost` StatefulWidget + State + `_build_FakeSync`
      //      (NO `await` on the factory call)
      //   2. `_FakeAsyncHost` ditto WITH `await` injected
      //   3. registerAll() with two SkalRegistry.registerWidget calls
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/host.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/host.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      // Find each factory function on the resolved unit.
      ExecutableElement2? syncFactory;
      ExecutableElement2? asyncFactory;
      for (final fn in (unitResult as ResolvedUnitResult)
          .libraryElement2
          .topLevelFunctions) {
        if (fn.name3 == 'makeFakeViewerSync') syncFactory = fn;
        if (fn.name3 == 'makeFakeViewerAsync') asyncFactory = fn;
      }
      expect(syncFactory, isNotNull);
      expect(asyncFactory, isNotNull);

      final hosts = [
        HostConfig(
          jsxName: 'FakeSync',
          wrappedWidgetName: 'FakeViewer',
          factoryFn: syncFactory!,
          factoryImport: 'host.dart',
          wrappedWidgetImport: '_fake_flutter.dart',
        ),
        HostConfig(
          jsxName: 'FakeAsync',
          wrappedWidgetName: 'FakeViewer',
          factoryFn: asyncFactory!,
          factoryImport: 'host.dart',
          wrappedWidgetImport: '_fake_flutter.dart',
        ),
      ];

      final result = generate(
        units: const [],
        sourceRelativeImports: const [],
        hosts: hosts,
      );

      expect(
        result.generated.map((w) => w.className).toList(),
        ['FakeSync', 'FakeAsync'],
      );
      expect(result.skipped, isEmpty,
          reason: 'host emission with valid factories should not skip');

      final expected = File(expectedPath).readAsStringSync();
      expect(_normalize(result.source), _normalize(expected),
          reason: 'host generator output does NOT match '
              'host.expected.dart');
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
