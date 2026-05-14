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
// Supported types (Slice 2 MVP):
//
//   String      → getCustomPropStr(name) ?? '<default>'
//   int         → getCustomPropU32(name, <default>)
//   double      → getCustomPropF32(name, <default>)
//   bool        → getCustomPropU32(name, 0) != 0       (and ? 1 : 0 for default)
//   Color       → Color(getCustomPropU32(name, 0xAARRGGBB))
//
// Anything else → null (the caller skips the whole widget with a
// warning — falls back to a hand-written adapter for the long tail).
// Later slices add Duration, EdgeInsets, enum, Offset, etc.

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

  // Color — Flutter's `ui.Color` (or `material.Color`, same class).
  // Wire encoding is 32-bit ARGB; adapter wraps in Color(...).
  if (_isFlutterColor(type)) {
    // Default literals for Color are typically `const Color(0xAARRGGBB)`
    // or `Colors.black`. Extracting the raw u32 from those is more
    // work than it's worth — codegen emits 0xFF000000 (opaque black)
    // as a safe-everywhere fallback. Devs who want a specific default
    // can override via JSX prop or write a manual adapter.
    return PropEncoding(
      readerExpression:
          "Color(n.getCustomPropU32('$paramName', 0xFF000000))",
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
