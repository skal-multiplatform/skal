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
//
// Anything else → null (the caller skips the whole widget with a
// warning — falls back to a hand-written adapter for the long tail).
// Later slices add EdgeInsets, Offset, etc.

import 'package:analyzer/dart/constant/value.dart';
import 'package:analyzer/dart/element/element.dart';
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

  const PropEncoding({
    required this.readerExpression,
    required this.dartTypeName,
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

  // String — getCustomPropStr returns String? so we coalesce to the
  // default. The default expression IS already a Dart string literal
  // ('Hello'), so it pastes in unchanged.
  if (_isCoreString(type)) {
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
    t.element?.name == 'String' && t.element?.library?.isDartCore == true;

bool _isCoreInt(DartType t) =>
    t.element?.name == 'int' && t.element?.library?.isDartCore == true;

bool _isCoreDouble(DartType t) =>
    t.element?.name == 'double' && t.element?.library?.isDartCore == true;

bool _isCoreBool(DartType t) =>
    t.element?.name == 'bool' && t.element?.library?.isDartCore == true;

bool _isEnum(DartType t) {
  // Analyzer represents Dart enums with EnumElement (a subtype of
  // ClassElement). Matching purely by element kind, not by name —
  // any enum type qualifies regardless of where it's declared.
  return t.element is EnumElement;
}

bool _isDuration(DartType t) =>
    t.element?.name == 'Duration' &&
    t.element?.library?.isDartCore == true;

bool _isFlutterColor(DartType t) {
  // Flutter's Color lives in `dart:ui` (re-exported by flutter/material).
  // Match by class name only: a Dart codebase rarely defines an
  // unrelated `Color`, and an ARGB-int wrap is the right encoding
  // for any class that does happen to be called Color + take a u32
  // constructor arg. This deliberate looseness also lets the test
  // suite use a self-contained fake-Flutter without a real Flutter
  // dev_dependency (see test/fixtures/_fake_flutter.dart).
  return t.element?.name == 'Color';
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
String _colorDefaultAsU32(DartObject? defaultConstant) {
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
