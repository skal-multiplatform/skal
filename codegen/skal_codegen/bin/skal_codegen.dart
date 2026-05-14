// CLI entry — minimal driver for the Skal codegen.
//
// Usage:
//
//   dart run skal_codegen <input.dart> [-o <output.dart>]
//
//     <input.dart>  Dart file containing Widget classes to wrap
//     -o, --out     Output path for the generated adapter file
//                   (default: lib/generated/skal_adapters.g.dart, relative
//                   to the directory containing <input.dart>)
//
// For Slice 2 MVP, processes ONE input file. Multi-file + package-
// level scanning (`dart run skal_codegen add <package>`) comes in
// Slice 2's later commits along with build_runner integration.
//
// Example:
//
//   $ dart run skal_codegen test/fixtures/fancy_text.dart -o /tmp/out.dart
//   Generated 1 widget(s) → /tmp/out.dart
//     • FancyText → fancyText

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

  String? inputPath;
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
    } else if (inputPath == null) {
      inputPath = a;
    } else {
      stderr.writeln(
          'error: multiple input files not supported yet — got $a after $inputPath');
      return 1;
    }
  }

  if (inputPath == null) {
    _printUsage();
    return 1;
  }

  final absInput = p.normalize(p.absolute(inputPath));
  if (!File(absInput).existsSync()) {
    stderr.writeln('error: input file not found: $absInput');
    return 1;
  }

  // Find a package root to anchor the analyzer context. We walk up
  // from the input looking for a pubspec.yaml; that directory is the
  // root analyzer needs for type resolution.
  final pkgRoot = _findPackageRoot(absInput);
  if (pkgRoot == null) {
    stderr.writeln(
        'error: no pubspec.yaml found in $absInput or any ancestor — '
        'codegen needs a package root to resolve imports');
    return 1;
  }

  outputPath ??= p.join(p.dirname(absInput), 'generated/skal_adapters.g.dart');
  final absOutput = p.normalize(p.absolute(outputPath));

  final collection = AnalysisContextCollection(
    includedPaths: [pkgRoot],
    resourceProvider: PhysicalResourceProvider.INSTANCE,
  );
  final ctx = collection.contextFor(absInput);
  final unitResult = await ctx.currentSession.getResolvedUnit(absInput);
  if (unitResult is! ResolvedUnitResult) {
    stderr.writeln('error: analyzer failed to resolve $absInput');
    return 2;
  }

  // Relative import from the generated file back to the input source.
  // If the output is `<pkgRoot>/lib/generated/skal_adapters.g.dart` and
  // input is `<pkgRoot>/test/fixtures/fancy_text.dart`, this comes out
  // as `../../test/fixtures/fancy_text.dart`.
  final relImport = p.relative(absInput, from: p.dirname(absOutput));

  final result = generate(
    units: [unitResult],
    sourceRelativeImports: [relImport],
  );

  // Ensure the output directory exists, then write.
  Directory(p.dirname(absOutput)).createSync(recursive: true);
  File(absOutput).writeAsStringSync(result.source);

  stdout.writeln(
      'Generated ${result.generated.length} widget(s) → $absOutput');
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
