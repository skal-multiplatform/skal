// CLI entry — minimal driver for the Skal codegen.
//
// Usage:
//
//   dart run skal_codegen <input...> [-o <output.dart>]
//
//     <input...>   Zero or more Dart files OR directories. Each
//                  directory is walked recursively for `*.dart`
//                  files (excluding `*.g.dart` to avoid pulling in
//                  prior codegen output). When `--package` is used,
//                  inputs may be omitted and the CLI uses the
//                  package's lib/ directory.
//     -o, --out    Output path for the generated adapter file
//                  (default: <first-input-dir>/generated/skal_adapters.g.dart
//                   or <root>/lib/adapters/generated/<package>.g.dart with --package)
//     -r, --root   Project root for type resolution. Defaults to the
//                  current working directory. Must contain a
//                  `pubspec.yaml` AND a `.dart_tool/package_config.json`
//                  (i.e. you must have run `flutter pub get` first).
//                  Required when wrapping a pub-cache package whose
//                  own directory has no `.dart_tool/` — point this at
//                  the CONSUMING project's root.
//     -p, --package <name>
//                  Resolve <name> via the consuming project's
//                  `.dart_tool/package_config.json`, find its lib/
//                  directory in pub-cache, and walk it as input.
//                  Shorthand for typing the absolute pub-cache path.
//                  Composes with bare inputs (everything gets merged).
//
// Multiple inputs feed into a SINGLE generated file. Devs typically
// point at one directory (a package's `lib/`) and get one combined
// `registerAll()` listing every Widget the generator found. The
// `--package <name>` shortcut resolves a name to its pub-cache lib/
// via the consumer's `.dart_tool/package_config.json` — see the flag
// docs further down in this header.
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

// `libraryElement2` is marked @experimental until the analyzer's new
// element model stabilizes. See packages/skal_codegen/lib/src/type_mapper.dart
// for the full rationale.
// ignore_for_file: experimental_member_use

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:analyzer/dart/analysis/analysis_context.dart';
import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/file_system/physical_file_system.dart';
import 'package:path/path.dart' as p;

import 'package:skal_codegen/src/generator.dart';
import 'package:skal_codegen/src/package_resolver.dart';

Future<void> main(List<String> args) async {
  exit(await _runMain(args));
}

/// Inner main that returns an exit code. Wrapped by [main] so the
/// caller can `exit()` with the returned value — `dart run` doesn't
/// propagate `Future<int>`'s value to the process exit code reliably.
Future<int> _runMain(List<String> args) async {
  if (args.isEmpty || args.contains('-h') || args.contains('--help')) {
    _printUsage();
    return args.isEmpty ? 1 : 0;
  }

  final inputArgs = <String>[];
  final packageNames = <String>[];
  String? outputPath;
  String? rootOverride;
  var watch = false;
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
    } else if (a == '-p' || a == '--package') {
      if (i + 1 >= args.length) {
        stderr.writeln('error: $a requires a package name');
        return 1;
      }
      packageNames.add(args[++i]);
    } else if (a == '-w' || a == '--watch') {
      watch = true;
    } else if (a.startsWith('-')) {
      stderr.writeln('error: unknown flag $a');
      _printUsage();
      return 1;
    } else {
      inputArgs.add(a);
    }
  }

  if (inputArgs.isEmpty && packageNames.isEmpty) {
    _printUsage();
    return 1;
  }

  // Project root has to come first — we need it to resolve --package
  // names via .dart_tool/package_config.json. For bare-input usage
  // (no --package), this also anchors the analyzer's package
  // resolution. Order:
  //   1. Explicit --root override
  //   2. Current working directory if it looks like a Flutter project
  //      (has both pubspec.yaml AND .dart_tool/package_config.json)
  //   3. Walk up from the first input as a last-resort fallback
  final firstInputForRootSearch = inputArgs.isNotEmpty
      ? p.normalize(p.absolute(inputArgs.first))
      : Directory.current.path;
  final pkgRoot = _resolvePackageRoot(rootOverride, firstInputForRootSearch);
  if (pkgRoot == null) {
    stderr.writeln(
        'error: could not determine a project root. Pass --root <path> to '
        'a directory with pubspec.yaml + .dart_tool/package_config.json '
        '(i.e. a Flutter project where `flutter pub get` has been run).');
    return 1;
  }

  // Expand --package names into their pub-cache lib/ directories.
  // These go into `inputArgs` alongside any bare files/dirs the dev
  // passed, then the existing walk handles everything uniformly.
  for (final pkgName in packageNames) {
    final libDir = resolvePackageLibDir(pkgRoot, pkgName);
    if (libDir == null) {
      stderr.writeln(
          'error: package "$pkgName" not found in $pkgRoot/.dart_tool/'
          'package_config.json. Did you `flutter pub get` after adding it?');
      return 1;
    }
    inputArgs.add(libDir);
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
      inputFiles.addAll(walkDartFiles(abs));
    } else {
      inputFiles.add(abs);
    }
  }
  if (inputFiles.isEmpty) {
    stderr.writeln('error: no .dart files found in inputs');
    return 1;
  }
  inputFiles.sort();

  // Default output:
  //   • With --package <name>: <pkgRoot>/lib/adapters/generated/<name>.g.dart
  //     The standard place wrapped-package adapters live in the
  //     consumer's source tree.
  //   • Otherwise: alongside the first input under generated/.
  if (outputPath == null) {
    if (packageNames.length == 1) {
      outputPath = p.join(pkgRoot, 'lib', 'adapters', 'generated',
          '${packageNames.first}.g.dart');
    } else {
      outputPath = p.join(p.dirname(inputFiles.first), 'generated',
          'skal_adapters.g.dart');
    }
  }
  final absOutput = p.normalize(p.absolute(outputPath));

  // Single AnalysisContextCollection shared across the first run AND
  // every watch-mode rebuild. Constructing this is the expensive part
  // of one codegen pass — it parses the SDK summary, walks
  // .dart_tool/package_config.json, and seeds the package resolver.
  // Reusing the same context across iterations lets `analyzer` reuse
  // its driver caches; each rebuild only re-resolves the files we
  // mark as changed.
  final collection = AnalysisContextCollection(
    includedPaths: [pkgRoot],
    resourceProvider: PhysicalResourceProvider.INSTANCE,
  );
  final ctx = collection.contexts.first;

  // Wrap the analyze+generate+write cycle in a closure so the watch
  // loop below can re-run it on file changes. Returns 0 on success,
  // 2 on analyzer failure (matches the old direct-return behavior).
  // [changedFiles] is empty for the first run; in watch mode it
  // carries the file paths the OS watcher reported, so the analyzer
  // re-reads only those.
  Future<int> runOnce({Set<String> changedFiles = const {}}) async {
    if (changedFiles.isNotEmpty) {
      for (final f in changedFiles) {
        ctx.changeFile(f);
      }
      await ctx.applyPendingFileChanges();
    }
    return await _runCodegen(
      ctx: ctx,
      pkgRoot: pkgRoot,
      inputFiles: inputFiles,
      absOutput: absOutput,
    );
  }

  final code = await runOnce();
  if (!watch) return code;

  // ── Watch mode ─────────────────────────────────────────────────────
  //
  // Re-run the codegen whenever any input file (or sibling .dart file
  // in its parent directory) changes. Debounce 100ms to coalesce the
  // multi-event saves editors do (atomic-rename, ctime bump, etc.).
  final watched = <String>{};
  for (final f in inputFiles) {
    watched.add(p.dirname(f));
  }
  stdout.writeln('  → watching ${watched.length} dir(s) for .dart changes…');
  Timer? debounce;
  // Accumulate paths across the debounce window so a single rebuild
  // tells the analyzer about every file that changed.
  final pendingChanges = <String>{};
  final controller = StreamController<String>();
  for (final dir in watched) {
    Directory(dir).watch(events: FileSystemEvent.all).listen((ev) {
      if (!ev.path.endsWith('.dart')) return;
      if (ev.path.endsWith('.g.dart')) return;  // skip our own output
      controller.add(p.normalize(p.absolute(ev.path)));
    });
  }
  await for (final path in controller.stream) {
    pendingChanges.add(path);
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 100), () async {
      final changes = Set<String>.from(pendingChanges);
      pendingChanges.clear();
      stdout.writeln('  → input changed (${changes.length} file(s)), regenerating…');
      final c = await runOnce(changedFiles: changes);
      if (c != 0) stderr.writeln('  → regenerate failed (code $c)');
    });
  }
  return 0;
}

/// One full codegen pass: resolve every input via the supplied
/// analyzer context, generate, write `.g.dart` + `.json`, log the
/// summary. The caller passes the context so watch mode can reuse it
/// across rebuilds.
///
/// The context is anchored at the consumer's project. We intentionally
/// do NOT add pub-cache directories to includedPaths — each
/// `includedPaths` entry gets its own analyzer context with its own
/// package resolution, and pub-cache directories have no
/// `.dart_tool/package_config.json`, so the resulting context can't
/// resolve `package:flutter/…` imports inside those files.
///
/// Instead, we resolve ALL inputs through the CONSUMER's context
/// (which has a populated package_config from `flutter pub get`).
/// That context can resolve any file the consumer's pubspec
/// transitively depends on — pub-cache files included — because the
/// consumer's package_config maps qr_flutter's location and lists
/// its dependencies.
Future<int> _runCodegen({
  required AnalysisContext ctx,
  required String pkgRoot,
  required List<String> inputFiles,
  required String absOutput,
}) async {
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
    //   • If the input lives INSIDE the consumer's project root,
    //     use a path relative to the generated file. The analyzer
    //     will return a `package:` URI for it too (lib/ IS the
    //     consuming project's package namespace), but rewriting that
    //     to a canonical entry-point would only work if the consumer
    //     maintains a top-level `<pkg>.dart` barrel — which most
    //     Flutter apps don't.
    //
    //   • If the input lives OUTSIDE pkgRoot (i.e. it's a pub-cache
    //     third-party package), import the package's CANONICAL
    //     entry-point — `package:qr_flutter/qr_flutter.dart` for any
    //     file in qr_flutter. That gives us not just the widget class
    //     but also the package's transitive re-exports (`QrVersions`,
    //     `QrErrorCorrectLevel`, etc.), which are referenced as
    //     default values in the constructor and need to be in scope
    //     at the generated adapter's call site.
    final inputAbs = p.normalize(input);
    final pkgRootAbs = p.normalize(pkgRoot);
    final isLocal = p.isWithin(pkgRootAbs, inputAbs) ||
        p.equals(pkgRootAbs, p.dirname(inputAbs));
    if (isLocal) {
      relImports.add(p.relative(inputAbs, from: p.dirname(absOutput)));
    } else {
      final srcUri = unitResult.libraryElement2.uri;
      if (srcUri.scheme == 'package' && srcUri.pathSegments.isNotEmpty) {
        final pkg = srcUri.pathSegments.first;
        relImports.add('package:$pkg/$pkg.dart');
      } else {
        relImports.add(p.relative(inputAbs, from: p.dirname(absOutput)));
      }
    }
  }

  final result = generate(
    units: units,
    sourceRelativeImports: relImports,
  );

  // Ensure the output directory exists, then write.
  Directory(p.dirname(absOutput)).createSync(recursive: true);
  File(absOutput).writeAsStringSync(result.source);

  // Sibling JSON manifest — same shape the build_runner Builder
  // writes (see lib/builder.dart). Lets the Vite plugin pick up local
  // CLI-emitted widgets via the same `skalCodegen({manifests: […]})`
  // mechanism it uses for pub-package widgets, with no per-widget JS
  // stub or per-package vite.config.js edits required.
  //
  // Filename: swap the `.g.dart` suffix for `.json` so the two
  // outputs stay paired. `skal_adapters.g.dart` → `skal_adapters.json`.
  final manifestPath = absOutput.endsWith('.g.dart')
      ? '${absOutput.substring(0, absOutput.length - '.g.dart'.length)}.json'
      : '$absOutput.json';
  final manifest = {
    'widgets': {
      for (final w in result.generated) w.className: w.registryKey,
    },
  };
  File(manifestPath).writeAsStringSync(
      const JsonEncoder.withIndent('  ').convert(manifest));

  stdout.writeln(
      'Generated ${result.generated.length} widget(s) from '
      '${inputFiles.length} file(s) → $absOutput');
  stdout.writeln('  manifest → $manifestPath');
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
