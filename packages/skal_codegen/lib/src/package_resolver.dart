// Shared filesystem helpers — pulled out of the CLI (bin/) and the
// Builder (lib/builder.dart) so both consume the same implementation.
// Functions here are PRIVATE to the codegen package (`package:
// skal_codegen/src/...`) but exported by the package as a library, so
// both call sites can import them.
//
// Each helper is small and individually justified at its declaration.
// The reason they're shared rather than copy-pasted: prior duplicates
// drifted (the CLI version returned absolute paths, the Builder one
// returned relative paths in one early iteration), and the symptom
// was a missing-package error from the Builder while the CLI worked
// fine. Single source of truth fixes that whole failure mode.

import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

/// Resolve a Dart package name to its lib/ directory on disk, via the
/// consumer project's `.dart_tool/package_config.json`. Returns null
/// if the package isn't listed (consumer hasn't run `flutter pub get`
/// since adding it) or the config file is missing.
///
/// package_config.json format (configVersion 2):
///
/// ```json
/// {
///   "configVersion": 2,
///   "packages": [
///     {
///       "name":         "qr_flutter",
///       "rootUri":      "file:///…/.pub-cache/hosted/pub.dev/qr_flutter-4.1.0",
///       "packageUri":   "lib/",
///       "languageVersion": "2.19"
///     }
///   ]
/// }
/// ```
///
/// Resolved as `<rootUri>/<packageUri>` (file URI → filesystem path).
/// For path-style deps the rootUri may be relative; in that case we
/// resolve it against the config file's directory.
String? resolvePackageLibDir(String pkgRoot, String packageName) {
  final cfgPath = p.join(pkgRoot, '.dart_tool', 'package_config.json');
  final cfgFile = File(cfgPath);
  if (!cfgFile.existsSync()) return null;

  final Map<String, dynamic> cfg;
  try {
    cfg = jsonDecode(cfgFile.readAsStringSync()) as Map<String, dynamic>;
  } on FormatException {
    return null;
  }
  final pkgs = (cfg['packages'] as List?) ?? const [];
  for (final entry in pkgs.cast<Map<String, dynamic>>()) {
    if (entry['name'] != packageName) continue;
    final rootUri = entry['rootUri'] as String?;
    final packageUri = entry['packageUri'] as String?;
    if (rootUri == null) return null;
    // rootUri is typically an absolute `file://...` URI for pub-cache
    // packages. For path-style deps (e.g. monorepo siblings) it can
    // be a relative `../foo` URI that needs to be resolved against
    // the package_config.json's parent dir.
    final base = Uri.file(p.join(pkgRoot, '.dart_tool/'));
    final resolved = base.resolve(rootUri);
    return p.normalize(p.join(resolved.toFilePath(), packageUri ?? 'lib/'));
  }
  return null;
}

/// Recursively find all `.dart` files under [dir], excluding generated
/// (`*.g.dart`) files so a re-run doesn't re-process its own output.
/// Hidden directories (those starting with `.`, e.g. `.dart_tool`)
/// are also skipped — they hold tool caches we never want to scan.
Iterable<String> walkDartFiles(String dir) sync* {
  for (final entity
      in Directory(dir).listSync(recursive: true, followLinks: false)) {
    if (entity is! File) continue;
    final path = entity.path;
    if (!path.endsWith('.dart')) continue;
    if (path.endsWith('.g.dart')) continue;
    // Skip anything under a hidden directory at any depth.
    final segments = p.split(p.relative(path, from: dir));
    if (segments.any((s) => s.startsWith('.'))) continue;
    yield p.normalize(p.absolute(path));
  }
}
