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
/// Parsed `package_config.json`, keyed by its path.
///
/// [resolvePackageLibDir] is called once per wrapped package AND once
/// per declared service, so a project with a handful of each re-read and
/// re-parsed the same file that many times per build.
///
/// Invalidated by (modified, length) rather than held forever: under
/// `build_runner watch` a `pub get` between builds rewrites this file,
/// and a cache that outlived it would resolve packages against a layout
/// that no longer exists. A `stat` is far cheaper than a read + JSON
/// parse, so the check costs a fraction of what it saves.
final Map<String, ({DateTime mtime, int len, Map<String, dynamic> cfg})>
    _cfgCache = {};

Map<String, dynamic>? _loadPackageConfig(String cfgPath) {
  final cfgFile = File(cfgPath);
  final FileStat st;
  try {
    st = cfgFile.statSync();
    if (st.type == FileSystemEntityType.notFound) return null;
  } catch (_) {
    return null;
  }

  final hit = _cfgCache[cfgPath];
  if (hit != null && hit.mtime == st.modified && hit.len == st.size) {
    return hit.cfg;
  }

  final Map<String, dynamic> parsed;
  try {
    parsed = jsonDecode(cfgFile.readAsStringSync()) as Map<String, dynamic>;
  } on FormatException {
    return null;
  } catch (_) {
    return null;
  }
  _cfgCache[cfgPath] =
      (mtime: st.modified, len: st.size, cfg: parsed);
  return parsed;
}

String? resolvePackageLibDir(String pkgRoot, String packageName) {
  final cfgPath = p.join(pkgRoot, '.dart_tool', 'package_config.json');
  final cfg = _loadPackageConfig(cfgPath);
  if (cfg == null) return null;
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
