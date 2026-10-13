// skal_bundle.dart — put the release JS bundle where bun can import it.
//
// Skal maintains this file. While it is unchanged from a version Skal
// shipped, `skal upgrade` and `skal doctor --fix` replace it with your
// runtime's newer one. Once you edit it they leave it alone, and
// `skal doctor` says so. App-specific boot code belongs in main.dart.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

const String _kCjs = 'assets/skal-app.cjs';
const String _kJsc = 'assets/skal-app.cjs.jsc';
const String _kStamp = 'assets/skal-app.stamp';

/// Copies `skal-app.cjs` and its `skal-app.cjs.jsc` bytecode out of the
/// app's assets into [dir] when they are missing or out of date, and
/// returns the absolute path of the `.cjs`.
///
/// The copy exists because bun's module loader imports real files, and
/// Android assets live inside the APK zip. The `.jsc` has to sit next to
/// the `.cjs`: bun finds the bytecode by appending ".jsc" to the module
/// path.
///
/// It is checked on every launch because an update keeps the app's data
/// directory — `adb install -r`, `flutter run`, Play Store and App Store
/// updates, a rebuilt macOS app. Skipping the copy whenever the files
/// exist, which Skal's template did until 2026-10, runs the previous
/// version's JS forever after an update. After a Skal upgrade that old JS
/// can also fail against the new libskal: a changed bridge-buffer size
/// once made it throw `bridge buffer not available` at eval.
///
/// The check costs O(1) when nothing changed. `bun run build` writes
/// `assets/skal-app.stamp` — the sizes of the pair plus a SHA-256 of both —
/// and the copy stores the stamp beside the files, last. A relaunch loads
/// that sub-100-byte asset, reads the stored copy and stats the pair; it
/// never reads the bundle itself.
///
/// A build that shipped no stamp (an older build script, or a hand-rolled
/// one) falls back to byte-comparing the `.cjs`. That reads the whole
/// `.cjs` on every launch, and it cannot see a change to the `.jsc` alone —
/// the same JS compiled by a different bun. bun then rejects the stale
/// bytecode and parses the source instead: slower, not wrong.
///
/// [assets] defaults to [rootBundle]; tests pass their own.
Future<String> extractSkalBundle(String dir, {AssetBundle? assets}) async {
  final bundle = assets ?? rootBundle;
  final cjs = File('$dir/skal-app.cjs');
  final jsc = File('$dir/skal-app.cjs.jsc');
  final stampFile = File('$dir/skal-app.stamp');

  final stamp = await _loadStamp(bundle);
  Uint8List? cjsBytes;
  if (stamp != null) {
    if (_isExtracted(stamp, stampFile, cjs, jsc)) return cjs.path;
  } else {
    cjsBytes = await _load(bundle, _kCjs);
    if (jsc.existsSync() && _hasContents(cjs, cjsBytes)) return cjs.path;
  }

  // First launch after an install or an update. The stamp is written
  // last, so a launch killed partway leaves none that matches and the
  // next launch copies again. It is also deleted first: a copy made
  // without a stamp must not keep an older build's stamp beside it, or
  // that build's return would find it and trust the wrong files. The
  // .cjs goes after the .jsc because the no-stamp fallback trusts a
  // matching .cjs.
  //
  // Both are flushed to disk before the stamp is written. Without that, a
  // power cut can keep the new stamp and sizes while a same-size file's
  // bytes revert, and nothing would ever copy it again. The flush costs
  // only this launch, not a relaunch.
  Directory(dir).createSync(recursive: true);
  try {
    stampFile.deleteSync();
  } on FileSystemException {
    // Nothing to delete.
  }
  jsc.writeAsBytesSync(await _load(bundle, _kJsc), flush: true);
  cjs.writeAsBytesSync(cjsBytes ?? await _load(bundle, _kCjs), flush: true);
  if (stamp != null) stampFile.writeAsStringSync(stamp.text);
  return cjs.path;
}

/// The bundle's stamp: `<cjs bytes> <jsc bytes> <sha256 hex>`, written by
/// Skal's scripts/skal-bundle-stamp.js. Null when the build shipped none
/// or it does not parse — either way the caller falls back to comparing
/// bytes, which is always correct.
typedef _Stamp = ({String text, int cjsLength, int jscLength});

Future<_Stamp?> _loadStamp(AssetBundle bundle) async {
  final String text;
  try {
    text = utf8.decode(await _load(bundle, _kStamp));
  } catch (_) {
    return null; // FlutterError: the asset is not in this build.
  }
  final parts = text.trim().split(' ');
  if (parts.length != 3 || parts[2].length != 64) return null;
  final cjsLength = int.tryParse(parts[0]);
  final jscLength = int.tryParse(parts[1]);
  if (cjsLength == null || jscLength == null) return null;
  return (text: text, cjsLength: cjsLength, jscLength: jscLength);
}

/// True when [dir] already holds the pair [stamp] describes. The size
/// checks are free — they replace the existence checks — and they catch a
/// file cut short, which a matching stamp alone would not.
bool _isExtracted(_Stamp stamp, File stampFile, File cjs, File jsc) {
  try {
    return stampFile.readAsStringSync() == stamp.text &&
        cjs.lengthSync() == stamp.cjsLength &&
        jsc.lengthSync() == stamp.jscLength;
  } on FileSystemException {
    return false; // Never extracted, or a file has gone missing.
  }
}

bool _hasContents(File file, Uint8List want) {
  final Uint8List have;
  try {
    have = file.readAsBytesSync();
  } on FileSystemException {
    return false;
  }
  if (have.length != want.length) return false;
  for (var i = 0; i < want.length; i++) {
    if (have[i] != want[i]) return false;
  }
  return true;
}

// An asset can arrive as a view into a larger buffer, so honour its
// offset and length rather than taking the whole buffer.
Future<Uint8List> _load(AssetBundle bundle, String key) async {
  final data = await bundle.load(key);
  return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
}
