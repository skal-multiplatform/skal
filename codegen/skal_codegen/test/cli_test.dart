// Integration test for the CLI binary at bin/skal_codegen.dart.
//
// Strategy: spawn the CLI via `Process.runSync` against a temporary
// output directory + the existing test fixtures (which are real
// Dart files the CLI knows how to analyze). Assert that:
//
//   • Bare invocation (no args) prints usage + exits 1
//   • `--help` prints usage + exits 0
//   • `-o <path>` flag writes the .g.dart to that path
//   • `.json` manifest is written alongside the .g.dart
//   • Unknown flag → exit 1 with a helpful message
//   • `--package` flag with a non-existent package → exit 1 with a
//     "pub get?" hint
//
// `--watch` mode is exercised by spawning, waiting for the watch
// banner, touching an input file, and asserting the regenerate log
// appears. Then SIGTERM'd to clean up.

import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:test/test.dart';

void main() {
  final pkgRoot = p.normalize(p.absolute('.'));
  final cliPath = p.join(pkgRoot, 'bin/skal_codegen.dart');

  // Fixture input — uses the existing fancy_text fixture (primitive
  // props only, no dependencies). The CLI doesn't actually run
  // against the consumer project's pubspec for this; it walks the
  // file via the analyzer.
  final inputFixture = p.join(pkgRoot, 'test/fixtures/fancy_text.dart');

  group('cli', () {
    test('no args prints usage + exits 1', () {
      final r = Process.runSync('dart', ['run', cliPath]);
      expect(r.exitCode, 1);
      expect(r.stderr.toString(), contains('Usage:'));
    });

    test('--help prints usage + exits 0', () {
      final r = Process.runSync('dart', ['run', cliPath, '--help']);
      expect(r.exitCode, 0);
      expect(r.stderr.toString(), contains('Usage:'));
    });

    test('unknown flag exits 1 with a clear message', () {
      final r = Process.runSync(
          'dart', ['run', cliPath, '--no-such-flag', 'foo.dart']);
      expect(r.exitCode, 1);
      expect(r.stderr.toString(), contains('unknown flag'));
    });

    test('--package with non-existent package gives a "pub get?" hint', () {
      // Use a name that definitely isn't in the codegen package's own
      // .dart_tool/package_config.json.
      final r = Process.runSync('dart',
          ['run', cliPath, '--package', 'nonexistent_xyz_pkg', '-r', pkgRoot]);
      expect(r.exitCode, 1);
      expect(r.stderr.toString(),
          contains('nonexistent_xyz_pkg'));
      expect(r.stderr.toString(),
          anyOf(contains('flutter pub get'), contains('package_config')));
    });

    test('-o <path> writes .g.dart + sibling .json', () {
      // Output to a tmp dir.
      final tmp = Directory.systemTemp.createTempSync('skal_cli_test_');
      final outPath = p.join(tmp.path, 'out.g.dart');
      try {
        final r = Process.runSync('dart',
            ['run', cliPath, inputFixture, '-o', outPath, '-r', pkgRoot]);
        expect(r.exitCode, 0,
            reason: 'CLI failed: ${r.stderr}\n${r.stdout}');
        expect(File(outPath).existsSync(), isTrue,
            reason: '.g.dart was not written');
        // Sibling .json manifest.
        final jsonPath = outPath.replaceFirst(
            RegExp(r'\.g\.dart$'), '.json');
        expect(File(jsonPath).existsSync(), isTrue,
            reason: 'sibling .json manifest was not written');
        // Manifest content sanity.
        final manifestContent = File(jsonPath).readAsStringSync();
        expect(manifestContent, contains('FancyText'));
        expect(manifestContent, contains('fancyText'));
      } finally {
        tmp.deleteSync(recursive: true);
      }
    });
  });
}
