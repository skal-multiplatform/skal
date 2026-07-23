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
import 'package:analyzer/dart/element/nullability_suffix.dart';
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
    // The generated code names `<Enum>.values`, so the enum's library
    // has to be in scope. Widget adapters usually get it free via the
    // wrapped package's own import; a value-class builder for a type
    // from another library (dart:ui's ColorSpace) does not.
    final enumImports = <String>{};
    final enumEl = type.element3;
    if (enumEl != null) _addCanonicalImport(enumEl, enumImports);
    if (typeName.endsWith('?')) {
      return PropEncoding(
        readerExpression:
            "(() { final i = n.getCustomPropU32OrNull('$paramName'); "
            "return i == null ? null : $cleanTypeName.values[i]; })()",
        dartTypeName: typeName,
        requiredImports: enumImports.toList(),
      );
    }
    return PropEncoding(
      readerExpression:
          "$cleanTypeName.values[n.getCustomPropU32('$paramName', $defaultIndex)]",
      dartTypeName: typeName,
      requiredImports: enumImports.toList(),
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
  // renderer's _setCustomProperty (packages/skal-js/src/renderer.js) JSON-
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
    // Delegate to skal_flutter's `imageProviderFromSrc`, which knows
    // the same four-branch dispatch (http/file://asset:///bare) AND
    // does the right thing per target: native uses `FileImage` for
    // `file://` + absolute paths via `dart:io`; web silently returns
    // null for those (browsers can't open arbitrary local paths).
    // Centralizing the dispatch means generated adapters compile on
    // BOTH targets without conditional imports on the codegen side.
    //
    // Non-nullable image props get a `!` since the helper returns
    // `ImageProvider?` (null for empty src + for file paths on web).
    // Apps that need to handle missing images should type the prop
    // as `ImageProvider?` upstream.
    final isNullable = typeName.endsWith('?');
    final nullBangOrCast = isNullable ? 'as ImageProvider?' : '!';
    return PropEncoding(
      readerExpression:
          "(imageProviderFromSrc(n.getCustomPropStr('$paramName') ?? '') $nullBangOrCast)",
      dartTypeName: typeName,
      // imageProviderFromSrc is exported by skal_flutter.dart's barrel
      // (see root.dart). No dart:io needed in the generated file.
      requiredImports: const ['package:skal_flutter/skal_flutter.dart'],
    );
  }

  // VoidCallback — Flutter's typedef `void Function()`. JSX-side
  // function-valued props auto-bind via the renderer's custom-handler
  // path (see packages/skal-js/src/renderer.js's `_setCustomProperty` —
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

  // B5 — `List<ValueClass>` as CHILD NODES, not a JSON array.
  //
  // `List<Marker>` is what kills MarkerLayer, and markers are the
  // single most-used map feature. The obvious fix — one JSON array
  // prop — is an O(n) trap: add one marker and you re-encode, re-send
  // and re-parse all 1,000. The built-in ListView grew builder mode
  // precisely to kill that cost class; repeating it here would be
  // relitigating a decision the repo already made.
  //
  // Child nodes are diffed per-node by the existing tree machinery, so
  // adding a marker costs one node. Must come AFTER the value-class
  // attempt above so a plain value param isn't misread as a list.
  final listEnc = _tryValueClassListEncoding(type: type);
  if (listEnc != null) return listEnc;

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
    // No default + non-nullable. For a CONCRETE value class the `!`
    // is a sharp-but-fair contract: the JSX consumer must supply the
    // prop, and the failure names it. For an ABSTRACT type it is not —
    // the union parser deliberately returns null on a missing or
    // unrecognized `\$type`, and with no declared default to fall
    // back on, every discriminator typo would become a runtime
    // null-assertion crash deep in generated code. Refuse instead:
    // the caller skips the widget at build time with a reason naming
    // the param and type, which is what happened before B1 existed.
    final el = type.element3;
    if (el is ClassElement2 && el.isAbstract) return null;
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
  if (_kStatefulDenylist.contains(className)) return null;
  if (el.isAbstract) {
    // B1 — subtype unions. An abstract param type is not a dead end if
    // the analyzed set contains concrete subclasses the value-class
    // encoder can already build: emit a `$type`-discriminated parser
    // that dispatches to them.
    //
    // `Gradient` was this pattern hand-written for exactly one type
    // (_skalParseGradient) while `:884` rejected every other one:
    // ShapeBorder, ScrollPhysics, Decoration, TileProvider,
    // SliverGridDelegate. This is that branch, generalized.
    return _buildSubtypeUnionHelper(
      base: el,
      helpers: helpers,
      visiting: visiting,
      imports: imports,
      depth: depth,
    );
  }
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
    // _skalDecodeMap calls jsonDecode. The widget-prop caller
    // (_tryValueClassEncoding) seeds 'dart:convert' itself, but the
    // service-arg caller reaches this helper without going through
    // that path — so register the import where the dependency
    // actually is, rather than at each call site.
    imports.add('dart:convert');

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

// ── B5: lists of value classes as child nodes ───────────────────────

/// Element classes that need a `registerValue` builder emitted for
/// them, discovered while mapping `List<T>` params. Keyed by class name
/// so two widgets taking `List<Marker>` share one builder.
///
/// Same library-private-state rationale as [_subtypeUniverse]: threading
/// an accumulator through the whole encoder tree for one feature is a
/// worse trade than a variable `generate()` owns.
final Map<String, ClassElement2> _pendingValueBuilders = {};

/// Element classes requiring a `registerValue` builder from the last
/// encoding pass, in deterministic order. Consumed by `generate()`.
List<ClassElement2> takePendingValueBuilders() {
  final out = _pendingValueBuilders.values.toList()
    ..sort((a, b) => (a.name3 ?? '').compareTo(b.name3 ?? ''));
  _pendingValueBuilders.clear();
  return out;
}

/// `List<T>` where T is a mappable value class → read the parent's
/// child nodes and build one T per child.
///
/// ```jsx
/// <MarkerLayer>
///   <For each={pins()}>{(p) =>
///     <Marker point={{ latitude: p.lat, longitude: p.lng }} />
///   }</For>
/// </MarkerLayer>
/// ```
///
/// The runtime half already existed — `registerValue` /
/// `bridge.buildValue<T>` and `registry.dart`'s own doc example is
/// exactly this shape. All that was missing is codegen emitting the
/// element builder and the child-walking reader.
PropEncoding? _tryValueClassListEncoding({required DartType type}) {
  if (!type.isDartCoreList) return null;
  if (type is! InterfaceType || type.typeArguments.length != 1) return null;
  final element = type.typeArguments.first;
  final el = element.element3;
  if (el is! ClassElement2) return null;
  final name = el.name3;
  if (name == null || name.isEmpty) return null;

  // The element must be something we could build from props. Widgets
  // are excluded here because `List<Widget>` has its own (earlier)
  // encoding — these are DATA children, not UI children.
  if (el.isAbstract) return null;
  if (_extendsWidgetTransitively(el)) return null;
  if (_kStatefulDenylist.contains(name)) return null;
  // Elements that already have a dedicated scalar encoding must NOT
  // become child nodes. `List<Color>` is gradient stops — expressing
  // those as `<Color>` child elements would be absurd, and the attempt
  // emitted a `_buildValue_Color` calling `Color.from(colorSpace: …)`.
  // Child composition is for records, not for scalars.
  if (_isFlutterColor(element) ||
      _isDuration(element) ||
      _isEnum(element) ||
      _isCoreString(element) ||
      _isCoreInt(element) ||
      _isCoreDouble(element) ||
      _isCoreBool(element) ||
      _isFlutterOffset(element) ||
      _isFlutterAlignment(element) ||
      _isFlutterEdgeInsets(element) ||
      _isFlutterTextStyle(element)) {
    return null;
  }
  // NOT `_looksStateful` — deliberately. That heuristic answers "can I
  // rebuild this from a JSON blob?", and a private lazily-memoized
  // field (`LatLng? _labelPosition` behind a computed getter) makes it
  // say no. flutter_map's `Polygon` is exactly that shape, and it is a
  // perfectly ordinary value class.
  //
  // A child-node builder asks a weaker question: can I CONSTRUCT one
  // from props? Memo fields are irrelevant to that — the object is
  // built fresh through its public constructor and never round-tripped.
  // What still disqualifies a class is owning a resource, which is what
  // `dispose()` and the denylist mark.
  if (_ownsResources(el)) return null;
  if (_pickValueClassCtor(el) == null) return null;

  _pendingValueBuilders[name] = el;

  final listImports = <String>{};
  _addCanonicalImport(el, listImports);
  return PropEncoding(
    readerExpression: '_skalChildValues<$name>(n, bridge)',
    dartTypeName: type.getDisplayString(),
    requiredImports: listImports.toList(),
    requiredHelpers: const {'_skalChildValues': _childValuesHelperSource},
  );
}

/// The narrow half of [_looksStateful]: does this class own something
/// that has to be torn down?
///
/// Used by the child-node builder path, which constructs objects rather
/// than reconstructing them, so mutable or memoized FIELDS are none of
/// its business — only lifecycle is.
bool _ownsResources(ClassElement2 cls) {
  for (final m in cls.methods2) {
    if (m.name3 == 'dispose' || m.name3 == 'close') return true;
  }
  for (final mx in cls.mixins) {
    if (_kStatefulMixinNames.contains(mx.element3.name3)) return true;
  }
  var sup = cls.supertype;
  while (sup != null) {
    if (_kStatefulMixinNames.contains(sup.element3.name3)) return true;
    sup = sup.element3.supertype;
  }
  for (final f in cls.fields2) {
    if (f.isStatic || f.isSynthetic) continue;
    final n = f.type.element3?.name3;
    if (n == 'Stream' || n == 'Future' || n == 'StreamController') return true;
  }
  return false;
}

const String _childValuesHelperSource = '''
/// Collect one typed value per child node — the O(changed) shape for a
/// `List<T>` constructor param.
///
/// A child that doesn't resolve to a T is skipped rather than throwing:
/// it means the JSX nested something under a parent that only accepts
/// data children, and dropping one marker beats blanking the map.
List<T> _skalChildValues<T>(NodeState n, SkalBridge bridge) {
  final out = <T>[];
  for (final id in n.childIds) {
    final v = bridge.buildValue<T>(id);
    if (v != null) out.add(v);
  }
  return out;
}''';

// ── B1: subtype unions ──────────────────────────────────────────────

/// Classes visible to the current `generate()` call. The subtype-union
/// encoder needs to know which concrete implementations of an abstract
/// param type actually exist, and that is a property of the whole run,
/// not of any one type.
///
/// Library-private mutable state rather than a threaded parameter
/// because the encoder is a tree of top-level functions and threading
/// it would touch every one of them. `generate()` owns the lifecycle
/// and the codegen is single-threaded per invocation.
List<ClassElement2> _subtypeUniverse = const [];

/// Class-name occurrence counts over [_subtypeUniverse]. Depends only
/// on the universe, so it is computed ONCE per `generate()` run here
/// instead of being rebuilt inside every abstract-param encounter —
/// which was O(widgets × universe) of pure recomputation on packages
/// the size of flutter_map.
Map<String, int> _universeNameCounts = const {};

/// Read-only view for the generator, which needs the same set to
/// resolve `typeArgs:` names (B6).
List<ClassElement2> get subtypeUniverse => _subtypeUniverse;

/// Set the classes the subtype-union encoder may dispatch to. Called by
/// `generate()` at the start of a run; pass an empty list to disable.
void setSubtypeUniverse(List<ClassElement2> classes) {
  _subtypeUniverse = classes;
  final counts = <String, int>{};
  for (final c in classes) {
    final n = c.name3;
    if (n != null && n.isNotEmpty) counts[n] = (counts[n] ?? 0) + 1;
  }
  _universeNameCounts = counts;
}

/// Maps a package name to its canonical barrel URI
/// (`package:foo/foo.dart`) when that file exists on disk, else null.
/// Injected per run by the driver (builder/CLI), which owns the
/// package_config; reset alongside the universe.
String? Function(String packageName)? _barrelResolver;

/// Install the barrel resolver for this run (null clears it).
void setBarrelResolver(String? Function(String packageName)? resolver) {
  _barrelResolver = resolver;
}

/// Drop any element classes queued for `registerValue` emission by a
/// PREVIOUS run. `takePendingValueBuilders` clears on drain, but a run
/// that throws between registration and drain would otherwise leak its
/// pending classes — from a by-then-disposed analyzer session — into
/// the next build in the same process. Mirrors the unconditional
/// universe reset above.
void clearPendingValueBuilders() {
  _pendingValueBuilders.clear();
}

/// Above this many concrete subclasses we decline rather than emit a
/// parser nobody will read. A param typed as a broad framework base
/// (`Decoration`, `ShapeBorder`) can have dozens of implementations in
/// a large package; a 40-case dispatch is not the ergonomic win B1 is
/// after, and each case drags in its own imports.
const int _kMaxUnionSubtypes = 16;

/// Emit a `$type`-discriminated parser for an abstract [base], or null
/// when no viable concrete subtypes exist.
///
/// ```jsx
/// <Card shape={{ $type: 'RoundedRectangleBorder', radius: 8 }} />
/// ```
///
/// Discriminator policy:
///
///   • Exactly one concrete subtype → `$type` is optional. There is
///     nothing to disambiguate, so `{ radius: 8 }` is accepted as-is.
///   • More than one → `$type` is required. A missing or unrecognized
///     one returns null, which lets the parameter's own declared
///     default take over.
///
/// Returning null rather than guessing is deliberate. Picking "the
/// first subtype" on a typo'd `$type` would hand the dev a silently
/// wrong shape, and a wrong shape that renders is far harder to debug
/// than a default that renders.
String? _buildSubtypeUnionHelper({
  required ClassElement2 base,
  required Map<String, String> helpers,
  required Set<int> visiting,
  required Set<String> imports,
  required int depth,
}) {
  if (depth > _kValueClassMaxDepth) return null;
  final baseName = base.name3;
  if (baseName == null || baseName.isEmpty) return null;
  if (_extendsWidgetTransitively(base)) return null;
  if (_subtypeUniverse.isEmpty) return null;

  final helperName = '_skalParse$baseName';
  // Names the HAND-WRITTEN parsers own (`_skalParseGradient` et al.).
  // A union helper for an abstract base with the same simple name
  // would land on the same helpers-map key with an incompatible body
  // and signature — last writer wins, silently. The hand-written
  // parser always takes precedence; the union declines.
  if (_kReservedHelperNames.contains(helperName)) return null;
  if (helpers.containsKey(helperName)) {
    _addCanonicalImport(base, imports);
    return helperName;
  }

  // Skip names that more than one library in the universe declares.
  // Conditional exports produce exactly this: flutter_map ships
  // `FileTileProvider` twice (native + stub), the package barrel
  // re-exports one of them, and generated code that names it bare
  // hits `ambiguous_import`. Picking one would be a coin flip between
  // a real implementation and a throwing stub — and the discriminator
  // is a string, so it could not express the difference anyway.
  // (Counts precomputed in setSubtypeUniverse — they depend only on
  // the universe, not on this base type.)
  final concrete = <ClassElement2>[
    for (final c in _subtypeUniverse)
      if (!c.isAbstract &&
          !identical(c, base) &&
          (_universeNameCounts[c.name3] ?? 0) == 1 &&
          _isSubtypeOf(c, base) &&
          !_extendsWidgetTransitively(c) &&
          !_looksStateful(c))
        c,
  ]..sort((a, b) => (a.name3 ?? '').compareTo(b.name3 ?? ''));

  if (concrete.isEmpty || concrete.length > _kMaxUnionSubtypes) return null;

  final id = identityHashCode(base);
  if (!visiting.add(id)) return null;
  try {
    // Reserve the name before recursing — a subtype whose own ctor
    // takes the base type (a decorated border wrapping a border) would
    // otherwise recurse forever.
    helpers[helperName] = '';
    _addCanonicalImport(base, imports);

    final cases = <String>[];
    for (final c in concrete) {
      final sub = _buildValueClassHelper(
        type: c.thisType,
        helpers: helpers,
        visiting: visiting,
        imports: imports,
        depth: depth + 1,
      );
      if (sub == null) continue;
      cases.add("    case '${c.name3}':\n      return $sub(j);");
    }
    if (cases.isEmpty) {
      helpers.remove(helperName);
      return null;
    }

    helpers['_skalDecodeMap'] = _decodeMapHelperSource;
    imports.add('dart:convert');
    final b = StringBuffer()
      ..writeln('$baseName? $helperName(Object? raw) {')
      ..writeln('  final j = _skalDecodeMap(raw);')
      ..writeln('  if (j == null) return null;');
    if (cases.length == 1) {
      // Only one implementation — nothing to disambiguate, so don't
      // make the JSX side spell out a discriminator it has no choice
      // about.
      final only = cases.first.split('return ').last.replaceAll(';', '');
      b
        ..writeln('  // Single concrete subtype — no discriminator needed.')
        ..write('  return $only;');
    } else {
      b.writeln("  switch (j[r'\$type']) {");
      for (final c in cases) {
        b.writeln(c);
      }
      b
        ..writeln('  }')
        ..writeln('  // Missing or unrecognized \$type. Return null so the')
        ..writeln("  // parameter's own default applies — guessing a")
        ..writeln('  // subtype here would render the wrong thing silently.')
        ..write('  return null;');
    }
    b.write('\n}');
    helpers[helperName] = b.toString();
    return helperName;
  } finally {
    visiting.remove(id);
  }
}

/// True if [cls] transitively extends, implements, or mixes in [base].
bool _isSubtypeOf(ClassElement2 cls, ClassElement2 base) {
  for (final t in cls.allSupertypes) {
    if (identical(t.element3, base)) return true;
  }
  return false;
}

// ───────────────────────────────────────────────────────────────────────
// Service mapping (Roadmap A2) — headless static methods, not widgets
// ───────────────────────────────────────────────────────────────────────
//
// A service method is reached over the bridge as an ordinary root-node
// RPC (skal_flutter/lib/skal/services.dart). The dispatcher receives
// `List<Object?> args` already decoded by the bridge — ints, doubles,
// bools, Strings, and (since the eventArgJson case landed) real Maps
// and Lists. So the ARGUMENT direction is exactly the problem the
// value-class encoder already solves for JSON widget props, and it is
// reused verbatim here: `_emitJsonReaderForField` against `args[i]`
// instead of against a decoded prop string.
//
// The RETURN direction is new. The bridge's `_writeMethodReply` falls
// back to `jsonEncode`, which handles primitives, Maps, Lists, and any
// class with a `toJson()` — so most plugin result types need no code at
// all. What's left is classes without `toJson()`, for which we emit a
// getter-walking encoder. Anything we can't encode is skipped WITH a
// reason rather than emitted and left to throw at runtime.

/// How one service-method parameter is reconstructed from `args`.
class ServiceArgEncoding {
  /// Dart expression producing the argument value, e.g.
  /// `(( args.length > 0 ? args[0] : null) as num?)?.toDouble() ?? 0.0`.
  final String readerExpression;
  final Set<String> requiredImports;
  final Map<String, String> requiredHelpers;
  const ServiceArgEncoding(
      this.readerExpression, this.requiredImports, this.requiredHelpers);
}

/// How a service method's result is turned into something
/// `jsonEncode` can serialize.
class ServiceReturnEncoding {
  /// Applied to the raw call expression. `null` means "pass through
  /// unchanged" — the bridge already handles it.
  final String? wrapperFn;
  final Set<String> requiredImports;
  final Map<String, String> requiredHelpers;

  /// True when the encoding fell to the opaque-handle last resort —
  /// the value cannot be serialized at all and JS gets a retained
  /// reference. Callers use this to refuse shapes where per-value
  /// retention is a leak (streams).
  final bool isHandle;

  const ServiceReturnEncoding(
      this.wrapperFn, this.requiredImports, this.requiredHelpers,
      {this.isHandle = false});
}

/// Map a service-method parameter type to an expression that rebuilds
/// it from `argExpr` (the already-decoded bridge arg). Returns null if
/// the type isn't reachable from JSON — the caller skips that method
/// with a reason rather than emitting a broken dispatcher arm.
ServiceArgEncoding? serviceArgEncoding({
  required DartType type,
  required String argExpr,
  String? defaultLiteral,
}) {
  final helpers = <String, String>{};
  final imports = <String>{};
  final visiting = <int>{};

  // Enums arrive as either an index (int) or a name (String). Accept
  // both: JS-side code reads far better with `'high'` than with `2`,
  // but an index is what a naive caller sends.
  //
  // Decode policy matches the widget path and B1's no-guessing rule:
  // an unrecognized name or out-of-range index yields null, so the
  // parameter's own declared default applies. The earlier inline
  // decoder silently substituted `values.first` on a typo — a
  // wrong-but-plausible value is strictly worse to debug than the
  // declared default. Emitted as one helper per enum per file rather
  // than a re-inlined quadruple interpolation per call site.
  if (_isEnum(type)) {
    final name = type.element3?.name3;
    if (name == null) return null;
    final el = type.element3;
    if (el != null) _addCanonicalImport(el, imports);
    final helperName = '_skalEnumArg$name';
    helpers[helperName] = '$name? $helperName(Object? raw) {\n'
        '  if (raw is String) {\n'
        '    for (final e in $name.values) {\n'
        '      if (e.name == raw) return e;\n'
        '    }\n'
        '    return null;\n'
        '  }\n'
        '  if (raw is num) {\n'
        '    final i = raw.toInt();\n'
        '    if (i < 0 || i >= $name.values.length) return null;\n'
        '    return $name.values[i];\n'
        '  }\n'
        '  return null;\n'
        '}';
    final fallback = defaultLiteral ?? '$name.values.first';
    final nullable = type.nullabilitySuffix == NullabilitySuffix.question;
    final expr = nullable
        ? '$helperName($argExpr)'
        : '($helperName($argExpr) ?? $fallback)';
    return ServiceArgEncoding(expr, imports, helpers);
  }

  // Core List args decode elementwise from the JSON array the bridge
  // hands us. This must run BEFORE the handle fallback: a List is
  // never a handle, and letting it fall through there erased the type
  // argument (`skalHandleArg<List>` → List<dynamic>, which does not
  // assign to List<XFile> and broke the generated file's compile).
  if (type.isDartCoreList &&
      type is InterfaceType &&
      type.typeArguments.length == 1) {
    final elementType = type.typeArguments.first;
    final elName = elementType.element3?.name3;
    final nullable = type.nullabilitySuffix == NullabilitySuffix.question;
    String? listExpr;
    if (_isCoreString(elementType) ||
        _isCoreInt(elementType) ||
        _isCoreDouble(elementType) ||
        _isCoreBool(elementType)) {
      // Eager List<T>.from so a wrong-typed element throws a clear
      // TypeError at the call boundary, not lazily mid-plugin.
      final bare = elementType.getDisplayString().replaceAll('?', '');
      listExpr =
          '(($argExpr) is List ? List<$bare>.from(($argExpr) as List) : null)';
    } else if (elName != null) {
      final elReader = _emitJsonReaderForField(
        type: elementType,
        jsonExpr: 'e',
        helpers: helpers,
        visiting: visiting,
        imports: imports,
        depth: 0,
      );
      if (elReader != null) {
        // Per-element decode; undecodable entries drop via whereType
        // rather than nulling the whole list.
        listExpr = '(($argExpr) is List'
            ' ? [for (final e in ($argExpr) as List) $elReader]'
            '.whereType<$elName>().toList()'
            ' : null)';
      }
    }
    if (listExpr == null) return null;
    return ServiceArgEncoding(
        nullable ? listExpr : '($listExpr ?? const [])', imports, helpers);
  }

  final reader = _emitJsonReaderForField(
    type: type,
    jsonExpr: argExpr,
    helpers: helpers,
    visiting: visiting,
    imports: imports,
    depth: 0,
  );
  if (reader == null) {
    // A3, argument direction — and B3's handle half. A param typed as
    // a controller (or anything else JSON can't rebuild) accepts a
    // handle JS got from an earlier call. This is what lets
    // `camera.takePicture(cam)` exist without a bespoke host widget.
    //
    // Core collections are NEVER handles — an unmappable Map/Set/
    // Iterable arg refuses instead, so the param rules (skip required,
    // omit-and-record optional) produce a legible outcome.
    if (type.isDartCoreMap ||
        type.isDartCoreSet ||
        type.isDartCoreIterable) {
      return null;
    }
    final el = type.element3;
    if (el is ClassElement2) {
      final name = el.name3;
      if (name != null && name.isNotEmpty && !_extendsWidgetTransitively(el)) {
        _addCanonicalImport(el, imports);
        imports.add('package:skal_flutter/skal/handles.dart');
        final nullable =
            type.nullabilitySuffix == NullabilitySuffix.question;
        final call = 'skalHandleArg<$name>($argExpr)';
        return ServiceArgEncoding(
            nullable ? call : '($call)!', imports, helpers);
      }
    }
    return null;
  }

  // `_emitJsonReaderForField` is nullable by construction. A
  // non-nullable parameter needs a fallback, same ladder the value-class
  // encoder uses: source default → type-shaped zero → `!`.
  final typeName = type.getDisplayString();
  String expr;
  if (typeName.endsWith('?')) {
    expr = reader;
  } else if (defaultLiteral != null) {
    expr = '($reader ?? $defaultLiteral)';
  } else {
    final zero = _zeroValueForType(type);
    expr = zero != null ? '($reader ?? $zero)' : '($reader)!';
  }
  return ServiceArgEncoding(expr, imports, helpers);
}

/// Decide how a service method's return type reaches JS.
///
/// [type] should already be unwrapped from `Future`/`Stream` by the
/// caller — this asks only "can jsonEncode see this value?".
ServiceReturnEncoding? serviceReturnEncoding(DartType type) {
  final helpers = <String, String>{};
  final imports = <String>{};

  if (type is VoidType || type.isDartCoreNull) {
    return ServiceReturnEncoding(null, imports, helpers);
  }
  if (_isCoreString(type) ||
      _isCoreInt(type) ||
      _isCoreDouble(type) ||
      _isCoreBool(type) ||
      type.isDartCoreObject ||
      type is DynamicType) {
    return ServiceReturnEncoding(null, imports, helpers);
  }
  // Emitted lambdas spell out their parameter type and match the
  // source's nullability. Writing `(v) => v?.name` instead would be a
  // warning in the (common) non-nullable case, and generated code that
  // trips the analyzer is generated code developers learn to ignore.
  final display = type.getDisplayString();
  final q = type.nullabilitySuffix == NullabilitySuffix.question ? '?' : '';

  // Enums serialize as their name — stable across reorderings of the
  // Dart enum, which an index is not.
  if (_isEnum(type)) {
    final el = type.element3;
    if (el != null) _addCanonicalImport(el, imports);
    return ServiceReturnEncoding('($display v) => v$q.name', imports, helpers);
  }
  if (type.isDartCoreMap) {
    // Same rule as List: the VALUE type must itself be encodable, or
    // jsonEncode throws at runtime inside _writeMethodReply — an
    // opaque rejection where every other unencodable shape gets a
    // build-time skip naming the fix. Passthrough-compatible value
    // types need no wrapper; anything needing one is refused (a
    // wrapped-Map re-encoder is not worth its complexity — give the
    // value type a toJson()).
    final args =
        type is InterfaceType ? type.typeArguments : const <DartType>[];
    if (args.length == 2) {
      final inner = serviceReturnEncoding(args[1]);
      if (inner == null || inner.wrapperFn != null) return null;
    }
    return ServiceReturnEncoding(null, imports, helpers);
  }
  if (type.isDartCoreList || type.isDartCoreIterable || type.isDartCoreSet) {
    final args = type is InterfaceType ? type.typeArguments : const <DartType>[];
    if (args.isEmpty) return ServiceReturnEncoding(null, imports, helpers);
    final inner = serviceReturnEncoding(args.first);
    if (inner == null) return null;
    imports.addAll(inner.requiredImports);
    helpers.addAll(inner.requiredHelpers);
    if (inner.wrapperFn == null) {
      // A List already encodes; an Iterable/Set does not, so normalize.
      if (type.isDartCoreList && q.isEmpty) {
        return ServiceReturnEncoding(null, imports, helpers);
      }
      return ServiceReturnEncoding(
          '($display v) => v$q.toList()', imports, helpers);
    }
    return ServiceReturnEncoding(
        '($display v) => v$q.map(${inner.wrapperFn}).toList()',
        imports, helpers);
  }

  final el = type.element3;
  if (el is! ClassElement2) return null;

  // A `toJson()` means the plugin author already answered this question.
  // jsonEncode calls it automatically, so nothing to emit.
  for (final m in el.methods2) {
    if (m.name3 == 'toJson' && !m.isStatic && m.formalParameters.isEmpty) {
      return ServiceReturnEncoding(null, imports, helpers);
    }
  }

  final encoder = _buildValueEncoder(
    el: el,
    helpers: helpers,
    imports: imports,
    visiting: <int>{},
    depth: 0,
  );
  if (encoder != null) {
    return ServiceReturnEncoding(encoder, imports, helpers);
  }

  // A3 — opaque handle. Nothing about this object can be serialized,
  // which for a controller or a connection is the correct answer:
  // its identity IS the value. Hand JS a handle instead of dropping
  // the method, which is what used to happen.
  //
  // Deliberately the LAST resort. A type that can be serialized should
  // be, because a serialized value needs no lifetime management and a
  // handle does.
  imports.add('package:skal_flutter/skal/handles.dart');
  return ServiceReturnEncoding('skalHandleOf', imports, helpers,
      isHandle: true);
}

/// Emit (and register) `_skalEncode<Class>` — a Map builder over the
/// class's public, zero-arg, non-static getters. Returns the helper
/// name, or null when nothing encodable is reachable.
///
/// Only used for result types the plugin author did NOT give a
/// `toJson()`. Deliberately conservative: a getter whose own type we
/// can't encode is DROPPED rather than blocking the class, because a
/// `Position` missing its `floor` field is still useful, whereas no
/// `Position` at all is not.
String? _buildValueEncoder({
  required ClassElement2 el,
  required Map<String, String> helpers,
  required Set<String> imports,
  required Set<int> visiting,
  required int depth,
}) {
  if (depth > _kValueClassMaxDepth) return null;
  final className = el.name3;
  if (className == null || className.isEmpty) return null;
  if (_extendsWidgetTransitively(el)) return null;
  if (_kStatefulDenylist.contains(className)) return null;

  final id = identityHashCode(el);
  if (!visiting.add(id)) return null;
  try {
    final helperName = '_skalEncode$className';
    if (helpers.containsKey(helperName)) {
      _addCanonicalImport(el, imports);
      return helperName;
    }
    _addCanonicalImport(el, imports);
    // Reserve the name before recursing so a self-referential type
    // (`Foo get parent`) finds it and stops instead of looping.
    helpers[helperName] = '';

    final fields = <String>[];
    for (final g in el.getters2) {
      if (g.isStatic) continue;
      final name = g.name3;
      if (name == null || name.isEmpty || name.startsWith('_')) continue;
      if (name == 'hashCode' || name == 'runtimeType') continue;
      final rt = g.returnType;
      final nullable = rt.nullabilitySuffix == NullabilitySuffix.question;
      final access = nullable ? 'v.$name?' : 'v.$name';
      if (_isCoreString(rt) ||
          _isCoreInt(rt) ||
          _isCoreDouble(rt) ||
          _isCoreBool(rt)) {
        fields.add("      '$name': v.$name,");
      } else if (_isEnum(rt)) {
        fields.add("      '$name': $access.name,");
      } else if (_isDuration(rt)) {
        fields.add("      '$name': $access.inMilliseconds,");
      }
      // Nested objects and collections are intentionally omitted at
      // this tier — see the doc comment. A plugin type that needs them
      // should ship a toJson().
    }
    if (fields.isEmpty) {
      helpers.remove(helperName);
      return null;
    }
    final buf = StringBuffer()
      ..writeln('Object? $helperName($className? v) {')
      ..writeln('  if (v == null) return null;')
      ..writeln('  return <String, Object?>{');
    for (final f in fields) {
      buf.writeln(f);
    }
    buf
      ..writeln('  };')
      ..write('}');
    helpers[helperName] = buf.toString();
    return helperName;
  } finally {
    visiting.remove(id);
  }
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
/// Public alias so the generator's emission paths route through the
/// same canonicalization (and future normalization) as the encoders,
/// instead of re-deriving `lib.uri.scheme == 'package'` inline.
void addCanonicalImport(Element2 el, Set<String> imports) =>
    _addCanonicalImport(el, imports);

void _addCanonicalImport(Element2 el, Set<String> imports) {
  final lib = el.library2;
  if (lib == null) return;
  final chosen = canonicalImportUriFor(lib.uri, _barrelResolver);
  if (chosen != null) imports.add(chosen);
}

/// Testable core of [_addCanonicalImport]: map a declaring-library URI
/// to the URI the generated file should import (null = don't import,
/// e.g. dart: core libraries).
///
/// Conditional exports make the DECLARING library the wrong thing to
/// import: the analyzer resolves `export 'io.dart' if (...)` chains
/// to the STUB (cross_file's interface.dart), while the CFE compile
/// resolves them to the io variant — so importing the stub path
/// explicitly collides with any barrel in scope ("`XFile` is imported
/// from both …interface.dart and …io.dart"). For a class declared
/// under src/, prefer the package's canonical barrel when one exists;
/// the barrel names the conditionally-correct declaration on every
/// target. Packages whose barrel isn't `<pkg>.dart` (latlong2) fall
/// back to the actual URI, which is the pre-existing behavior.
String? canonicalImportUriFor(
    Uri uri, String? Function(String packageName)? barrelResolver) {
  if (uri.scheme != 'package') return null;
  final segments = uri.pathSegments;
  if (segments.length > 2 && segments[1] == 'src') {
    final barrel = barrelResolver?.call(segments.first);
    if (barrel != null) return barrel;
  }
  return uri.toString();
}

/// Pick a constructor we can call with all named/positional args derived
/// from JSON. Prefer the default (unnamed) constructor; fall back to the
/// first public, non-factory, non-redirecting named constructor. Reject
/// classes with NO suitable ctor.
/// Public alias for the generator's value-builder emission (B5) — the
/// SAME picker that gates B5 eligibility above, so the gate and the
/// emitter can never disagree about which constructor a class uses.
ConstructorElement2? pickValueClassCtor(ClassElement2 cls) =>
    _pickValueClassCtor(cls);

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
bool extendsWidgetTransitively(ClassElement2 cls) =>
    _extendsWidgetTransitively(cls);

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
  // Resource ownership (dispose/close, lifecycle mixins, Stream/Future
  // fields) is the shared half — one walker, so B5 eligibility and
  // JSON-reconstruction eligibility can't drift on it. What remains
  // specific to reconstruction is MUTABILITY: a class with non-final
  // fields (flutter_map's LatLngBounds: `double north;`) is intended
  // to be mutated post-construction, and rebuilding it from JSON each
  // render would silently discard those mutations. Synthetic fields
  // (backing entries for explicit getters — `int get hashCode`) are
  // skipped: they report isFinal == false but are not stored state.
  if (_ownsResources(cls)) return true;
  for (final f in cls.fields2) {
    if (f.isStatic || f.isSynthetic) continue;
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
/// Helper names owned by hand-written parser sources in this file.
/// The subtype-union generator must never claim one of these keys —
/// see the reservation check in [_buildSubtypeUnionHelper].
const Set<String> _kReservedHelperNames = {
  '_skalParseGradient',
  '_skalParseColor',
  '_skalParseAlignment',
  '_skalDecodeMap',
};

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
