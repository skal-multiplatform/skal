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
  for (var i = 0; i < args.length; i++) {
    final a = args[i];
    if (a == '-o' || a == '--out') {
      if (i + 1 >= args.length) {
        stderr.writeln('error: $a requires a path argument');
        return 1;
      }
      outputPath = args[++i];
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

  // Anchor the analyzer at the package containing the first input.
  // All inputs must live under the same pubspec — codegen across
  // multiple packages in one invocation isn't supported (and isn't
  // a real use case).
  final pkgRoot = _findPackageRoot(inputFiles.first);
  if (pkgRoot == null) {
    stderr.writeln(
        'error: no pubspec.yaml found in ${inputFiles.first} or any '
        'ancestor — codegen needs a package root to resolve imports');
    return 1;
  }

  // Default output: under the same package root as the first input,
  // in lib/generated/. Devs typically override this per-package.
  outputPath ??= p.join(p.dirname(inputFiles.first), 'generated',
      'skal_adapters.g.dart');
  final absOutput = p.normalize(p.absolute(outputPath));

  final collection = AnalysisContextCollection(
    includedPaths: [pkgRoot],
    resourceProvider: PhysicalResourceProvider.INSTANCE,
  );

  // Resolve all inputs upfront so any analysis errors surface before
  // we open the output file for writing.
  final units = <ResolvedUnitResult>[];
  final relImports = <String>[];
  for (final input in inputFiles) {
    final ctx = collection.contextFor(input);
    final unitResult = await ctx.currentSession.getResolvedUnit(input);
    if (unitResult is! ResolvedUnitResult) {
      stderr.writeln('error: analyzer failed to resolve $input');
      return 2;
    }
    units.add(unitResult);
    // Relative path from generated-file → input. With output in
    // <pkg>/lib/generated/ and input under <pkg>/lib/widgets/, this
    // yields `../widgets/foo.dart`.
    relImports.add(p.relative(input, from: p.dirname(absOutput)));
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
    stdout.writeln('  • ${w.className} → ${w.registryKey}');
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

/// Walk up from [startFile] looking for the nearest `pubspec.yaml`.
/// Returns null if none found before reaching the filesystem root.
String? _findPackageRoot(String startFile) {
  var dir = p.dirname(startFile);
  while (true) {
    if (File(p.join(dir, 'pubspec.yaml')).existsSync()) return dir;
    final parent = p.dirname(dir);
    if (parent == dir) return null; // reached filesystem root
    dir = parent;
  }
}
