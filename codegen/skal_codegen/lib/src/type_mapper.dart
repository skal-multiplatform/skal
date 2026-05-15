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
//   Primitives
//     String        → getCustomPropStr(name) ?? '<default>'
//     int           → getCustomPropU32(name, <default>)
//     double        → getCustomPropF32(name, <default>)
//     bool          → getCustomPropU32(name, 0) != 0
//
//   Enum-like
//     <enum>        → <EnumType>.values[getCustomPropU32(name, <idx>)]
//     Color         → Color(getCustomPropU32(name, 0xAARRGGBB))
//     Duration      → Duration(milliseconds: getCustomPropU32(name, <ms>))
//
//   Multi-prop value types (encoded as <paramName><suffix> sub-props)
//     EdgeInsets    → fromLTRB(4 f32 reads: paddingLeft/Top/Right/Bottom)
//     Offset        → Offset(dx, dy) from <name>X / <name>Y f32 reads
//     Alignment     → Alignment(x, y) from <name>X / <name>Y f32 reads
//     BorderRadius  → BorderRadius.all(Radius.circular(<name>))
//                                    [single f32, uniform corner radius]
//     TextStyle     → fontSize / color / fontWeight / letterSpacing /
//                     height from <name>FontSize / <name>Color / …
//     BoxDecoration → color + uniform borderRadius
//     ImageProvider → string-coercion: <name>="http://..." | "file://..."
//                     | "..." → NetworkImage | FileImage | AssetImage
//
//   Composite value types (JSON-object JSX prop)
//     Gradient      → _skalParseGradient(jsonDecode(<name>))
//                     [Linear/Radial/Sweep; full alignment + color stops]
//
//   Widget composition
//     Widget        → SkalNode(nodeId: <first JSX child>) — renders the
//                     FIRST child node from JSX
//     List<Widget>  → List.generate(n.childCount, (i) => SkalNode(...))
//                     — EVERY JSX child becomes one element
//
//   Callbacks
//     VoidCallback        → () => bridge.dispatchEvent(<handlerId>)
//     ValueChanged<int>   → (v) => bridge.dispatchEventInt(<id>, v)
//     ValueChanged<double>→ (v) => bridge.dispatchEventDouble(<id>, v)
//     ValueChanged<bool>  → (v) => bridge.dispatchEventBool(<id>, v)
//     ValueChanged<String>→ (v) => bridge.dispatchEventString(<id>, v)
//     void Function(A, B) → multi-arg via EVENT_ARG_TUPLE
//
// Anything else → null (caller skips the whole widget with a warning —
// fall back to a hand-written adapter, or use the host pattern for
// controller-driven widgets). Each new type is a ~30 min branch here.

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

  // double / double?
  //
  // For a NULLABLE `double?` param, a missing JSX prop must read as
  // `null`, NOT a coerced 0.0 — the wrapped widget may treat the two
  // distinctly. flutter_map's `TileLayer.tileSize` (`double?`,
  // defaults to null) is the motivating bug: passing 0.0 instead of
  // null makes flutter_map compute `tileDimension = 0` and divide by
  // it → Infinity. The String encoder above already does this
  // null-passthrough; numeric encoders must match.
  if (_isCoreDouble(type)) {
    if (typeName.endsWith('?')) {
      return PropEncoding(
        readerExpression: "n.getCustomPropF32OrNull('$paramName')",
        dartTypeName: typeName,
      );
    }
    final fallback = defaultLiteral ?? '0.0';
    return PropEncoding(
      readerExpression: "n.getCustomPropF32('$paramName', $fallback)",
      dartTypeName: typeName,
    );
  }

  // int / int?
  if (_isCoreInt(type)) {
    if (typeName.endsWith('?')) {
      return PropEncoding(
        readerExpression: "n.getCustomPropU32OrNull('$paramName')",
        dartTypeName: typeName,
      );
    }
    final fallback = defaultLiteral ?? '0';
    return PropEncoding(
      readerExpression: "n.getCustomPropU32('$paramName', $fallback)",
      dartTypeName: typeName,
    );
  }

  // bool / bool? — encoded as u32 0/1 on the wire. The default for the
  // getCustomPropU32 call uses the boolean's int equivalent (1 or 0);
  // the != 0 check rebuilds the bool at the call site. Nullable
  // `bool?` routes through getCustomPropBoolOrNull (null when unset).
  if (_isCoreBool(type)) {
    if (typeName.endsWith('?')) {
      return PropEncoding(
        readerExpression: "n.getCustomPropBoolOrNull('$paramName')",
        dartTypeName: typeName,
      );
    }
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
    // Nullable `EnumType?` — a missing JSX prop reads as `null`, not
    // `values[defaultIndex]`. Same nullable-coercion gap the numeric
    // + Color encoders had; the IIFE reads the U32 slot once and maps
    // null → null.
    if (typeName.endsWith('?')) {
      return PropEncoding(
        readerExpression:
            "(() { final i = n.getCustomPropU32OrNull('$paramName'); "
            "return i == null ? null : $cleanTypeName.values[i]; })()",
        dartTypeName: typeName,
      );
    }
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
    // Nullable `Duration?` — a missing JSX prop reads as `null`, not
    // `Duration(milliseconds: 0)`. Same nullable-coercion gap as the
    // numeric / Color / enum encoders.
    if (typeName.endsWith('?')) {
      return PropEncoding(
        readerExpression:
            "(() { final ms = n.getCustomPropU32OrNull('$paramName'); "
            "return ms == null ? null : Duration(milliseconds: ms); })()",
        dartTypeName: typeName,
      );
    }
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
    // Side-name suffixes joined to a param name. For a param named
    // `padding`, JSX writes `paddingLeft={…} paddingTop={…}` etc.
    final leftProp = '${paramName}Left';
    final topProp = '${paramName}Top';
    final rightProp = '${paramName}Right';
    final bottomProp = '${paramName}Bottom';
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
  // Empty-string handling depends on the param's nullability:
  //   nullable     `ImageProvider?` → returns null
  //   non-nullable `ImageProvider`  → returns AssetImage('') and lets
  //                                   Flutter surface its standard
  //                                   "asset not found" warning at
  //                                   runtime (more useful than a
  //                                   silent placeholder).
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
    // Nullable `Color?` — a missing JSX prop must read as `null`, not
    // a coerced `Color(...)`. Many widgets treat `color: null` as
    // "inherit / use theme default" distinctly from an explicit
    // opaque color. Same nullable-coercion gap the numeric encoders
    // had; the IIFE reads the U32 slot once and maps null → null.
    if (typeName.endsWith('?')) {
      return PropEncoding(
        readerExpression:
            "(() { final v = n.getCustomPropU32OrNull('$paramName'); "
            "return v == null ? null : Color(v); })()",
        dartTypeName: typeName,
      );
    }
    final fallbackU32 = _colorDefaultAsU32(defaultConstant);
    return PropEncoding(
      readerExpression:
          "Color(n.getCustomPropU32('$paramName', $fallbackU32))",
      dartTypeName: typeName,
    );
  }

  // Generic value-class encoder — last-resort match before giving up.
  //
  // Many third-party packages expose plain Dart data classes as
  // constructor params (flutter_map's MapOptions, LatLng, LatLngBounds;
  // syncfusion's series-config objects; etc.). They're not Widgets,
  // they don't hold runtime state, and their constructor params are
  // recursively encodable. The hand-coded branches above (Color,
  // Duration, TextStyle, BoxDecoration, Gradient, …) are special cases
  // of this same pattern; this branch generalizes the algorithm.
  //
  // Algorithm: walk the type's constructor params, recursively emit a
  // JSON reader per param type. The reader is a top-level helper named
  // `_skalParseT(Object? raw)` that handles BOTH the top-level
  // String-from-prop case AND the nested Object-from-parent-JSON case
  // (the inner `if (raw is String)` branches on which one it is).
  //
  // Bounded by:
  //   • A depth limit ([_kValueClassMaxDepth]) so a pathological type
  //     graph can't blow the codegen stack.
  //   • A cycle-detection Set keyed by element identity — if T's
  //     constructor reaches T again transitively, we bail with a
  //     skip rather than infinite-recurse.
  //   • A denylist of known stateful types ([_isStatefulTypeDenied])
  //     — controllers, plugin-channel-backed classes — which look
  //     structurally like value classes but aren't.
  //   • Method/field heuristics ([_looksStateful]) — anything with a
  //     `dispose()` method, ChangeNotifier mixin, etc.
  //
  // What stays NOT handled here (deferred to Phase 2/3):
  //   • Abstract / sealed types with multiple concrete subclasses —
  //     would need discriminator inference. Gradient's hand-coded
  //     branch above is the current shape.
  //   • `List<ValueClass>` — needs an elementwise recursion shape.
  //     Phase 3.
  final valueClassEnc = _tryValueClassEncoding(
    type: type,
    paramName: paramName,
    defaultLiteral: defaultLiteral,
  );
  if (valueClassEnc != null) return valueClassEnc;

  // Unsupported (yet). Caller decides: skip the widget with a warning,
  // or fall through to a hand-written adapter slot.
  return null;
}

// ── Generic value-class encoder ─────────────────────────────────────

/// Cap the depth of the value-class recursion. A constructor parameter
/// whose own constructor params are themselves value classes counts
/// one level deeper. 8 is generous — real type graphs (MapOptions →
/// LatLng/InteractionOptions/CameraConstraint → primitives) reach 2-3.
const int _kValueClassMaxDepth = 8;

/// Class names we explicitly reject from the value-class auto-encoder
/// even though they're structurally constructor-driven. These are
/// either controller classes (mutable state, plugin channels) or
/// types where reconstruction-from-JSON breaks the widget's contract.
/// Each entry must be matched by a `_looksStateful` heuristic too
/// when possible; this denylist is just a fast path + a guarantee for
/// well-known cases the heuristic might miss.
const Set<String> _kStatefulDenylist = {
  'MapController',
  'AnimationController',
  'TextEditingController',
  'ScrollController',
  'PageController',
  'TabController',
  'CameraController',
  'VideoPlayerController',
  'TransformationController',
  'OverlayPortalController',
  'WebViewController',
  // Stream / Future / Completer — control flow, not data.
  'Stream', 'StreamController', 'StreamSubscription',
  'Future', 'FutureOr', 'Completer',
  // Subscription handles that wrap a listener.
  'Listenable', 'ValueListenable', 'ChangeNotifier', 'ValueNotifier',
};

/// Mixin / supertype names that signal "this class is stateful and
/// shouldn't be reconstructed from JSON each render."
const Set<String> _kStatefulMixinNames = {
  'ChangeNotifier',
  'TickerProvider',
  'TickerProviderStateMixin',
  'SingleTickerProviderStateMixin',
  'Listenable',
  'ValueListenable',
};

/// Try to build a top-level helper that decodes [type] from a JSON-
/// shaped value (String OR Map). Returns the resulting [PropEncoding]
/// (which references the helper) or null if [type] isn't a viable
/// value class.
PropEncoding? _tryValueClassEncoding({
  required DartType type,
  required String paramName,
  required String? defaultLiteral,
}) {
  final typeName = type.getDisplayString();
  final isNullable = typeName.endsWith('?');

  // Build (and dedup) helpers for this type + every value class it
  // references transitively. Helpers map is shared across the
  // recursion so a type referenced from multiple places emits once.
  // [imports] collects package URIs for every type the helper chain
  // references — LatLng might live in a different pub package than
  // its parent value class (latlong2 vs flutter_map, for instance),
  // and the generated file needs all of them in scope.
  final helpers = <String, String>{};
  final visiting = <int>{};
  final imports = <String>{'dart:convert'};
  final helperName = _buildValueClassHelper(
    type: type,
    helpers: helpers,
    visiting: visiting,
    imports: imports,
    depth: 0,
  );
  if (helperName == null) return null;

  // Reader expression. For nullable params, missing prop → null
  // assigns cleanly. For non-nullable, missing prop → either the
  // declared default literal (if any) or a runtime crash via `!`.
  //
  // The Gradient encoder uses a similar pattern; mirror its shape for
  // consistency.
  final String reader;
  if (isNullable) {
    reader = "$helperName(n.getCustomPropStr('$paramName'))";
  } else if (defaultLiteral != null) {
    reader = "($helperName(n.getCustomPropStr('$paramName')) ?? "
        "$defaultLiteral)";
  } else {
    // No default + non-nullable. Mark with `!` so the developer's
    // failure mode is a clear NPE pointing at the prop rather than
    // a constructor with all-null args.
    reader = "$helperName(n.getCustomPropStr('$paramName'))!";
  }

  return PropEncoding(
    readerExpression: reader,
    dartTypeName: typeName,
    requiredImports: imports.toList(),
    requiredHelpers: helpers,
  );
}

/// Build (and register in [helpers]) a parser helper for [type], plus
/// any nested helpers it references. Returns the helper function name
/// — e.g. `_skalParseMapOptions` for `MapOptions`. Returns null if
/// [type] isn't a viable value class at this point in the recursion.
/// Side-effect: adds the canonical `package:` import for [type] (and
/// every referenced type, transitively) to [imports].
String? _buildValueClassHelper({
  required DartType type,
  required Map<String, String> helpers,
  required Set<int> visiting,
  required Set<String> imports,
  required int depth,
}) {
  if (depth > _kValueClassMaxDepth) return null;

  final el = type.element3;
  if (el is! ClassElement2) return null;
  final className = el.name3;
  if (className == null || className.isEmpty) return null;

  // Eligibility heuristics — fast-rejects first.
  if (el.isAbstract) return null;
  if (_kStatefulDenylist.contains(className)) return null;
  // Widget subclasses are NOT value classes — they're UI nodes. A
  // constructor param typed as a narrow Widget subtype (e.g.
  // `Text source` on flutter_map's SimpleAttributionWidget) must go
  // through the SkalNode child mechanism, not get JSON-reconstructed
  // here. Without this guard the encoder happily emits a
  // `_skalParseText` that rebuilds a Text widget from a JSON prop —
  // it compiles, but bypasses the bridge's node model and is
  // inconsistent with how every other widget child is handled. Let
  // such params fall through to the unsupported-type skip instead.
  if (_extendsWidgetTransitively(el)) return null;
  if (_looksStateful(el)) return null;

  // Cycle detection. We key by identityHashCode so mutually recursive
  // types (A → B → A) bail rather than infinite-loop. Same primitive
  // the duplicate-emission dedup uses up in generate().
  final id = identityHashCode(el);
  if (!visiting.add(id)) return null;

  try {
    final helperName = '_skalParse$className';
    if (helpers.containsKey(helperName)) {
      // Already emitted; the import is presumed already tracked too.
      _addCanonicalImport(el, imports);
      return helperName;
    }
    _addCanonicalImport(el, imports);

    // Pick a constructor: prefer the default unnamed ctor, fall back
    // to the first non-redirecting public named ctor. Reject pure-
    // factory-only classes (factory ctors often imply hidden state).
    final ctor = _pickValueClassCtor(el);
    if (ctor == null) return null;

    // For each ctor param, emit an expression that reconstructs that
    // param from the parent JSON map's same-named field. Encoding
    // failure on an OPTIONAL param (has a source-level default or is
    // a non-required named param) → silently skip that field; the
    // constructor takes its declared default. Encoding failure on a
    // REQUIRED param → abort the whole helper (we can't construct a
    // partial T). This matches how the top-level widget walk handles
    // unsupported params: skip with a warning for required, omit
    // silently for optional.
    final fieldExprs = <String>[];
    for (final param in ctor.formalParameters) {
      final name = param.name3;
      if (name == null || name.isEmpty) return null;
      final reader = _emitJsonReaderForField(
        type: param.type,
        jsonExpr: "j['$name']",
        helpers: helpers,
        visiting: visiting,
        imports: imports,
        depth: depth + 1,
      );
      if (reader == null) {
        final isRequired = param.isRequiredNamed || param.isRequiredPositional;
        if (isRequired) return null;
        // Optional param the encoder can't handle (callbacks, abstract
        // base classes, etc.) — skip. The constructor uses its source
        // default. flutter_map's MapOptions has ~15 callback fields
        // like `onTap`, `onMapEvent`; those stay unset rather than
        // blocking the entire MapOptions helper.
        continue;
      }
      // The reader expression is always nullable (returns null on
      // missing/wrong-shape JSON). For non-nullable constructor params,
      // we need a non-null fallback: prefer the source-level default
      // expression (so `MapInit(initialZoom: 13.0)` round-trips correctly);
      // otherwise synthesize a type-shaped zero (0.0, 0, '', false) so
      // the generated code at least compiles. As a last resort fall
      // back to a `!` non-null assertion — the JSX consumer must then
      // supply the field, or a clear runtime NPE points at it.
      final paramDefault = param.defaultValueCode;
      final paramTypeName = param.type.getDisplayString();
      final isParamNullable = paramTypeName.endsWith('?');
      String coerced;
      if (isParamNullable) {
        // Nullable param: pass nullable reader through unchanged.
        // Explicit null in JSON or missing field both → null, which
        // is what the dev's API contract expects.
        coerced = reader;
      } else if (paramDefault != null) {
        coerced = '$reader ?? $paramDefault';
      } else {
        // Non-nullable, no default. Synthesize a zero-value fallback
        // for the primitive types so the generated code compiles; the
        // dev still sees the WRONG behavior at runtime if they forget
        // to pass the field. For value-class or other types we use
        // `!` since there's no safe zero to synthesize.
        final zero = _zeroValueForType(param.type);
        coerced = zero != null ? '$reader ?? $zero' : '$reader!';
      }
      final fieldExpr = param.isPositional ? coerced : '$name: $coerced';
      fieldExprs.add('    $fieldExpr,');
    }

    // Build the constructor invocation. Default ctor → `Foo(...)`,
    // named ctor → `Foo.bar(...)`. (Picking a named ctor over the
    // default is uncommon but flutter_map's LatLngBounds is one such
    // case — its default ctor is a `factory` we reject, leaving the
    // `.unsafe` named ctor as the first viable choice.)
    final ctorName = ctor.name3 ?? '';
    final ctorInvocation =
        (ctorName.isEmpty || ctorName == 'new') ? className : '$className.$ctorName';

    // Register the shared "is this a JSON object or a JSON string we
    // need to decode" helper. Every value-class helper delegates to it
    // so the per-class body stays a one-liner. Saves ~10 lines per
    // helper at scale (the flutter_map run emits ~10 value-class
    // helpers — about 100 lines of boilerplate condensed to 1).
    helpers['_skalDecodeMap'] = _decodeMapHelperSource;

    final body = StringBuffer()
      ..writeln('$className? $helperName(Object? raw) {')
      ..writeln('  final j = _skalDecodeMap(raw);')
      ..writeln('  if (j == null) return null;')
      ..writeln('  return $ctorInvocation(')
      ..writeAll(fieldExprs.map((l) => '$l\n'))
      ..writeln('  );')
      ..write('}');
    helpers[helperName] = body.toString();
    return helperName;
  } finally {
    visiting.remove(id);
  }
}

/// Emit a Dart expression that decodes [type] from [jsonExpr] (a Dart
/// expression of static type `Object?` — typically `j['fieldName']`).
/// Returns null if the type isn't decodable from JSON. Side-effect:
/// any type referenced (enum class, nested value class) gets its
/// canonical `package:` import added to [imports].
String? _emitJsonReaderForField({
  required DartType type,
  required String jsonExpr,
  required Map<String, String> helpers,
  required Set<int> visiting,
  required Set<String> imports,
  required int depth,
}) {
  if (depth > _kValueClassMaxDepth) return null;

  // Primitives that jsonDecode produces directly.
  if (_isCoreString(type)) {
    return '($jsonExpr) as String?';
  }
  if (_isCoreDouble(type)) {
    return '(($jsonExpr) as num?)?.toDouble()';
  }
  if (_isCoreInt(type)) {
    return '(($jsonExpr) as num?)?.toInt()';
  }
  if (_isCoreBool(type)) {
    return '($jsonExpr) as bool?';
  }
  // Color: int-as-ARGB or '#RRGGBB[AA]' string. The Gradient helpers
  // already cover this exactly — reuse _skalParseColor and pull in
  // its source via [helpers]. _skalParseColor itself is non-nullable
  // (falls through to opaque black on garbage input — correct for
  // gradient color arrays where missing entries don't make sense);
  // wrap with a null-guard here so a missing/null field in the
  // parent JSON propagates as null up the recursion chain instead
  // of becoming an unintended opaque-black.
  if (_isFlutterColor(type)) {
    helpers['_skalParseColor'] = _gradientColorHelperSource;
    return '(($jsonExpr) == null ? null : _skalParseColor($jsonExpr))';
  }
  // Duration: milliseconds int. Use a helper so the result is nullable
  // (Duration?) — the outer-level fallback chain (`?? const Duration(…)`
  // for non-nullable fields with a source default) only works if the
  // reader CAN be null. Inlining the conditional here keeps the call
  // site readable.
  if (_isDuration(type)) {
    helpers['_skalParseDuration'] = '''
Duration? _skalParseDuration(Object? raw) {
  if (raw is! num) return null;
  return Duration(milliseconds: raw.toInt());
}''';
    return '_skalParseDuration($jsonExpr)';
  }
  // Enum by name OR by index. Emit an inline switch on `.name`,
  // fall back to `values[index]` if the JSON has an int.
  if (_isEnum(type)) {
    final el = type.element3;
    if (el is EnumElement2) {
      final enumName = el.name3 ?? '';
      _addCanonicalImport(el, imports);
      // Build a tiny per-enum decoder. Keys: 'EnumX' → byName lookup.
      final helperName = '_skalParseEnum$enumName';
      if (!helpers.containsKey(helperName)) {
        final cases = <String>[];
        for (final v in el.constants2) {
          final n = v.name3;
          if (n == null) continue;
          cases.add("    case '$n': return $enumName.$n;");
        }
        helpers[helperName] = '$enumName? $helperName(Object? raw) {\n'
            '  if (raw is int) {\n'
            '    if (raw < 0 || raw >= $enumName.values.length) return null;\n'
            '    return $enumName.values[raw];\n'
            '  }\n'
            '  if (raw is String) {\n'
            '    switch (raw) {\n'
            '${cases.join("\n")}\n'
            '    }\n'
            '  }\n'
            '  return null;\n'
            '}';
      }
      return '$helperName($jsonExpr)';
    }
  }
  // Offset { dx, dy }
  if (_isFlutterOffset(type)) {
    helpers['_skalParseOffset'] = '''
Offset? _skalParseOffset(Object? raw) {
  if (raw is List && raw.length == 2) {
    return Offset((raw[0] as num).toDouble(), (raw[1] as num).toDouble());
  }
  if (raw is Map<String, dynamic>) {
    final dx = (raw['dx'] as num?)?.toDouble() ?? 0.0;
    final dy = (raw['dy'] as num?)?.toDouble() ?? 0.0;
    return Offset(dx, dy);
  }
  return null;
}''';
    return '_skalParseOffset($jsonExpr)';
  }
  // Alignment — reuse the Gradient helper. Same null-guard rationale
  // as Color: the Gradient version is non-nullable (defaults to
  // Alignment.center), so we have to short-circuit explicitly when the
  // parent JSON omits the field.
  if (_isFlutterAlignment(type)) {
    helpers['_skalParseAlignment'] = _gradientAlignmentHelperSource;
    return '(($jsonExpr) == null ? null : _skalParseAlignment($jsonExpr))';
  }
  // Recurse: nested value class.
  final nestedHelper = _buildValueClassHelper(
    type: type,
    helpers: helpers,
    visiting: visiting,
    imports: imports,
    depth: depth,
  );
  if (nestedHelper != null) {
    return '$nestedHelper($jsonExpr)';
  }
  return null;
}

/// Add the import URI for [el]'s declaring library to [imports].
///
/// Only `package:` URIs are added. For nested value-class references
/// (LatLng in latlong2, the various Map* config types in flutter_map
/// subdirs) we use the library's ACTUAL `package:` URI — even if it
/// points at an `src/...dart` internal path — rather than the
/// `package:<pkg>/<pkg>.dart` canonical-entry-point heuristic. Reason:
/// not every package's entry-point file is named after the package
/// (latlong2 exports via `package:latlong2/latlong.dart`, not
/// `latlong2.dart` — note the missing `2`). The actual library URI
/// is correct for every case.
///
/// `dart:` URIs are skipped (already in scope implicitly).
///
/// Non-package, non-dart URIs (`file://...`, in-project relative
/// paths) are skipped TOO — those come from the consumer's own
/// source tree, which the generator already imports through its
/// `sourceRelativeImports` machinery per top-level walked unit. We
/// can't predict the right relative path from the encoder; the unit
/// walk already handled it.
void _addCanonicalImport(Element2 el, Set<String> imports) {
  final lib = el.library2;
  if (lib == null) return;
  final uri = lib.uri;
  if (uri.scheme != 'package') return;
  imports.add(uri.toString());
}

/// Pick a constructor we can call with all named/positional args derived
/// from JSON. Prefer the default (unnamed) constructor; fall back to the
/// first public, non-factory, non-redirecting named constructor. Reject
/// classes with NO suitable ctor.
ConstructorElement2? _pickValueClassCtor(ClassElement2 cls) {
  ConstructorElement2? best;
  for (final c in cls.constructors2) {
    final name = c.name3 ?? '';
    if (name.startsWith('_')) continue;          // private
    if (c.isFactory) continue;                   // factory hides state
    if (c.redirectedConstructor2 != null) continue;
    // Prefer the default (unnamed → name is 'new' in the new model).
    if (name == 'new' || name.isEmpty) return c;
    best ??= c;
  }
  return best;
}

/// True if [cls] is `Widget` or transitively extends it. Used to keep
/// the value-class encoder from JSON-reconstructing UI nodes — those
/// belong to the SkalNode child path. Distinct from [_isFlutterWidget],
/// which strict-matches only the four top-level abstract Widget types
/// (for the "render a child here" encoding); this one walks the whole
/// supertype chain so narrow subclasses (`Text`, `Container`, package-
/// defined widgets) are caught too.
bool _extendsWidgetTransitively(ClassElement2 cls) {
  if (cls.name3 == 'Widget') return true;
  var sup = cls.supertype;
  while (sup != null) {
    if (sup.element3.name3 == 'Widget') return true;
    sup = sup.element3.supertype;
  }
  return false;
}

/// Return a Dart source literal that's a valid non-null value of [t],
/// for use as a last-resort fallback when a constructor param is
/// non-nullable, has no source-level default, AND the JSON didn't
/// supply it. Returns null if there's no obvious zero value (e.g.
/// for a custom class — `!` is the only fallback in that case).
String? _zeroValueForType(DartType t) {
  if (_isCoreDouble(t)) return '0.0';
  if (_isCoreInt(t)) return '0';
  if (_isCoreBool(t)) return 'false';
  if (_isCoreString(t)) return "''";
  return null;
}

/// Structural check for "this class has runtime state we shouldn't
/// reconstruct from JSON." False here doesn't mean "definitely a value
/// class" — it just means "no obvious red flag." The denylist above
/// handles known-bad cases the heuristic might miss.
bool _looksStateful(ClassElement2 cls) {
  // dispose() method → almost always resource-management.
  for (final m in cls.methods2) {
    if (m.name3 == 'dispose') return true;
  }
  // Mixin or supertype names that signal stateful behavior.
  for (final mx in cls.mixins) {
    if (_kStatefulMixinNames.contains(mx.element3.name3)) return true;
  }
  var sup = cls.supertype;
  while (sup != null) {
    final n = sup.element3.name3;
    if (_kStatefulMixinNames.contains(n)) return true;
    sup = sup.element3.supertype;
  }
  // Walk the instance fields looking for signals of mutable state.
  for (final f in cls.fields2) {
    if (f.isStatic) continue;
    // Skip SYNTHETIC fields — these are the analyzer's induced
    // backing entries for explicit getters/setters (`int get hashCode`,
    // `bool get isEmpty`, etc.), not real stored state. They report
    // `isFinal == false`, so without this skip ANY value class that
    // overrides `==`/`hashCode` or exposes a computed getter — which
    // is most well-written value classes — gets wrongly flagged
    // stateful and rejected. Real declared fields (`final double x`
    // or the mutable `double x`) are NOT synthetic and still checked.
    if (f.isSynthetic) continue;
    final ft = f.type;
    final n = ft.element3?.name3;
    // Stream/Future/StreamController fields → definitely not a value
    // class.
    if (n == 'Stream' || n == 'Future' || n == 'StreamController') {
      return true;
    }
    // NON-FINAL instance fields → mutable state. flutter_map's
    // LatLngBounds is the motivating case: `double north;` (not
    // final) means the class is intended to be mutated post-
    // construction. Reconstructing it from JSON each render loses
    // any mutations the dev applied. Skip these and let the dev
    // wrap manually (or via the host pattern if they need lifecycle).
    // (`late final` and `late` non-final follow the same rule —
    // `late` without `final` is mutable too.)
    if (!f.isFinal) return true;
  }
  return false;
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

/// Match Flutter's `Widget` (or its top-level abstract subclasses:
/// StatelessWidget, StatefulWidget, PreferredSizeWidget) used as
/// type annotations. Returns false for NARROWER widget subclasses
/// (e.g. `Text source`, `List<SourceAttribution> attributions`,
/// `BaseOverlayImage`).
///
/// Why strict-match instead of walking the supertype chain: `SkalNode`
/// — the runtime cell we emit at each child slot — `extends Widget`,
/// not Text / Container / SourceAttribution / etc. Assigning SkalNode
/// to a `Text source` param is a static type error. So if the widget's
/// API asks for a specific Widget subtype, the codegen can't satisfy it
/// with SkalNode + JSX children, and we'd rather fall through to the
/// "unsupported type → skip with a clear message" branch than emit
/// code that doesn't compile. The dev wraps that param manually via the
/// host pattern (or sees the skip and chooses to use a hand-written
/// adapter for the surrounding widget).
bool _isFlutterWidget(DartType t) {
  final name = t.element3?.name3;
  return name == 'Widget' ||
      name == 'StatelessWidget' ||
      name == 'StatefulWidget' ||
      name == 'PreferredSizeWidget';
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

/// Shared decode-or-pass-through helper used by every generic value-
/// class helper (`_skalParseT(...)`). Accepts an already-decoded
/// `Map<String, dynamic>`, OR a JSON string that we decode here,
/// OR any other shape → returns null. Centralizing this saves ~10
/// lines of boilerplate per value-class helper.
const String _decodeMapHelperSource = '''
Map<String, dynamic>? _skalDecodeMap(Object? raw) {
  if (raw == null) return null;
  if (raw is Map<String, dynamic>) return raw;
  if (raw is String) {
    if (raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
    } catch (_) {}
  }
  return null;
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
