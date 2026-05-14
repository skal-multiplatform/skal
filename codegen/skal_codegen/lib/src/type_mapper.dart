// Maps Dart constructor-parameter types to the bridge's custom-prop
// reads that an adapter should emit for each parameter.
//
// Each [PropEncoding] is the right-hand side of an assignment in the
// generated adapter:
//
//   final color = Color(n.getCustomPropU32('color', 0xFF000000));
//                 ^^^^^                              ^^^^^^^^^^
//                 wrap                               default
//
//                       ^^^^^^^^^^^^^^^^^^^^^^^^
//                       getterCall (always n.getCustomPropX(name, default))
//
// The mapper doesn't generate code itself — [Generator] consumes
// [PropEncoding] records and stitches them into the final adapter
// source. Keeps the "Dart type → encoding" logic isolated + testable.
//
// Supported types:
//
//   String      → getCustomPropStr(name) ?? '<default>'
//   int         → getCustomPropU32(name, <default>)
//   double      → getCustomPropF32(name, <default>)
//   bool        → getCustomPropU32(name, 0) != 0       (and ? 1 : 0 for default)
//   Color       → Color(getCustomPropU32(name, 0xAARRGGBB))
//   enum        → <EnumType>.values[getCustomPropU32(name, <defaultIndex>)]
//   Duration    → Duration(milliseconds: getCustomPropU32(name, <defaultMs>))
//   EdgeInsets  → EdgeInsets.fromLTRB(<4 f32 reads>, with side-named
//                                     subprops: paddingLeft/Top/Right/Bottom
//                                     for a param named `padding`)
//   Widget      → SkalNode(nodeId: <first JSX child>, ...) — the
//                 widget renders the FIRST child node from JSX.
//   List<Widget>→ List.generate(n.childCount, (i) => SkalNode(...)) —
//                 EVERY JSX child becomes one element. Unlocks multi-
//                 child wrappers like Wrap, Stack, Flow, StaggeredGrid.
//
// Anything else → null (the caller skips the whole widget with a
// warning — falls back to a hand-written adapter for the long tail).
// Later slices add Offset, TextStyle, etc.

// The new Element2 model is marked @experimental until the analyzer
// team stabilizes it. The OLD Element API is deprecated. Either side
// produces analyzer warnings; we prefer the new API (it's the future,
// and stabilization is just dropping the @experimental marker, not a
// new code change), and suppress its `experimental_member_use`
// warnings at file scope.
// ignore_for_file: experimental_member_use

import 'package:analyzer/dart/constant/value.dart';
import 'package:analyzer/dart/element/element2.dart';
import 'package:analyzer/dart/element/type.dart';

/// A single constructor parameter's bridge encoding.
class PropEncoding {
  /// The full RHS expression that reads the prop from the bridge,
  /// including any wrapper construction (e.g. `Color(...)`).
  ///
  /// Templated: callers don't replace anything; this is the literal
  /// source string to emit.
  final String readerExpression;

  /// The original Dart type spelled out (e.g. "String", "Color",
  /// "double"). Useful for generated comments / future inline doc.
  final String dartTypeName;

  /// Extra `import` URIs the generated file needs to make
  /// [readerExpression] compile. The generator dedupes + emits these
  /// alongside the standard framework imports.
  ///
  /// Primitive encodings need nothing extra (the std imports already
  /// cover them). Widget-child encoding needs SkalNode, which lives
  /// in `package:skal_flutter/skal/root.dart`.
  final List<String> requiredImports;

  /// Top-level helper functions the encoding needs in scope. The
  /// generator deduplicates by key and emits each value (a Dart code
  /// snippet) exactly once at the top of the file, after imports.
  /// Used by encoders that emit a CALL to a helper function rather
  /// than inlining the full expression (e.g. `_skalParseGradient(json)`).
  ///
  /// Keys: stable helper name (used for dedup across call sites).
  /// Values: the helper's full source, including its function signature.
  final Map<String, String> requiredHelpers;

  const PropEncoding({
    required this.readerExpression,
    required this.dartTypeName,
    this.requiredImports = const [],
    this.requiredHelpers = const {},
  });
}

/// Map a constructor-parameter type + default-value expression to a
/// [PropEncoding], or return null if we don't (yet) know how to
/// encode this type.
///
/// [paramName] is the JSX-side prop name (also the registry key for
/// custom props on the bridge).
///
/// [defaultLiteral] is the parameter's default value, spelled exactly
/// as it appeared in the source ("'Hello'", "14.0", "const Color(0xFF000000)").
/// If the parameter has no default, pass null and we'll synthesize a
/// type-appropriate fallback ("''", "0", "0.0", "false", "0xFF000000").
PropEncoding? encodingFor({
  required DartType type,
  required String paramName,
  required String? defaultLiteral,
  DartObject? defaultConstant,
}) {
  final typeName = type.getDisplayString();

  // String — getCustomPropStr returns String?. For non-nullable
  // String, coalesce to the declared default (or '' if no default).
  // For nullable String?, pass the bridge's null through verbatim so
  // the dev's factory can distinguish "JSX didn't set this prop"
  // from "JSX set this prop to empty string".
  if (_isCoreString(type)) {
    final isNullable = typeName.endsWith('?');
    if (isNullable) {
      // String? — fall through unchanged. `?? null` would be a lint
      // warning, so just return the raw nullable read.
      return PropEncoding(
        readerExpression: "n.getCustomPropStr('$paramName')",
        dartTypeName: typeName,
      );
    }
    final fallback = defaultLiteral ?? "''";
    return PropEncoding(
      readerExpression: "n.getCustomPropStr('$paramName') ?? $fallback",
      dartTypeName: typeName,
    );
  }

  // double — covers `double?` too via promoteNullable lookup.
  if (_isCoreDouble(type)) {
    final fallback = defaultLiteral ?? '0.0';
    return PropEncoding(
      readerExpression: "n.getCustomPropF32('$paramName', $fallback)",
      dartTypeName: typeName,
    );
  }

  // int.
  if (_isCoreInt(type)) {
    final fallback = defaultLiteral ?? '0';
    return PropEncoding(
      readerExpression: "n.getCustomPropU32('$paramName', $fallback)",
      dartTypeName: typeName,
    );
  }

  // bool — encoded as u32 0/1 on the wire. The default for the
  // getCustomPropU32 call uses the boolean's int equivalent (1 or 0);
  // the != 0 check rebuilds the bool at the call site.
  if (_isCoreBool(type)) {
    final defaultInt = _boolDefaultAsInt(defaultLiteral);
    return PropEncoding(
      readerExpression:
          "n.getCustomPropU32('$paramName', $defaultInt) != 0",
      dartTypeName: typeName,
    );
  }

  // Enum — Dart's `enum Foo { a, b, c }` types. Wire encoding is the
  // u32 enum index; reader rebuilds via `EnumType.values[index]`.
  //
  // The enum type itself must be in scope at the generated adapter's
  // call site. For widgets imported via `package:foo/foo.dart`, that
  // import typically re-exports the enum too (most packages export
  // their full API). For widgets in the consumer's own lib/, the
  // file-relative import already pulls in the enum.
  //
  // Default value: extracted from the analyzer's constant evaluation.
  // `BoxFit.cover` evaluates to a DartObject whose `index` field is
  // the int we want. If the param has no default, fall back to index 0
  // (the enum's first value).
  if (_isEnum(type)) {
    final defaultIndex =
        defaultConstant?.getField('index')?.toIntValue() ?? 0;
    // Strip nullable suffix from the type name for `Foo.values` access
    // — `BoxFit?.values` wouldn't parse.
    final cleanTypeName = typeName.endsWith('?')
        ? typeName.substring(0, typeName.length - 1)
        : typeName;
    return PropEncoding(
      readerExpression:
          "$cleanTypeName.values[n.getCustomPropU32('$paramName', $defaultIndex)]",
      dartTypeName: typeName,
    );
  }

  // Duration — dart:core's value type. Wire encoding is u32 milliseconds
  // (rather than microseconds) because that's the granularity Flutter
  // animations actually use, AND u32 millis caps at ~50 days which is
  // plenty for any UI value. Microseconds would cap at ~71 minutes,
  // limiting long-running animation durations.
  //
  // Default extraction: Duration stores microseconds in a private field
  // named `_duration`. analyzer's DartObject doesn't expose a typed
  // `toDurationValue()` (that's reserved for built-in types it special-
  // cases — bool/int/double/String/etc.). For user-shaped types like
  // Duration we read the field directly. Divide by 1000 to get
  // milliseconds for the wire.
  if (_isDuration(type)) {
    final micros =
        defaultConstant?.getField('_duration')?.toIntValue() ?? 0;
    final defaultMs = micros ~/ 1000;
    return PropEncoding(
      readerExpression:
          "Duration(milliseconds: n.getCustomPropU32('$paramName', $defaultMs))",
      dartTypeName: typeName,
    );
  }

  // Widget — the param expects a child widget. JSX expresses these
  // as child elements of the parent: `<Hero><Image src="…"/></Hero>`
  // becomes "the Hero adapter receives the Image as its first child
  // node via NodeState.childAt(0)".
  //
  // Encoding: read the first child node and instantiate it as a
  // SkalNode. SkalNode is Skal's widget-tree-cell — wraps the bridge
  // node id, subscribes to its `cold` notifier, builds the matching
  // widget via _buildForType. Same mechanism the framework uses for
  // every built-in widget's children.
  //
  // For non-nullable `Widget child` params the constructor demands a
  // widget; if JSX provided no children we fall back to
  // `SizedBox.shrink()` so the constructor still succeeds (the
  // mis-use is visible as zero-sized empty space rather than a
  // crash). For nullable `Widget? child` the same fallback works
  // — passing a shrink widget is functionally equivalent to null
  // for layout purposes, and keeps the generated code uniform.
  //
  if (_isFlutterWidget(type)) {
    return PropEncoding(
      readerExpression: 'n.childCount > 0'
          ' ? SkalNode(nodeId: n.childAt(0), bridge: bridge, '
          'key: ValueKey<int>(n.childAt(0)))'
          ' : const SizedBox.shrink()',
      dartTypeName: typeName,
      requiredImports: const ['package:skal_flutter/skal/root.dart'],
    );
  }

  // List<Widget> — multi-child wrappers. Wrap, Stack, Flow, Column-
  // alikes from third-party packages. Every JSX child becomes one
  // element; childCount=0 produces an empty list (which Flutter
  // multi-child widgets accept).
  //
  // Generator emits a `List.generate(childCount, …)` so the list is
  // freshly built on each rebuild — important because the per-child
  // SkalNode needs a stable ValueKey tied to the node id (Flutter
  // diff-keys by it for child reordering). Allocating a small list
  // per rebuild is the same cost the manual Row/Column intrinsics
  // pay; the multi-child render path is the same downstream.
  //
  // The default value for an unsupplied `List<Widget> children = const []`
  // is irrelevant — JSX always supplies children (or doesn't, and
  // the empty list is the right behavior). No constant-eval needed.
  if (_isFlutterWidgetList(type)) {
    return PropEncoding(
      readerExpression: 'List.generate(n.childCount, (i) => '
          'SkalNode(nodeId: n.childAt(i), bridge: bridge, '
          'key: ValueKey<int>(n.childAt(i))))',
      dartTypeName: typeName,
      requiredImports: const ['package:skal_flutter/skal/root.dart'],
    );
  }

  // EdgeInsets — Flutter's padding/margin value type. Maps to FOUR
  // separate F32 props in the bridge (one per side) because a single-
  // u32 encoding would lose precision and a single-string encoding
  // would feel un-JSX-y at the call site.
  //
  // Sub-prop naming convention: <paramName><Side> with the side name
  // capitalized. For a param `padding`, the JSX sub-props are
  // `paddingLeft`, `paddingTop`, `paddingRight`, `paddingBottom`. For
  // `margin`, `marginLeft` and so on. Symmetric across all wrapped
  // widgets — a dev wrapping multiple widgets with EdgeInsets params
  // gets the same naming everywhere.
  //
  // Generated reader uses `EdgeInsets.fromLTRB(...)` because that's
  // the constructor whose parameter order matches our side iteration
  // (left, top, right, bottom). Other EdgeInsets constructors
  // (`.all`, `.symmetric`, `.only`) produce the same shape but their
  // call-site form would be awkward to emit.
  //
  // Defaults: read each of left/top/right/bottom off the constant
  // evaluation of the parameter's default expression. Works for
  // `EdgeInsets.all(10.0)`, `EdgeInsets.fromLTRB(8, 16, 8, 16)`,
  // `EdgeInsets.symmetric(horizontal: 4, vertical: 8)` — all flatten
  // to four doubles on the constant value.
  if (_isFlutterEdgeInsets(type)) {
    final l =
        defaultConstant?.getField('left')?.toDoubleValue() ?? 0.0;
    final t =
        defaultConstant?.getField('top')?.toDoubleValue() ?? 0.0;
    final r =
        defaultConstant?.getField('right')?.toDoubleValue() ?? 0.0;
    final b =
        defaultConstant?.getField('bottom')?.toDoubleValue() ?? 0.0;
    final leftProp = '$paramName${_sidePropSuffix("Left")}';
    final topProp = '$paramName${_sidePropSuffix("Top")}';
    final rightProp = '$paramName${_sidePropSuffix("Right")}';
    final bottomProp = '$paramName${_sidePropSuffix("Bottom")}';
    return PropEncoding(
      readerExpression: 'EdgeInsets.fromLTRB('
          "n.getCustomPropF32('$leftProp', $l), "
          "n.getCustomPropF32('$topProp', $t), "
          "n.getCustomPropF32('$rightProp', $r), "
          "n.getCustomPropF32('$bottomProp', $b))",
      dartTypeName: typeName,
    );
  }

  // Offset — Flutter's `dart:ui` Offset (dx, dy). Two-prop expansion
  // following the EdgeInsets pattern: `<paramName>X` + `<paramName>Y`.
  // For a param named `position`, JSX sets `positionX={…} positionY={…}`.
  if (_isFlutterOffset(type)) {
    final dx = defaultConstant?.getField('dx')?.toDoubleValue() ?? 0.0;
    final dy = defaultConstant?.getField('dy')?.toDoubleValue() ?? 0.0;
    return PropEncoding(
      readerExpression: 'Offset('
          "n.getCustomPropF32('${paramName}X', $dx), "
          "n.getCustomPropF32('${paramName}Y', $dy))",
      dartTypeName: typeName,
    );
  }

  // Alignment — Flutter's `painting` Alignment (x, y in [-1, 1]).
  // Same two-prop expansion as Offset but with Alignment constructor.
  // JSX: `alignmentX={…} alignmentY={…}` (or whatever the dev's param
  // name is, e.g. `anchorX`/`anchorY` for `anchor`).
  if (_isFlutterAlignment(type)) {
    final ax = defaultConstant?.getField('x')?.toDoubleValue() ?? 0.0;
    final ay = defaultConstant?.getField('y')?.toDoubleValue() ?? 0.0;
    return PropEncoding(
      readerExpression: 'Alignment('
          "n.getCustomPropF32('${paramName}X', $ax), "
          "n.getCustomPropF32('${paramName}Y', $ay))",
      dartTypeName: typeName,
    );
  }

  // BorderRadius — uniform-all-corners only for v1. Per-corner shapes
  // (BorderRadius.only) would need 4-prop expansion plus a Radius
  // constructor; defer until a real package needs it. The dev sets a
  // single `<paramName>Radius` prop; codegen emits
  // `BorderRadius.all(Radius.circular(r))`.
  if (_isFlutterBorderRadius(type)) {
    // Default extraction: BorderRadius stores the corners as topLeft /
    // topRight / etc. — for the uniform case all four match. Read
    // topLeft.x as the representative.
    final r = defaultConstant
            ?.getField('topLeft')
            ?.getField('x')
            ?.toDoubleValue() ??
        0.0;
    return PropEncoding(
      readerExpression: 'BorderRadius.all(Radius.circular('
          "n.getCustomPropF32('${paramName}Radius', $r)))",
      dartTypeName: typeName,
    );
  }

  // TextStyle — most commonly-tweaked fields, decomposed into sub-props.
  // Mirrors the built-in <Text> widget's flat prop set so the
  // mental model is the same. For a param named `style`:
  //   styleFontSize, styleColor, styleLetterSpacing, styleHeight,
  //   styleFontWeight (index 0..8 → w100..w900).
  //
  // Fields NOT covered (yet): fontFamily, fontStyle (italic),
  // decoration, decorationColor, decorationStyle. Same pattern would
  // extend; mechanical to add when packages need them.
  if (_isFlutterTextStyle(type)) {
    final fontSize =
        defaultConstant?.getField('fontSize')?.toDoubleValue() ?? 14.0;
    // FontWeight is a class with static-const instances; its `.index`
    // field holds the values-list index (0..8 for w100..w900). Pull
    // that for the default; the JSX side passes the index directly.
    final fontWeightIdx =
        defaultConstant?.getField('fontWeight')?.getField('index')?.toIntValue()
            ?? 3;  // w400 = "normal"
    // Color: same dual-extraction as the standalone Color encoder.
    final colorDefault = defaultConstant?.getField('color');
    final colorU32 = _colorObjAsU32(colorDefault);
    final letterSpacing = defaultConstant
            ?.getField('letterSpacing')
            ?.toDoubleValue() ??
        0.0;
    final height =
        defaultConstant?.getField('height')?.toDoubleValue() ?? 1.0;
    return PropEncoding(
      readerExpression: 'TextStyle('
          "fontSize: n.getCustomPropF32('${paramName}FontSize', $fontSize), "
          "color: Color(n.getCustomPropU32('${paramName}Color', $colorU32)), "
          "fontWeight: FontWeight.values[n.getCustomPropU32"
          "('${paramName}FontWeight', $fontWeightIdx)], "
          "letterSpacing: n.getCustomPropF32"
          "('${paramName}LetterSpacing', $letterSpacing), "
          "height: n.getCustomPropF32('${paramName}Height', $height))",
      dartTypeName: typeName,
    );
  }

  // BoxDecoration — common fields only (color + uniform borderRadius).
  // Full surface (Border with per-side widths, BoxShadow lists,
  // Gradient, DecorationImage) is too rich for primitive expansion;
  // dev wraps via a host pattern or manual adapter for those.
  //
  // Sub-props: <paramName>Color + <paramName>BorderRadius.
  if (_isFlutterBoxDecoration(type)) {
    final colorDefault = defaultConstant?.getField('color');
    final colorU32 = _colorObjAsU32(colorDefault);
    // borderRadius is itself a BorderRadius value — extract top-left.x
    // as the uniform-radius default.
    final brDefault = defaultConstant?.getField('borderRadius');
    final radius = brDefault
            ?.getField('topLeft')
            ?.getField('x')
            ?.toDoubleValue() ??
        0.0;
    return PropEncoding(
      readerExpression: 'BoxDecoration('
          "color: Color(n.getCustomPropU32('${paramName}Color', $colorU32)), "
          "borderRadius: BorderRadius.all(Radius.circular("
          "n.getCustomPropF32('${paramName}BorderRadius', $radius))))",
      dartTypeName: typeName,
    );
  }

  // ImageProvider — string-coercion convention. Single `<paramName>`
  // prop, value is a URL/path string. The IIFE inside the encoding
  // picks the right concrete subtype at runtime per prefix:
  //   "http://" / "https://"  → NetworkImage
  //   "file://" / starts "/"  → FileImage
  //   anything else           → AssetImage  (assets/foo.png, etc.)
  // Empty string returns a 1×1 transparent AssetImage as a safe
  // fallback (most widgets accept any ImageProvider; the displayed
  // pixels are nothing).
  // Gradient (Linear/Radial/Sweep) — JSON-object JSX prop. The
  // renderer's _setCustomProperty (js-app/src/renderer.js) JSON-
  // stringifies non-null object/array prop values; the Dart side
  // receives a string + parses it via the emitted helper.
  //
  // JSX shape:
  //
  //   <Container gradient={{
  //     type: 'linear',         // or 'radial' | 'sweep' (default: linear)
  //     colors: ['#FF0000', '#0000FF'],
  //     stops: [0.0, 1.0],       // optional
  //     begin: 'topLeft',        // string preset or [x, y]; default centerLeft
  //     end:   'bottomRight',    // for radial: `center` + `radius`
  //   }} />
  //
  // Each detection causes the parser helpers to land at the top of
  // the file once (deduped via requiredHelpers).
  if (_isFlutterGradient(type)) {
    // The helper returns `Gradient?` (nullable on missing JSON). For
    // a required Gradient param we cast — at runtime null throws,
    // which is the right behavior (the dev forgot to set the prop
    // on a widget that needs one). For Gradient? params no cast
    // needed; the nullable return assigns directly.
    final isNullable = typeName.endsWith('?');
    final expr = isNullable
        ? "_skalParseGradient(n.getCustomPropStr('$paramName'))"
        : "(_skalParseGradient(n.getCustomPropStr('$paramName')) as Gradient)";
    return PropEncoding(
      readerExpression: expr,
      dartTypeName: typeName,
      requiredImports: const ['dart:convert'],
      requiredHelpers: const {
        '_skalParseGradient': _gradientHelperSource,
        '_skalParseColor':    _gradientColorHelperSource,
        '_skalParseAlignment': _gradientAlignmentHelperSource,
      },
    );
  }

  if (_isFlutterImageProvider(type)) {
    // Nullability matters here. Returning null from the IIFE for
    // empty string only makes sense if the param is `ImageProvider?`;
    // for non-nullable `ImageProvider` we need to construct something
    // (AssetImage('') with its runtime warning, or a transparent
    // placeholder — we go with AssetImage('') so the dev sees a clear
    // "you didn't set the prop" failure if it matters).
    //
    // The IIFE's branches return different concrete subtypes, so
    // Dart's inference collapses the return type to their common
    // supertype Object. Explicit cast pins it to the right nullable/
    // non-nullable shape so it assigns to the param without complaint.
    final isNullable = typeName.endsWith('?');
    final castTo = isNullable ? 'ImageProvider?' : 'ImageProvider';
    final nullBranch = isNullable
        ? 'if (s.isEmpty) return null; '
        // Non-nullable: skip the empty-check, AssetImage('') gets
        // returned and Flutter warns at runtime.
        : '';
    return PropEncoding(
      readerExpression: '((() { '
          "final s = n.getCustomPropStr('$paramName') ?? ''; "
          '$nullBranch'
          "if (s.startsWith('http')) return NetworkImage(s); "
          "if (s.startsWith('file://')) return FileImage(File(s.substring(7))); "
          "if (s.startsWith('/')) return FileImage(File(s)); "
          'return AssetImage(s); '
          '})() as $castTo)',
      dartTypeName: typeName,
      // FileImage uses dart:io.File. The generated file would need an
      // import for that.
      requiredImports: const ['dart:io'],
    );
  }

  // VoidCallback — Flutter's typedef `void Function()`. JSX-side
  // function-valued props auto-bind via the renderer's custom-handler
  // path (see js-app/src/renderer.js's `_setCustomProperty` —
  // typeof value === 'function' → newHandlerId + bindCustomHandler).
  // The host has zero plumbing to do; the encoding here is the
  // glue between "Dart constructor wants a () → void" and "the
  // bridge stored a handler id under this name". We emit a closure
  // that dispatches the event through the bridge.
  //
  // The closure captures the BRIDGE, not the handler id. Reading the
  // handler id at call time means the JSX side can swap out the
  // bound function (e.g. via a reactive signal) without the Dart
  // adapter caring — the next dispatch reads whichever id was last
  // bound. If the JSX side never bound a handler, the id reads as
  // 0 and `dispatchEvent(0)` is a documented no-op.
  if (_isVoidCallback(type)) {
    return PropEncoding(
      readerExpression: "() => bridge.dispatchEvent("
          "n.getCustomHandler('$paramName'))",
      dartTypeName: typeName,
    );
  }

  // ValueChanged<T> — Flutter's typedef `void Function(T value)`. The
  // generated closure dispatches a typed event via the bridge's
  // dispatchEventInt/Double/Bool helpers, which carry the payload in
  // bytes 8-11 of the 16-byte event record (see wire.dart's "Event
  // record layout"). Supported T: int, double, bool. String / enum
  // / list payloads are deferred — the event ring is producer-only
  // for Dart, so we can't write into the shared string heap from
  // here.
  //
  // Real-world unlock: Switch.onChanged (bool), Slider.onChanged
  // (double), TextField.onChanged (String — deferred), Checkbox,
  // RadioButton, etc.
  final valueChangedT = _valueChangedTypeArg(type);
  if (valueChangedT != null) {
    if (_isCoreInt(valueChangedT)) {
      return PropEncoding(
        readerExpression: "(v) => bridge.dispatchEventInt("
            "n.getCustomHandler('$paramName'), v)",
        dartTypeName: typeName,
      );
    }
    if (_isCoreDouble(valueChangedT)) {
      return PropEncoding(
        readerExpression: "(v) => bridge.dispatchEventDouble("
            "n.getCustomHandler('$paramName'), v)",
        dartTypeName: typeName,
      );
    }
    if (_isCoreBool(valueChangedT)) {
      return PropEncoding(
        readerExpression: "(v) => bridge.dispatchEventBool("
            "n.getCustomHandler('$paramName'), v)",
        dartTypeName: typeName,
      );
    }
    if (_isCoreString(valueChangedT)) {
      return PropEncoding(
        readerExpression: "(v) => bridge.dispatchEventStr("
            "n.getCustomHandler('$paramName'), v)",
        dartTypeName: typeName,
      );
    }
    // ValueChanged<EnumX> / ValueChanged<List<T>> / etc — fall through
    // to the unsupported-type skip path. Enums could encode as i32
    // (their index); add when the first real-world need shows up.
  }

  // Multi-arg callback: `void Function(T1, T2, …)` — typically list
  // tap callbacks like `void onItemTap(int index, String payload)`.
  // Codegen emits a closure that calls bridge.dispatchEventTuple
  // with the args list; JS-side drain JSON-decodes + spreads on the
  // bound handler.
  //
  // Requirement: 2+ positional args, all jsonEncode-able. We don't
  // try to validate "encodable" at codegen time — jsonEncode handles
  // primitives, Lists, Maps, and toJson()-bearing classes; non-
  // encodable values surface at runtime as a void dispatch fallback
  // (the handler fires with no args).
  if (_isMultiArgCallback(type)) {
    final ft = type as FunctionType;
    final paramNames =
        ft.formalParameters.map((p) => p.name3 ?? '_').join(', ');
    return PropEncoding(
      readerExpression: '($paramNames) => bridge.dispatchEventTuple('
          "n.getCustomHandler('$paramName'), [$paramNames])",
      dartTypeName: typeName,
    );
  }

  // Color — Flutter's `ui.Color` (or `material.Color`, same class).
  // Wire encoding is 32-bit ARGB; adapter wraps in Color(...).
  //
  // To preserve the wrapped widget's BEHAVIOR when JSX omits the
  // prop, we need the real ARGB value of the constructor's declared
  // default, not a hard-coded fallback. The analyzer's constant
  // evaluator gives us the [Color.value] int regardless of how the
  // source spelled it (`Colors.transparent`, `Colors.red.shade400`,
  // `const Color(0xFF1DA1F2)`, etc. — all evaluate to a Color
  // instance whose `.value` is a 32-bit ARGB int).
  //
  // Without this, qr_flutter's `backgroundColor = Colors.transparent`
  // would silently become opaque black in the generated adapter,
  // hiding the QR pattern behind a black square. (This was the bug
  // the qr_flutter integration surfaced.)
  if (_isFlutterColor(type)) {
    final fallbackU32 = _colorDefaultAsU32(defaultConstant);
    return PropEncoding(
      readerExpression:
          "Color(n.getCustomPropU32('$paramName', $fallbackU32))",
      dartTypeName: typeName,
    );
  }

  // Unsupported (yet). Caller decides: skip the widget with a warning,
  // or fall through to a hand-written adapter slot.
  return null;
}

bool _isCoreString(DartType t) =>
    t.element3?.name3 == 'String' && t.element3?.library2?.isDartCore == true;

bool _isCoreInt(DartType t) =>
    t.element3?.name3 == 'int' && t.element3?.library2?.isDartCore == true;

bool _isCoreDouble(DartType t) =>
    t.element3?.name3 == 'double' && t.element3?.library2?.isDartCore == true;

bool _isCoreBool(DartType t) =>
    t.element3?.name3 == 'bool' && t.element3?.library2?.isDartCore == true;

bool _isEnum(DartType t) {
  // Analyzer represents Dart enums with EnumElement2 (a subtype of
  // InterfaceElement2). Matching purely by element kind, not by
  // name — any enum type qualifies regardless of where it's declared.
  return t.element3 is EnumElement2;
}

bool _isDuration(DartType t) =>
    t.element3?.name3 == 'Duration' &&
    t.element3?.library2?.isDartCore == true;

/// Match Flutter's `Widget` (or any of its core subclasses used as
/// type annotations: StatelessWidget, StatefulWidget, PreferredSizeWidget).
/// We treat all of these as "render the first JSX child here" — the
/// param's narrower type signals nothing the encoding needs to vary
/// on, since SkalNode renders whatever's at the child node id.
bool _isFlutterWidget(DartType t) {
  final name = t.element3?.name3;
  if (name == 'Widget' ||
      name == 'StatelessWidget' ||
      name == 'StatefulWidget' ||
      name == 'PreferredSizeWidget') {
    return true;
  }
  // Walk the supertype chain — a user-defined widget class (e.g.
  // `class MyChip extends StatelessWidget`) is still a Widget.
  final el = t.element3;
  if (el is InterfaceElement2) {
    var sup = el.supertype;
    while (sup != null) {
      final supName = sup.element3.name3;
      if (supName == 'Widget' ||
          supName == 'StatelessWidget' ||
          supName == 'StatefulWidget' ||
          supName == 'PreferredSizeWidget') {
        return true;
      }
      sup = sup.element3.supertype;
    }
  }
  return false;
}

/// Match `List<Widget>` (or List of any Widget subclass —
/// `List<StatefulWidget>` etc., though rare in real APIs). The
/// element check looks for the dart:core `List` type plus a single
/// type argument that passes [_isFlutterWidget].
bool _isFlutterWidgetList(DartType t) {
  final el = t.element3;
  if (el?.name3 != 'List') return false;
  if (el?.library2?.isDartCore != true) return false;
  if (t is! InterfaceType) return false;
  if (t.typeArguments.length != 1) return false;
  return _isFlutterWidget(t.typeArguments.first);
}

bool _isFlutterOffset(DartType t) => t.element3?.name3 == 'Offset';
bool _isFlutterAlignment(DartType t) => t.element3?.name3 == 'Alignment';
bool _isFlutterBorderRadius(DartType t) =>
    t.element3?.name3 == 'BorderRadius' ||
    t.element3?.name3 == 'BorderRadiusGeometry';
bool _isFlutterTextStyle(DartType t) => t.element3?.name3 == 'TextStyle';
bool _isFlutterBoxDecoration(DartType t) =>
    t.element3?.name3 == 'BoxDecoration';
bool _isFlutterGradient(DartType t) {
  final name = t.element3?.name3;
  if (name == 'Gradient' ||
      name == 'LinearGradient' ||
      name == 'RadialGradient' ||
      name == 'SweepGradient') {
    return true;
  }
  // Catch subtypes — most packages don't extend Gradient themselves,
  // but if they did we'd still want to recognize the assignability.
  final el = t.element3;
  if (el is InterfaceElement2) {
    var sup = el.supertype;
    while (sup != null) {
      if (sup.element3.name3 == 'Gradient') return true;
      sup = sup.element3.supertype;
    }
  }
  return false;
}

/// Source for `_skalParseGradient` — emitted once per generated file
/// when any encoder requests a Gradient parse. Switches on `m['type']`,
/// constructs the right concrete subtype, defaults to LinearGradient
/// on missing/unknown type. Returns null on empty input so nullable
/// params (`Gradient?`) get a clean null instead of a zero-color
/// LinearGradient at runtime.
const String _gradientHelperSource = '''
Gradient? _skalParseGradient(String? json) {
  if (json == null || json.isEmpty) return null;
  final m = jsonDecode(json) as Map<String, dynamic>;
  final colors = (m['colors'] as List).map(_skalParseColor).toList();
  final stops = (m['stops'] as List?)
      ?.cast<num>().map((n) => n.toDouble()).toList();
  switch (m['type']) {
    case 'radial':
      return RadialGradient(
        colors: colors,
        stops: stops,
        radius: (m['radius'] as num?)?.toDouble() ?? 0.5,
        center: _skalParseAlignment(m['center'], def: Alignment.center),
      );
    case 'sweep':
      return SweepGradient(
        colors: colors,
        stops: stops,
        startAngle: (m['startAngle'] as num?)?.toDouble() ?? 0.0,
        endAngle: (m['endAngle'] as num?)?.toDouble() ?? 6.283185307,
        center: _skalParseAlignment(m['center'], def: Alignment.center),
      );
    default:  // 'linear' or missing
      return LinearGradient(
        colors: colors,
        stops: stops,
        begin: _skalParseAlignment(m['begin'], def: Alignment.centerLeft),
        end: _skalParseAlignment(m['end'], def: Alignment.centerRight),
      );
  }
}''';

/// Helper for parsing Color from JSON. Accepts an int (raw ARGB) or a
/// hex string (with or without `#`, 6 or 8 chars).
const String _gradientColorHelperSource = '''
Color _skalParseColor(dynamic v) {
  if (v is int) return Color(v);
  if (v is String) {
    var s = v.startsWith('#') ? v.substring(1) : v;
    if (s.length == 6) s = 'FF\$s';
    return Color(int.parse(s, radix: 16));
  }
  return const Color(0xFF000000);
}''';

/// Helper for parsing Alignment from JSON. Accepts named presets
/// ('topLeft', 'center', etc.) or a two-element [x, y] array.
const String _gradientAlignmentHelperSource = '''
Alignment _skalParseAlignment(dynamic v, {Alignment def = Alignment.center}) {
  if (v is String) {
    switch (v) {
      case 'topLeft':      return Alignment.topLeft;
      case 'topCenter':    return Alignment.topCenter;
      case 'topRight':     return Alignment.topRight;
      case 'centerLeft':   return Alignment.centerLeft;
      case 'center':       return Alignment.center;
      case 'centerRight':  return Alignment.centerRight;
      case 'bottomLeft':   return Alignment.bottomLeft;
      case 'bottomCenter': return Alignment.bottomCenter;
      case 'bottomRight':  return Alignment.bottomRight;
    }
  }
  if (v is List && v.length == 2) {
    return Alignment((v[0] as num).toDouble(), (v[1] as num).toDouble());
  }
  return def;
}''';

bool _isFlutterImageProvider(DartType t) {
  // ImageProvider is generic (`ImageProvider<T>`); checking the base
  // class name catches the type AND its subtypes (NetworkImage,
  // AssetImage, etc.) — though codegen typically sees the abstract
  // ImageProvider form when it's a constructor param type.
  final name = t.element3?.name3;
  if (name == 'ImageProvider') return true;
  // Walk supertypes to catch direct subclasses used as param types.
  final el = t.element3;
  if (el is InterfaceElement2) {
    var sup = el.supertype;
    while (sup != null) {
      if (sup.element3.name3 == 'ImageProvider') return true;
      sup = sup.element3.supertype;
    }
  }
  return false;
}

bool _isFlutterEdgeInsets(DartType t) {
  // Matches Flutter's `EdgeInsets` (`package:flutter/painting.dart`).
  // Like _isFlutterColor, match by name alone — gets the fake-Flutter
  // shim too. EdgeInsets extends EdgeInsetsGeometry; we only handle
  // the concrete EdgeInsets subclass for now (EdgeInsetsDirectional
  // would need rtl-aware encoding).
  return t.element3?.name3 == 'EdgeInsets';
}

/// Side-name suffix joined to a param name. `Left` stays `Left`; if
/// the param name ALREADY ends in the side word ("paddingLeft"
/// already → leave alone) we'd get `paddingLeftLeft` — not handled
/// here since EdgeInsets params are conventionally named `padding`,
/// `margin`, `insets`, never `paddingLeft`.
String _sidePropSuffix(String capitalized) => capitalized;

/// If [t] is `ValueChanged<X>` (or `void Function(X)?`, the de-aliased
/// form), return the type argument `X`. Otherwise null.
///
/// `ValueChanged<T>` is dart:ui's `typedef ValueChanged<T> = void
/// Function(T value);`. The analyzer presents the typedef instantiation
/// as a FunctionType with one positional param + void return — same
/// shape as a raw `void Function(T)`. We don't try to distinguish the
/// typedef-aliased form from the explicit one (they're equivalent at
/// the call site).
DartType? _valueChangedTypeArg(DartType t) {
  if (t is! FunctionType) return null;
  if (t.returnType is! VoidType) return null;
  if (t.formalParameters.length != 1) return null;
  final param = t.formalParameters.first;
  if (!param.isPositional) return null;
  return param.type;
}

/// `void Function(T1, T2, …)` with 2+ positional args. The
/// single-arg case is `ValueChanged<T>`; the zero-arg is
/// `VoidCallback`. This catches everything else.
bool _isMultiArgCallback(DartType t) {
  if (t is! FunctionType) return false;
  if (t.returnType is! VoidType) return false;
  if (t.formalParameters.length < 2) return false;
  // Every arg must be positional (named args in event callbacks are
  // rare and would complicate the spread on the JS side).
  for (final p in t.formalParameters) {
    if (!p.isPositional) return false;
  }
  return true;
}

/// Match Flutter's `VoidCallback` (defined in `dart:ui` as
/// `typedef VoidCallback = void Function();`) AND raw `void
/// Function()` parameter types that happen to spell out the same
/// signature without the typedef.
///
/// Both forms appear in real Flutter APIs. The analyzer represents
/// the typedef as an alias over the underlying FunctionType — we
/// don't care which form the source used, only the signature shape:
/// no positional args, no named args, void return.
bool _isVoidCallback(DartType t) {
  if (t is! FunctionType) return false;
  if (t.formalParameters.isNotEmpty) return false;
  // Return must be `void`. The return-type's element3 is null for
  // the special `void` type — that's the cleanest discriminator.
  return t.returnType is VoidType;
}

bool _isFlutterColor(DartType t) {
  // Flutter's Color lives in `dart:ui` (re-exported by flutter/material).
  // Match by class name only: a Dart codebase rarely defines an
  // unrelated `Color`, and an ARGB-int wrap is the right encoding
  // for any class that does happen to be called Color + take a u32
  // constructor arg. This deliberate looseness also lets the test
  // suite use a self-contained fake-Flutter without a real Flutter
  // dev_dependency (see test/fixtures/_fake_flutter.dart).
  return t.element3?.name3 == 'Color';
}

/// Map a bool default-value expression to its int-on-the-wire form.
/// `true` → 1, `false` (or no default) → 0.
int _boolDefaultAsInt(String? defaultLiteral) {
  if (defaultLiteral == null) return 0;
  final trimmed = defaultLiteral.trim();
  if (trimmed == 'true') return 1;
  return 0;
}

/// Extract the ARGB-u32 representation of a Color default value via
/// constant evaluation. Returns the value formatted as a `0xAARRGGBB`
/// hex literal that pastes directly into the generated source. Falls
/// back to opaque black if the analyzer didn't give us a constant or
/// the constant isn't a Color (e.g. a non-const default like
/// `widget.themeData.primaryColor`, which can't be evaluated at
/// codegen time and isn't a real-world default anyway).
///
/// Works for any expression the analyzer evaluates to a `Color`:
///
///   `const Color(0xFF1DA1F2)`      → `0xFF1DA1F2`
///   `Colors.transparent`           → `0x00000000`
///   `Colors.red.shade400`          → `0xFFEF5350`
///   `Color.fromARGB(255, 30, 30, 30)` → `0xFF1E1E1E`
String _colorDefaultAsU32(DartObject? defaultConstant) =>
    _colorObjAsU32(defaultConstant);

/// Internal sibling — same Color-to-u32 conversion, but the helper
/// name reads more naturally when the input is a NESTED color object
/// (e.g. extracting `defaultConstant.getField('color')` from a
/// TextStyle's default). Same fallback semantics.
String _colorObjAsU32(DartObject? defaultConstant) {
  const fallback = '0xFF000000';
  if (defaultConstant == null) return fallback;

  // Two Flutter Color storage models exist depending on the SDK
  // version the consumer is on:
  //
  //   Legacy (pre-wide-gamut Flutter): a single `value` int field
  //       holding the ARGB-32 representation. `Color(0xFF1DA1F2).value`
  //       is `0xFF1DA1F2`.
  //
  //   Modern (current Flutter, ~3.27+): four `a`/`r`/`g`/`b` double
  //       fields in [0.0, 1.0], plus a `colorSpace` enum for wide-
  //       gamut support. `value` exists but is null in the constant
  //       evaluator's view of modern Color instances.
  //
  // Try the legacy path first (cheaper, more precise); fall back to
  // the modern double-component reconstruction. The output is the
  // same 32-bit ARGB int the bridge wire expects.
  final legacy = defaultConstant.getField('value')?.toIntValue();
  if (legacy != null) {
    final masked = legacy & 0xFFFFFFFF;
    return '0x${masked.toRadixString(16).toUpperCase().padLeft(8, '0')}';
  }

  final a = defaultConstant.getField('a')?.toDoubleValue();
  final r = defaultConstant.getField('r')?.toDoubleValue();
  final g = defaultConstant.getField('g')?.toDoubleValue();
  final b = defaultConstant.getField('b')?.toDoubleValue();
  if (a == null || r == null || g == null || b == null) return fallback;
  int toByte(double c) {
    final n = (c * 255.0).round();
    if (n < 0) return 0;
    if (n > 255) return 255;
    return n;
  }
  final argb = (toByte(a) << 24) |
      (toByte(r) << 16) |
      (toByte(g) << 8) |
      toByte(b);
  return '0x${argb.toRadixString(16).toUpperCase().padLeft(8, '0')}';
}
