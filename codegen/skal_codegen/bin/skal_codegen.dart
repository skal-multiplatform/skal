// CLI entry — minimal driver for the Skal codegen.
//
// Usage:
//
//   dart run skal_codegen <input...> [-o <output.dart>]
//
//     <input...>   One or more Dart files OR directories. Each
//                  directory is walked recursively for `*.dart`
//                  files (excluding `*.g.dart` to avoid pulling in
//                  prior codegen output).
//     -o, --out    Output path for the generated adapter file
//                  (default: <first-input-dir>/generated/skal_adapters.g.dart)
//     -r, --root   Project root for type resolution. Defaults to the
//                  current working directory. Must contain a
//                  `pubspec.yaml` AND a `.dart_tool/package_config.json`
//                  (i.e. you must have run `flutter pub get` first).
//                  Required when wrapping a pub-cache package whose
//                  own directory has no `.dart_tool/` — point this at
//                  the CONSUMING project's root.
//
// Multiple inputs feed into a SINGLE generated file. Devs typically
// point at one directory (a package's `lib/`) and get one combined
// `registerAll()` listing every Widget the generator found. Package-
// resolution shortcuts (`--package qr_flutter` → `~/.pub-cache/...`)
// will land in a follow-up commit.
//
// Examples:
//
//   $ dart run skal_codegen test/fixtures/fancy_text.dart -o /tmp/out.dart
//   Generated 1 widget(s) → /tmp/out.dart
//     • FancyText → fancyText
//
//   $ dart run skal_codegen lib/widgets/ -o lib/generated/skal_adapters.g.dart
//   Generated 4 widget(s) → lib/generated/skal_adapters.g.dart
//     • Badge → badge
//     • Panel → panel
//     • Slider → slider
//     • Toggle → toggle

import 'dart:io';

import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/file_system/physical_file_system.dart';
import 'package:path/path.dart' as p;

import 'package:skal_codegen/src/generator.dart';

Future<int> main(List<String> args) async {
  if (args.isEmpty || args.contains('-h') || args.contains('--help')) {
    _printUsage();
    return args.isEmpty ? 1 : 0;
  }

  final inputArgs = <String>[];
  String? outputPath;
  String? rootOverride;
  for (var i = 0; i < args.length; i++) {
    final a = args[i];
    if (a == '-o' || a == '--out') {
      if (i + 1 >= args.length) {
        stderr.writeln('error: $a requires a path argument');
        return 1;
      }
      outputPath = args[++i];
    } else if (a == '-r' || a == '--root') {
      if (i + 1 >= args.length) {
        stderr.writeln('error: $a requires a path argument');
        return 1;
      }
      rootOverride = args[++i];
    } else if (a.startsWith('-')) {
      stderr.writeln('error: unknown flag $a');
      _printUsage();
      return 1;
    } else {
      inputArgs.add(a);
    }
  }

  if (inputArgs.isEmpty) {
    _printUsage();
    return 1;
  }

  // Expand each input arg (file or directory) into a flat list of
  // absolute `.dart` file paths. Sorted so the output's import order
  // is deterministic across runs / machines.
  final inputFiles = <String>[];
  for (final arg in inputArgs) {
    final abs = p.normalize(p.absolute(arg));
    final stat = FileSystemEntity.typeSync(abs);
    if (stat == FileSystemEntityType.notFound) {
      stderr.writeln('error: input not found: $abs');
      return 1;
    } else if (stat == FileSystemEntityType.directory) {
      inputFiles.addAll(_walkDartFiles(abs));
    } else {
      inputFiles.add(abs);
    }
  }
  if (inputFiles.isEmpty) {
    stderr.writeln('error: no .dart files found in inputs');
    return 1;
  }
  inputFiles.sort();

  // Anchor the analyzer at the CONSUMING project, not at the input
  // file's nearest pubspec. Inputs can live in pub-cache (when wrapping
  // third-party packages), and pub-cache directories don't have
  // `.dart_tool/package_config.json` — analyzer can't resolve
  // `package:flutter/…` from there.
  //
  // Order of resolution:
  //   1. Explicit --root override
  //   2. Current working directory if it looks like a Flutter project
  //      (has both pubspec.yaml AND .dart_tool/package_config.json)
  //   3. Walk up from the first input as a last-resort fallback
  //      (useful when the dev's input IS inside their own project)
  final pkgRoot = _resolvePackageRoot(rootOverride, inputFiles.first);
  if (pkgRoot == null) {
    stderr.writeln(
        'error: could not determine a project root. Pass --root <path> to '
        'a directory with pubspec.yaml + .dart_tool/package_config.json '
        '(i.e. a Flutter project where `flutter pub get` has been run).');
    return 1;
  }

  // Default output: under the same package root as the first input,
  // in lib/generated/. Devs typically override this per-package.
  outputPath ??= p.join(p.dirname(inputFiles.first), 'generated',
      'skal_adapters.g.dart');
  final absOutput = p.normalize(p.absolute(outputPath));

  // Single analyzer context anchored at the consumer's project. We
  // intentionally do NOT add pub-cache directories to includedPaths —
  // each `includedPaths` entry gets its own analyzer context with its
  // own package resolution, and pub-cache directories have no
  // `.dart_tool/package_config.json`, so the resulting context can't
  // resolve `package:flutter/…` imports inside those files.
  //
  // Instead, we resolve ALL inputs through the CONSUMER's context
  // (which has a populated package_config from `flutter pub get`).
  // That context can resolve any file the consumer's pubspec
  // transitively depends on — pub-cache files included — because the
  // consumer's package_config maps qr_flutter's location and lists
  // its dependencies.
  final collection = AnalysisContextCollection(
    includedPaths: [pkgRoot],
    resourceProvider: PhysicalResourceProvider.INSTANCE,
  );
  final ctx = collection.contexts.first;

  // Resolve all inputs upfront so any analysis errors surface before
  // we open the output file for writing.
  final units = <ResolvedUnitResult>[];
  final relImports = <String>[];
  for (final input in inputFiles) {
    final unitResult = await ctx.currentSession.getResolvedUnit(input);
    if (unitResult is! ResolvedUnitResult) {
      stderr.writeln('error: analyzer failed to resolve $input');
      return 2;
    }
    units.add(unitResult);
    // Decide how to import the source from the generated file:
    //
    //   • If the analyzer resolved it via a `package:` URI (pub-cache
    //     third-party packages always come back this way), import the
    //     package's CANONICAL entry-point — `package:qr_flutter/qr_flutter.dart`
    //     for any file in qr_flutter. That gives us not just the widget
    //     class but also the package's transitive re-exports
    //     (`QrVersions`, `QrErrorCorrectLevel`, etc.), which are
    //     referenced as default values in the constructor and need to
    //     be in scope at the generated adapter's call site.
    //
    //   • Otherwise (input is a local file inside the consumer's
    //     project), use a path relative to the generated file. That's
    //     the natural form for in-tree widgets.
    final srcUri = unitResult.libraryElement.source.uri;
    if (srcUri.scheme == 'package' && srcUri.pathSegments.isNotEmpty) {
      final pkg = srcUri.pathSegments.first;
      relImports.add('package:$pkg/$pkg.dart');
    } else {
      relImports.add(p.relative(input, from: p.dirname(absOutput)));
    }
  }

  final result = generate(
    units: units,
    sourceRelativeImports: relImports,
  );

  // Ensure the output directory exists, then write.
  Directory(p.dirname(absOutput)).createSync(recursive: true);
  File(absOutput).writeAsStringSync(result.source);

  stdout.writeln(
      'Generated ${result.generated.length} widget(s) from '
      '${inputFiles.length} file(s) → $absOutput');
  for (final w in result.generated) {
    stdout.write('  • ${w.className} → ${w.registryKey}');
    if (w.omittedOptionalParams.isNotEmpty) {
      stdout.write('  (omitted: ${w.omittedOptionalParams.join(", ")})');
    }
    stdout.writeln();
  }
  if (result.skipped.isNotEmpty) {
    stdout.writeln('Skipped ${result.skipped.length} widget(s):');
    for (final w in result.skipped) {
      stdout.writeln('  - ${w.className}: ${w.skipReason}');
    }
  }
  return 0;
}

/// Recursively find all `.dart` files under [dir], excluding generated
/// (`*.g.dart`) files so a re-run doesn't re-process its own output.
/// Hidden directories (those starting with `.`, e.g. `.dart_tool`)
/// are also skipped — they hold tool caches we never want to scan.
Iterable<String> _walkDartFiles(String dir) sync* {
  for (final entity in Directory(dir).listSync(recursive: true, followLinks: false)) {
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

void _printUsage() {
  stderr.writeln('Usage: dart run skal_codegen <input.dart> [-o <output.dart>]');
  stderr.writeln('');
  stderr.writeln('Generate Skal adapter code for the Widget classes');
  stderr.writeln('declared in <input.dart>. Default output location:');
  stderr.writeln('  <input dir>/generated/skal_adapters.g.dart');
}

/// Pick the directory the analyzer should anchor at to resolve
/// `package:` URIs. Order:
///
///   1. [rootOverride] from `--root` if given (validated for existence)
///   2. Current working directory if it has BOTH `pubspec.yaml` AND
///      `.dart_tool/package_config.json` — the dev ran codegen from
///      inside their consuming project (the common case)
///   3. Walk up from [startFile] looking for the nearest `pubspec.yaml`
///      as a last-resort fallback (works when input is inside the
///      consuming project rather than in pub-cache)
String? _resolvePackageRoot(String? rootOverride, String startFile) {
  if (rootOverride != null) {
    final abs = p.normalize(p.absolute(rootOverride));
    if (Directory(abs).existsSync()) return abs;
    stderr.writeln('error: --root path does not exist: $abs');
    return null;
  }

  final cwd = Directory.current.path;
  if (File(p.join(cwd, 'pubspec.yaml')).existsSync() &&
      File(p.join(cwd, '.dart_tool', 'package_config.json')).existsSync()) {
    return cwd;
  }

  // Walk up from input. Works when input is a sibling within the
  // dev's own project. Fails (returns null) for pub-cache inputs
  // when there's no .dart_tool above — the dev would need --root.
  var dir = p.dirname(startFile);
  while (true) {
    if (File(p.join(dir, 'pubspec.yaml')).existsSync()) return dir;
    final parent = p.dirname(dir);
    if (parent == dir) return null;
    dir = parent;
  }
}
