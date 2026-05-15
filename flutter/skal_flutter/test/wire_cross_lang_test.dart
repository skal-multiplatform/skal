// Cross-language wire-constant test — parses wire.dart AND
// js-app/src/bridge.js side by side and asserts every SHARED
// constant (opcodes, widget types, prop keys, event kinds,
// event-arg types, alignment enum, width/height sentinels) holds
// the SAME value on both sides.
//
// `wire_test.dart` snapshots the Dart values; this test catches the
// other half of the footgun TODO.md flags — "added a constant on
// one side, forgot the other", or changed a value on one side only.
// Either is silent at runtime: ops decode to the wrong widget type,
// props land on the wrong key, no error is thrown.
//
// Header byte-offsets and buffer-layout sizes are intentionally NOT
// cross-checked: bridge.js stores some header fields pre-divided as
// u32 indices (`H_OP_WRITE_POS = HB_OP_WRITE_POS >> 2`), so a naive
// name match would false-positive. `wire_test.dart` guards those on
// the Dart side, and the buffer layout rarely changes.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('wire constants — cross-language (wire.dart ↔ bridge.js)', () {
    // Tests run with the package root as CWD.
    final wireFile = File('lib/skal/wire.dart');
    final bridgeFile = File('../../js-app/src/bridge.js');

    test('source files are present', () {
      expect(wireFile.existsSync(), isTrue,
          reason: 'expected lib/skal/wire.dart relative to the package root');
      expect(bridgeFile.existsSync(), isTrue,
          reason: 'expected ../../js-app/src/bridge.js relative to the '
              'package root');
    });

    test('every shared wire constant agrees', () {
      final dart = _parseDart(wireFile.readAsStringSync());
      final js = _parseJs(bridgeFile.readAsStringSync());

      // Re-key the Dart constants under JS naming so the two maps
      // share a key space (`opCreateNode` → `OP_CREATE_NODE`).
      final dartByJsName = <String, int>{};
      dart.forEach((name, value) {
        if (_isDartCrossChecked(name)) dartByJsName[_dartToJs(name)] = value;
      });
      final jsCrossChecked = <String, int>{};
      js.forEach((name, value) {
        if (_isJsCrossChecked(name)) jsCrossChecked[name] = value;
      });

      // Sanity: the parse actually found the wire vocabulary. Guards
      // against a regex or path change silently making this a no-op.
      expect(dartByJsName.length, greaterThan(40),
          reason: 'parsed too few wire constants from wire.dart — '
              'the parser or file layout changed');

      final problems = <String>[];

      // Dart → JS: shared names must agree; a Dart wire constant with
      // no JS counterpart is "added on one side, forgot the other".
      dartByJsName.forEach((jsName, dv) {
        final jv = jsCrossChecked[jsName];
        if (jv == null) {
          problems.add('wire.dart defines a constant mapping to `$jsName` '
              'but bridge.js has no matching export');
        } else if (jv != dv) {
          problems.add('`$jsName`: wire.dart=$dv  bridge.js=$jv');
        }
      });
      // JS → Dart: a JS wire constant with no Dart counterpart.
      jsCrossChecked.forEach((jsName, jv) {
        if (!dartByJsName.containsKey(jsName)) {
          problems.add('bridge.js exports `$jsName` but wire.dart has no '
              'matching constant');
        }
      });

      expect(problems, isEmpty,
          reason: 'wire-format drift between wire.dart and bridge.js:\n'
              '  ${problems.join('\n  ')}');
    });
  });
}

/// `const int <name> = <literal>;` — only entries whose value is an
/// integer literal are kept (buffer-size expressions are skipped).
Map<String, int> _parseDart(String src) {
  final out = <String, int>{};
  final re = RegExp(r'const\s+int\s+(\w+)\s*=\s*([^;]+);');
  for (final m in re.allMatches(src)) {
    final v = _parseIntLiteral(m.group(2)!);
    if (v != null) out[m.group(1)!] = v;
  }
  return out;
}

/// `export const <NAME> = <literal>;` — same literal-only rule.
Map<String, int> _parseJs(String src) {
  final out = <String, int>{};
  final re = RegExp(r'export\s+const\s+(\w+)\s*=\s*([^;]+);');
  for (final m in re.allMatches(src)) {
    final v = _parseIntLiteral(m.group(2)!);
    if (v != null) out[m.group(1)!] = v;
  }
  return out;
}

/// Parse a hex/decimal int literal, tolerating a leading `-` and a
/// trailing JS `| 0` 32-bit coercion. Returns null for anything else
/// (notably arithmetic expressions like `4 * 1024 * 1024`).
int? _parseIntLiteral(String raw) {
  var s = raw.trim();
  final pipe = s.indexOf('|'); // strip JS `| 0`
  if (pipe != -1) s = s.substring(0, pipe).trim();
  var negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.substring(1).trim();
  }
  int? v;
  if (s.startsWith('0x') || s.startsWith('0X')) {
    v = int.tryParse(s.substring(2), radix: 16);
  } else {
    v = int.tryParse(s);
  }
  if (v == null) return null;
  return negative ? -v : v;
}

// Cross-checked constants that aren't part of a prefix family: the
// width/height sentinels + the root node id (load-bearing for both
// the renderer's root creation AND the imperative dialog RPC, which
// dispatches to this id on both sides). All are `k`-prefixed in Dart
// — _dartToJs strips the `k` to reach the JS name.
const _dartExtra = {'kNoValue', 'kFillMax', 'kWrapContent', 'kRootNodeId'};
const _jsExtra = {'NO_VALUE', 'FILL_MAX', 'WRAP_CONTENT', 'ROOT_NODE_ID'};

/// True when `n` begins with `prefix` followed by an upper-case
/// letter — i.e. `prefix` is a camelCase family marker (`op`, `wt`…).
bool _startsCamel(String n, String prefix) {
  if (!n.startsWith(prefix) || n.length <= prefix.length) return false;
  final c = n[prefix.length];
  return c == c.toUpperCase() && c != c.toLowerCase();
}

/// Dart constants that have a JS twin: opcodes, widget types, prop
/// keys, event kinds, event-arg types, the alignment enum, the
/// width/height sentinels, and the root node id.
bool _isDartCrossChecked(String n) =>
    _dartExtra.contains(n) ||
    _startsCamel(n, 'op') ||
    _startsCamel(n, 'wt') ||
    _startsCamel(n, 'prop') ||
    _startsCamel(n, 'ev') ||
    _startsCamel(n, 'event') ||
    _startsCamel(n, 'align');

/// The JS-side mirror of [_isDartCrossChecked].
bool _isJsCrossChecked(String n) =>
    _jsExtra.contains(n) ||
    n.startsWith('OP_') ||
    n.startsWith('WT_') ||
    n.startsWith('PROP_') ||
    n.startsWith('EV_') ||
    n.startsWith('EVENT_ARG_') ||
    n.startsWith('ALIGN_');

/// camelCase / `kSentinel` → SCREAMING_SNAKE_CASE. `opCreateNode` →
/// `OP_CREATE_NODE`; `kNoValue` → `NO_VALUE`.
String _dartToJs(String name) {
  var n = name;
  if (_dartExtra.contains(n)) n = n.substring(1); // drop the `k`
  final sb = StringBuffer();
  for (var i = 0; i < n.length; i++) {
    final c = n[i];
    final isUpper = c == c.toUpperCase() && c != c.toLowerCase();
    if (isUpper && i > 0) sb.write('_');
    sb.write(c.toUpperCase());
  }
  return sb.toString();
}
