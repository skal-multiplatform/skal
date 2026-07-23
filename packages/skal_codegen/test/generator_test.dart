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
      _expectSnapshot(result.source, expectedPath,
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

      _expectSnapshot(result.source,
          p.join(pkgRoot, 'test/fixtures/mini_pack.expected.dart'),
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

      _expectSnapshot(result.source, expectedPath,
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

      _expectSnapshot(result.source, expectedPath,
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

      _expectSnapshot(result.source, expectedPath,
          reason: 'named-ctor generator output does NOT match '
              'named_ctors.expected.dart');
    });

    test('Gradient: emits parser helpers + reads JSON-encoded prop',
        () async {
      // Two classes — Painted (nullable Gradient?) + Banner (required
      // non-nullable). Codegen should emit:
      //
      //   • Three helper functions ONCE at the top of the file:
      //     _skalParseGradient, _skalParseColor, _skalParseAlignment
      //   • Two adapters, each with `_skalParseGradient(getCustomPropStr(...))`
      //     as the prop reader (shared helpers, deduplicated)
      //   • `import 'dart:convert';` for jsonDecode
      //
      // The renderer's side of this contract — JSON-stringifying JSX
      // object prop values — is exercised end-to-end by the demo, not
      // by this snapshot test.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/gradient.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/gradient.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['gradient.dart'],
      );

      expect(result.generated.map((w) => w.className).toSet(),
          {'Painted', 'Banner'});
      expect(result.skipped, isEmpty);

      _expectSnapshot(result.source, expectedPath,
          reason: 'gradient generator output does NOT match '
              'gradient.expected.dart');
    });

    test('generic value classes: nested data records via JSON-object props',
        () async {
      // Drives the generic value-class encoder added after the
      // empirical flutter_map exercise. The fixture's MapInit /
      // GeoBounds / GeoPoint chain is structurally identical to
      // MapOptions / LatLngBounds / LatLng — what we couldn't wrap
      // before this slice landed. Expected codegen behavior:
      //
      //   • One `_skalParseGeoPoint(Object? raw)` helper, emitted once.
      //   • One `_skalParseGeoBounds(Object? raw)` helper that calls
      //     _skalParseGeoPoint for each corner.
      //   • One `_skalParseMapInit(Object? raw)` helper composing both.
      //   • The MiniMap adapter reads `init` (required, no default →
      //     `!` non-null assertion) and `cameraBounds` (nullable → null
      //     passthrough) via getCustomPropStr.
      //   • `import 'dart:convert';` for jsonDecode inside each helper.
      //
      // Snapshot captures the exact emitted shape so future encoder
      // changes don't silently shift the contract.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/value_class.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/value_class.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['value_class.dart'],
      );

      // Only MiniMap is a Widget (extends StatelessWidget). The data
      // classes (GeoPoint, GeoBounds, MapInit) should NOT show up as
      // generated adapters — they're routed through the value-class
      // encoder as helpers instead.
      expect(result.generated.map((w) => w.className), ['MiniMap']);
      expect(result.skipped, isEmpty,
          reason: 'nothing should skip — GeoPoint/GeoBounds/MapInit '
              'are value classes the encoder handles');

      _expectSnapshot(result.source, expectedPath,
          reason: 'value-class generator output does NOT match '
              'value_class.expected.dart');
    });

    test('nullable primitives: double? / int? / bool? / Color? / enum? / '
        'Duration? read as null when unset', () async {
      // Regression guard for the nullable-coercion bug. A nullable
      // param the JSX consumer omits MUST read as `null`, not a
      // coerced zero. The fixture's `Tunable` has nullable + non-
      // nullable params of each type; the snapshot must show:
      //   • opacity (double?)  → n.getCustomPropF32OrNull('opacity')
      //   • maxLines (int?)    → n.getCustomPropU32OrNull('maxLines')
      //   • dense (bool?)      → n.getCustomPropBoolOrNull('dense')
      //   • tint (Color?)      → IIFE mapping the OrNull int → Color/null
      //   • density (Density?) → IIFE mapping OrNull int → values[i]/null
      //   • fadeIn (Duration?) → IIFE mapping OrNull int → Duration/null
      //   • the non-nullable counterparts → unchanged zero-fallback forms.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath =
          p.join(pkgRoot, 'test/fixtures/nullable_primitives.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/nullable_primitives.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['nullable_primitives.dart'],
      );

      expect(result.generated.map((w) => w.className), ['Tunable']);
      expect(result.skipped, isEmpty);

      _expectSnapshot(result.source, expectedPath,
          reason: 'nullable-primitives generator output does NOT match '
              'nullable_primitives.expected.dart');
    });

    test('value types v2: TextStyle / BoxDecoration / BorderRadius / Offset / '
        'Alignment / ImageProvider', () async {
      // Each new value type expands into sub-props (TextStyle's
      // styleFontSize, …) or a string-coercion IIFE (ImageProvider).
      // The fixture exercises one widget per type so the snapshot
      // captures all six emission shapes side-by-side.
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/value_types_v2.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/value_types_v2.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['value_types_v2.dart'],
      );

      expect(result.generated.map((w) => w.className).toSet(),
          {'Styled', 'Card', 'Anchored', 'Pic'});
      expect(result.skipped, isEmpty,
          reason: 'all six value types should encode without skipping');

      _expectSnapshot(result.source, expectedPath,
          reason: 'v2 value-types output does NOT match '
              'value_types_v2.expected.dart');
    });

    test('positional params: walked in order, emitted without name prefix',
        () async {
      // Two classes — Padded has a required positional `int` + optional
      // named Widget child; Tagged has a required positional String +
      // optional positional int.
      //
      // Expected: positional args appear FIRST in the constructor call,
      // in declaration order, without `name:` prefixes. Named args
      // follow with their prefixes (current behavior).
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/positional.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/positional.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());

      final result = generate(
        units: [unitResult as ResolvedUnitResult],
        sourceRelativeImports: ['positional.dart'],
      );

      expect(result.generated.map((w) => w.className).toSet(),
          {'Padded', 'Tagged'});
      expect(result.skipped, isEmpty,
          reason: 'encodable positional params should not skip');

      _expectSnapshot(result.source, expectedPath,
          reason: 'positional output does NOT match positional.expected.dart');
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
        {'Tappable', 'Refreshable', 'Form', 'TapList'},
      );
      expect(result.skipped, isEmpty,
          reason: 'VoidCallback + ValueChanged<T> + multi-arg fn should '
              'not cause skips');

      _expectSnapshot(result.source, expectedPath,
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

      _expectSnapshot(result.source, expectedPath,
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

      _expectSnapshot(result.source, expectedPath,
          reason: 'complex-types generator output does NOT match '
              'complex_types.expected.dart');
    });

    test('List<ValueClass>: element gets a registerValue builder, parent '
        'reads child nodes', () async {
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/value_list.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/value_list.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unit = await ctx.currentSession.getResolvedUnit(fixturePath)
          as ResolvedUnitResult;

      final result = generate(
        units: [unit],
        sourceRelativeImports: ['value_list.dart'],
      );

      // The widget that `List<Pin>` used to kill now ships.
      expect(result.generated.map((w) => w.className), contains('PinLayer'));
      expect(result.skipped, isEmpty);

      // The element class gets a VALUE builder — registerValue, not
      // registerWidget. That's what makes bridge.buildValue<Pin>()
      // resolve it from a child node.
      expect(result.source, contains("SkalRegistry.registerValue<Pin>('pin'"));
      expect(result.source, contains('Pin _buildValue_Pin('));

      // The parent walks child nodes rather than parsing a JSON array —
      // this is the O(changed) vs O(n) decision, and it is the whole
      // point of B5. A JSON-array reader here would be a regression
      // even though it would pass a "does MarkerLayer work" test.
      expect(result.source, contains('_skalChildValues<Pin>(n, bridge)'));
      expect(result.source, isNot(contains("jsonDecode(n.getCustomPropStr('pins')")));

      // The element's own nested value class still goes through the
      // normal JSON encoder — child composition is for the LIST, not
      // for every field below it.
      expect(result.source, contains('_skalParseLatLng'));

      _expectSnapshot(result.source, expectedPath,
          reason: 'value-list generator output does NOT match '
              'value_list.expected.dart');
    });

    test(r'subtype unions: an abstract param dispatches on $type to its '
        'concrete subclasses', () async {
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/subtype_union.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/subtype_union.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unit = await ctx.currentSession.getResolvedUnit(fixturePath)
          as ResolvedUnitResult;

      final result = generate(
        units: [unit],
        sourceRelativeImports: ['subtype_union.dart'],
      );

      // Card ships: `Frame` is abstract, but all three of its concrete
      // subclasses are ordinary value classes.
      expect(result.generated.map((w) => w.className), contains('Card'));
      expect(result.source, contains('_skalParseFrame'));
      for (final sub in ['SquareFrame', 'RoundFrame', 'BeveledFrame']) {
        expect(result.source, contains("case '$sub':"),
            reason: '$sub must be a dispatch arm');
        expect(result.source, contains('_skalParse$sub'),
            reason: '$sub must get its own value-class parser');
      }
      // Dispatch is on a `$type` field. With three subtypes there is
      // no safe guess, so an unrecognized discriminator must return
      // null and let the param's declared default apply — never pick
      // an arbitrary subtype and render the wrong thing silently.
      expect(result.source, contains(r"j[r'$type']"));
      expect(result.source, contains('const SquareFrame()'),
          reason: "the param's own default must still be the fallback");

      // An abstract type with NO concrete subclasses is still a dead
      // end — B1 must not manufacture an empty switch, and the widget
      // that requires it must still be skipped with a reason.
      expect(result.source, isNot(contains('_skalParseUnknowable')));
      expect(
        result.skipped.singleWhere((w) => w.className == 'Unbuildable')
            .skipReason,
        contains('Unknowable'),
      );

      _expectSnapshot(result.source, expectedPath,
          reason: 'subtype-union generator output does NOT match '
              'subtype_union.expected.dart');
    });

    test('builder: an indexed builder param wires to SkalBuilderChild; '
        'a non-indexed one is refused', () async {
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/overrides.dart');
      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unit = await ctx.currentSession.getResolvedUnit(fixturePath)
          as ResolvedUnitResult;

      // Without opting in, a builder param is unmappable and required,
      // so Feed is skipped. That default is the perf gate: nothing gets
      // a JS round-trip per build call by accident.
      final before = generate(
        units: [unit], sourceRelativeImports: ['overrides.dart']);
      expect(before.skipped.map((w) => w.className), contains('Feed'));

      final after = generate(
        units: [unit],
        sourceRelativeImports: ['overrides.dart'],
        overrides: {
          'Feed': const WidgetOverride(
            params: {'rowBuilder': ParamOverride(builder: true)},
          ),
        },
      );
      expect(after.generated.map((w) => w.className), contains('Feed'));
      expect(after.source, contains('SkalBuilderChild(host: n, index: i'));
      expect(after.source, contains('rowBuilder: (_, i) =>'));
      // The prop name must reach the manifest — the JS renderer can't
      // tell a builder from a callback on its own, so without this it
      // would bind rowBuilder as an event handler and nothing would
      // render.
      final feed = after.generated.singleWhere((w) => w.className == 'Feed');
      expect(feed.builderParams, ['rowBuilder']);

      // `Widget Function(BuildContext, Widget)` has no index to key a
      // subtree by. Refuse it, and say why.
      final refused = generate(
        units: [unit],
        sourceRelativeImports: ['overrides.dart'],
        overrides: {
          'Feed': const WidgetOverride(
            params: {
              'rowBuilder': ParamOverride(builder: true),
              'decorator': ParamOverride(builder: true),
            },
          ),
        },
      );
      final skip = refused.skipped.singleWhere((w) => w.className == 'Feed');
      expect(skip.skipReason, contains('not an indexed widget builder'));
    });

    test('handle: a widget controller param resolves an opaque handle '
        'supplied by JS', () async {
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/overrides.dart');
      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unit = await ctx.currentSession.getResolvedUnit(fixturePath)
          as ResolvedUnitResult;

      // Not opted in: a controller param is unmappable and required, so
      // the widget is skipped. That default is deliberate — silently
      // turning it into a handle would swap a build-time skip the dev
      // can read for a runtime null they cannot.
      final before = generate(
        units: [unit], sourceRelativeImports: ['overrides.dart']);
      expect(before.skipped.map((w) => w.className), contains('Playback'));

      final after = generate(
        units: [unit],
        sourceRelativeImports: ['overrides.dart'],
        overrides: {
          'Playback': const WidgetOverride(
            params: {'controller': ParamOverride(handle: true)},
          ),
        },
      );
      expect(after.generated.map((w) => w.className), contains('Playback'));
      expect(after.source,
          contains("_skalHandleProp<PlaybackController>(n, 'controller')"));
      // Required param → asserts rather than silently constructing with
      // a null controller.
      expect(after.source, contains("'controller')!"));
      // Sibling props still map.
      expect(after.source, contains('muted'));

      // A Widget-typed param is not handle-able — widgets are child
      // nodes, and saying so beats a confusing type error downstream.
      final refused = generate(
        units: [unit],
        sourceRelativeImports: ['overrides.dart'],
        overrides: {
          'Playback': const WidgetOverride(
            params: {
              'controller': ParamOverride(handle: true),
              'overlay': ParamOverride(handle: true),
            },
          ),
        },
      );
      final skip =
          refused.skipped.singleWhere((w) => w.className == 'Playback');
      expect(skip.skipReason, contains('handle'));
      expect(skip.skipReason, contains('child nodes'),
          reason: 'the message must say what a Widget param IS, not just '
              'what it is not');
    });

    test('typeArgs: a generic widget class is pinned to a concrete type',
        () async {
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/subtype_union.dart');
      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unit = await ctx.currentSession.getResolvedUnit(fixturePath)
          as ResolvedUnitResult;

      // Without typeArgs a generic widget is skipped — and the message
      // has to name the fix, since "codegen can't pick" is useless on
      // its own.
      final before = generate(
        units: [unit], sourceRelativeImports: ['subtype_union.dart']);
      final skip = before.skipped.singleWhere((w) => w.className == 'Chip');
      expect(skip.skipReason, contains('typeArgs'));

      final after = generate(
        units: [unit],
        sourceRelativeImports: ['subtype_union.dart'],
        overrides: {'Chip': const WidgetOverride(typeArgs: ['Object'])},
      );
      expect(after.generated.map((w) => w.className), contains('Chip'));
      expect(after.source, contains('Chip<Object>('));
      // The payoff: `List<T>` substituted to `List<Object>` means the
      // encoder sees a concrete element type. Reading the ctor off the
      // uninstantiated class would leave a bare type variable here.
      expect(after.source, contains('payloads:'));

      // A wrong arity is refused rather than emitting `Chip<>(`.
      final wrongArity = generate(
        units: [unit],
        sourceRelativeImports: ['subtype_union.dart'],
        overrides: {
          'Chip': const WidgetOverride(typeArgs: ['Object', 'int'])
        },
      );
      expect(
        wrongArity.skipped.singleWhere((w) => w.className == 'Chip').skipReason,
        contains('typeArgs'),
      );
    });

    test('overrides: a const: expression rescues a widget that one '
        'unmappable required param would otherwise kill', () async {
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/overrides.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/overrides.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());
      final unit = unitResult as ResolvedUnitResult;

      // Baseline: without an override, one required TileSource takes
      // the whole widget down. This is the behaviour B4 exists to fix,
      // so assert it explicitly — if it ever stops being true the
      // override test below would silently stop proving anything.
      final before = generate(
        units: [unit],
        sourceRelativeImports: ['overrides.dart'],
      );
      expect(before.generated.map((w) => w.className), isNot(contains('Tiles')));
      expect(
        before.skipped.singleWhere((w) => w.className == 'Tiles').skipReason,
        contains('TileSource'),
      );

      // With the override, the widget ships — and the twenty props that
      // were always fine come with it.
      final after = generate(
        units: [unit],
        sourceRelativeImports: ['overrides.dart'],
        overrides: {
          'Tiles': const WidgetOverride(
            params: {
              'provider': ParamOverride(constExpr: "TileSource('osm')"),
              'builder': ParamOverride(ignore: true),
            },
          ),
        },
      );
      // Scoped to Tiles: the fixture also carries `Feed`, which the
      // B2 test drives and which is correctly skipped without its own
      // override.
      expect(after.skipped.map((w) => w.className), isNot(contains('Tiles')));
      expect(after.generated.map((w) => w.className), contains('Tiles'));
      expect(after.source, contains("provider: TileSource('osm')"));
      // The ignored param is reported as omitted, not silently gone.
      expect(
        after.generated
            .singleWhere((w) => w.className == 'Tiles')
            .omittedOptionalParams,
        contains('builder'),
      );
      // The mappable props still map.
      expect(after.source, contains('urlTemplate'));
      expect(after.source, contains('maxZoom'));

      _expectSnapshot(after.source, expectedPath,
          reason: 'override generator output does NOT match '
              'overrides.expected.dart');
    });

    test('overrides: ignore on a REQUIRED param is refused, not '
        'silently emitted as uncompilable code', () async {
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/overrides.dart');
      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unit = await ctx.currentSession.getResolvedUnit(fixturePath)
          as ResolvedUnitResult;

      final result = generate(
        units: [unit],
        sourceRelativeImports: ['overrides.dart'],
        overrides: {
          'Tiles': const WidgetOverride(
            params: {'provider': ParamOverride(ignore: true)},
          ),
        },
      );
      final skip = result.skipped.singleWhere((w) => w.className == 'Tiles');
      expect(skip.skipReason, contains('ignore'));
      expect(skip.skipReason, contains('const'),
          reason: 'the message must name the fix, not just the problem');
    });

    test('services: emits a static-method dispatcher, drops what it '
        "can't map, keeps the rest", () async {
      final pkgRoot = p.normalize(p.absolute('.'));
      final fixturePath = p.join(pkgRoot, 'test/fixtures/service_class.dart');
      final expectedPath =
          p.join(pkgRoot, 'test/fixtures/service_class.expected.dart');

      final collection = AnalysisContextCollection(
        includedPaths: [pkgRoot],
        resourceProvider: PhysicalResourceProvider.INSTANCE,
      );
      final ctx = collection.contextFor(fixturePath);
      final unitResult = await ctx.currentSession.getResolvedUnit(fixturePath);
      expect(unitResult, isA<ResolvedUnitResult>());
      final unit = unitResult as ResolvedUnitResult;

      final geo = unit.libraryElement2.classes
          .firstWhere((c) => c.name3 == 'Geo');

      final result = generate(
        units: const [],
        sourceRelativeImports: const [],
        services: [
          ServiceConfig(
            name: 'geo',
            cls: geo,
            importUri: 'service_class.dart',
          ),
        ],
      );

      expect(result.services, hasLength(1));
      final svc = result.services.single;
      expect(svc.skipReason, isNull,
          reason: 'the service must survive even though two of its '
              'methods are unmappable');
      expect(svc.name, 'geo');
      expect(svc.className, 'Geo');

      // Every mappable static method is present…
      expect(
        svc.methods,
        containsAll(<String>[
          'battery',
          'currentAccuracy',
          'describe',
          'getCurrentPosition',
          'history',
          'isInside',
          'pickAccuracy',
          'positionStream',
          'startTracking',
        ]),
      );
      // FutureOr<T> exposes only Object members — the wrapped return
      // must normalize through Future.value before `.then` exists, or
      // the generated file doesn't compile.
      // (Format-agnostic: dart_style may break the expression across
      // lines, so match the two halves separately.)
      expect(result.source, contains('Future.value('));
      expect(result.source,
          contains('.then((LocationAccuracy v) => v.name)'));
      // A stream of unserializable values must be REFUSED, not wrapped:
      // `map(skalHandleOf)` would retain one Dart-side object per event
      // with nothing releasing them.
      expect(svc.methods, isNot(contains('handleStream')));
      expect(svc.skippedMethods['handleStream'], contains('handle per event'));
      // …including the two that touch a NativeHandle. Nothing about
      // that type can be serialized, and before A3 both methods were
      // dropped. Now the object stays on the Dart side and JS gets a
      // handle, so the methods ship.
      expect(svc.methods, containsAll(<String>['attach', 'acquire']));
      // The only legitimate skip left is the stream-of-handles leak
      // guard, asserted below by name.
      expect(svc.skippedMethods.keys, ['handleStream']);
      expect(result.source, contains('(skalHandleOf)(Geo.acquire())'),
          reason: 'an unserializable return becomes a handle');
      expect(result.source, contains('skalHandleArg<NativeHandle>'),
          reason: 'a handle comes back in as an argument');
      // Instance methods are not part of a service's surface.
      expect(svc.methods, isNot(contains('ignored')));

      // List args decode ELEMENTWISE — they must never fall through to
      // the opaque-handle route, which erases the type parameter
      // (`skalHandleArg<List>` → List<dynamic>) and breaks the call
      // site. Caught live wrapping share_plus's shareXFiles.
      expect(svc.methods, containsAll(<String>['sharePaths', 'coversAll']));
      expect(result.source, contains('List<String>.from'),
          reason: 'List<primitive> arg decodes via List<T>.from');
      expect(result.source, contains('.whereType<Region>().toList()'),
          reason: 'List<value class> arg parses per element and drops '
              'malformed entries via whereType');
      expect(result.source, isNot(contains('skalHandleArg<List')),
          reason: 'no List arg may route through the handle fallback');

      // Position has toJson() — the bridge's jsonEncode calls it, so no
      // encoder should be synthesized for it. Battery has none, so one
      // must be.
      expect(result.source, isNot(contains('_skalEncodePosition')));
      expect(result.source, contains('_skalEncodeBattery'));
      // Enum returns serialize by name, not index — stable across a
      // reordering of the Dart enum.
      expect(result.source, contains('.name'));

      _expectSnapshot(result.source, expectedPath,
          reason: 'service generator output does NOT match '
              'service_class.expected.dart');
    });
  });
}

/// Strip trailing whitespace on each line + collapse multiple blank
/// lines to one. Defensive against editor settings; the meaningful
/// shape of the generated code is what we're snapshotting.
String _normalize(String s) =>
    s.split('\n').map((l) => l.trimRight()).join('\n').trimRight();

/// Compare `actual` (the generator output) against the snapshot at
/// `expectedPath`. When `SKAL_UPDATE_SNAPSHOTS=1` is set in the
/// environment, the actual output OVERWRITES the snapshot file
/// instead of asserting — used to regenerate fixtures after an
/// encoder change. Returns silently in that mode so the test passes.
void _expectSnapshot(String actual, String expectedPath,
    {required String reason}) {
  if (Platform.environment['SKAL_UPDATE_SNAPSHOTS'] == '1') {
    File(expectedPath).writeAsStringSync(actual);
    return;
  }
  final expected = File(expectedPath).readAsStringSync();
  expect(_normalize(actual), _normalize(expected), reason: reason);
}
