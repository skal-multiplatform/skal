// Integration test — runs the full build_runner pipeline against the
// demo project. Slow (~10s per invocation) since it spins up the Dart
// VM + analyzer twice (build_runner + codegen). Opt-in via env var:
//
//   SKAL_INTEGRATION=1 dart test test/integration_test.dart
//
// The default `dart test` run skips this so the snapshot tests stay
// fast for inner-loop development. CI should set the env var.
//
// What it proves: the codegen + Builder + build_runner orchestration
// works end-to-end against a real Flutter project with real pub.dev
// dependencies. Snapshot tests cover the generator's emission shape;
// this catches issues that only surface in the real Builder context
// (analyzer config drift, package_config.json edge cases, missing
// imports the snapshot fixtures fake via _fake_flutter.dart).

import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:test/test.dart';

void main() {
  // The demo project lives at examples/kitchen-sink/flutter-host/,
  // 2 levels up from packages/skal_codegen/ (..=packages/, ../..=repo
  // root). Adjust if this test ever moves.
  final demoRoot = p.normalize(p.join(
    p.absolute('.'),
    '..',
    '..',
    'examples',
    'kitchen-sink',
    'flutter-host',
  ));

  final shouldRun = Platform.environment['SKAL_INTEGRATION'] == '1';

  test('build_runner build against the demo project', () async {
    if (!shouldRun) {
      // Print a hint so devs running tests locally know how to opt in.
      // ignore: avoid_print
      print('SKIPPED — set SKAL_INTEGRATION=1 to run');
      return;
    }
    expect(Directory(demoRoot).existsSync(), isTrue,
        reason: 'demo project not at expected path $demoRoot');

    // Run build_runner from the demo's directory. Use --delete-
    // conflicting-outputs because the test re-runs the build that
    // may have run before via developer commands.
    final r = Process.runSync(
      'dart',
      ['run', 'build_runner', 'build', '--delete-conflicting-outputs'],
      workingDirectory: demoRoot,
    );

    expect(r.exitCode, 0,
        reason: 'build_runner failed:\n${r.stderr}\n${r.stdout}');

    // Generated outputs.
    final gPath = p.join(demoRoot, 'lib', 'skal_codegen.g.dart');
    final jsonPath = p.join(demoRoot, 'lib', 'skal_codegen.json');
    expect(File(gPath).existsSync(), isTrue,
        reason: 'skal_codegen.g.dart was not written');
    expect(File(jsonPath).existsSync(), isTrue,
        reason: 'skal_codegen.json was not written');

    // Manifest content checks: the demo wraps qr_flutter + shimmer +
    // camera. At least one of each should appear.
    final manifest = File(jsonPath).readAsStringSync();
    expect(manifest, contains('QrImageView'));
    expect(manifest, contains('ShimmerFromColors'));
    expect(manifest, contains('Camera'));
    // The hosts: section maps "Camera" to the JSX symbol; the
    // generated Dart has `_build_Camera` as the registry adapter.
    final generated = File(gPath).readAsStringSync();
    expect(generated, contains('_build_QrImageView'));
    expect(generated, contains('_build_Camera'));
    expect(generated, contains('_CameraHost'));
  }, timeout: const Timeout(Duration(minutes: 2)));
}
