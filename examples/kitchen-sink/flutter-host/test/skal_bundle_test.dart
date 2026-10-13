// Release apps copy skal-app.cjs and its .jsc bytecode out of their assets
// on first launch (see lib/skal_bundle.dart). An update keeps the app's data
// directory, so a copy that is never re-checked runs the previous version's
// JS forever. Skal's app template did exactly that until 2026-10: it copied
// only when the files did not exist.
//
// This file covers the template's copy as well as kitchen-sink's: every
// host's skal_bundle.dart must be byte-identical to this one, and every
// host's main.dart must call it rather than keep a private copy.
//
// Run from examples/kitchen-sink/flutter-host: flutter test test/skal_bundle_test.dart
// The stamp-format tests run scripts/skal-bundle-stamp.js, so they need bun.

import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart' show FlutterError;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kitchen_sink/skal_bundle.dart';

const _cjs = 'assets/skal-app.cjs';
const _jsc = 'assets/skal-app.cjs.jsc';
const _stampKey = 'assets/skal-app.stamp';

/// Hands each asset out as a view into a larger buffer, which an engine is
/// allowed to do, so a reader that ignores the view's offset copies the
/// wrong bytes. Records every key it is asked for.
class _Assets extends CachingAssetBundle {
  _Assets(this.files, {this.failOn});

  final Map<String, List<int>> files;

  /// Throws when this key is loaded: a launch killed partway through.
  final String? failOn;

  final List<String> loads = [];

  @override
  Future<ByteData> load(String key) async {
    loads.add(key);
    if (key == failOn) throw StateError('killed while loading $key');
    final bytes = files[key];
    if (bytes == null) throw FlutterError('Unable to load asset: "$key".');
    final padded = Uint8List(bytes.length + 16)
      ..setRange(8, 8 + bytes.length, bytes);
    return ByteData.sublistView(padded, 8, 8 + bytes.length);
  }
}

/// One build's assets. [id] stands in for the SHA-256: the reader compares
/// stamps, it never recomputes them. Null [id] is a build that shipped no
/// stamp, like every build made with the pre-2026-10 build script.
Map<String, List<int>> _build(String cjs, String jsc, {String? id}) {
  final c = utf8.encode(cjs);
  final j = utf8.encode(jsc);
  return {
    _cjs: c,
    _jsc: j,
    if (id != null)
      _stampKey: utf8.encode('${c.length} ${j.length} ${id.padLeft(64, '0')}\n'),
  };
}

// Same sizes on purpose: a check that only compares sizes passes them.
final _v1 = _build('module.exports = "v1";', 'bytecode for v1', id: 'a1');
final _v2 = _build('module.exports = "v2";', 'bytecode for v2', id: 'b2');

void main() {
  late Directory dir;
  File file(String name) => File('${dir.path}/$name');
  String read(String name) => file(name).readAsStringSync();

  setUp(() => dir = Directory.systemTemp.createTempSync('skal_bundle_test'));
  tearDown(() => dir.deleteSync(recursive: true));

  group('extractSkalBundle', () {
    test('a fresh install gets the pair and the stamp', () async {
      final path = await extractSkalBundle(dir.path, assets: _Assets(_v1));

      expect(path, file('skal-app.cjs').path);
      expect(read('skal-app.cjs'), 'module.exports = "v1";');
      expect(read('skal-app.cjs.jsc'), 'bytecode for v1');
      expect(file('skal-app.stamp').readAsBytesSync(), _v1[_stampKey]);
    });

    test('an update replaces the copy the old template left behind',
        () async {
      // Exactly what every app made from the old template has on disk:
      // the pair, no stamp.
      file('skal-app.cjs').writeAsStringSync('module.exports = "v1";');
      file('skal-app.cjs.jsc').writeAsStringSync('bytecode for v1');

      await extractSkalBundle(dir.path, assets: _Assets(_v2));

      expect(read('skal-app.cjs'), 'module.exports = "v2";');
      expect(read('skal-app.cjs.jsc'), 'bytecode for v2');
    });

    test('an update replaces a copy this code made', () async {
      await extractSkalBundle(dir.path, assets: _Assets(_v1));
      await extractSkalBundle(dir.path, assets: _Assets(_v2));

      expect(read('skal-app.cjs'), 'module.exports = "v2";');
      expect(read('skal-app.cjs.jsc'), 'bytecode for v2');
      expect(file('skal-app.stamp').readAsBytesSync(), _v2[_stampKey]);
    });

    test('a bytecode-only change is seen (same JS, different bun)', () async {
      await extractSkalBundle(dir.path, assets: _Assets(_v1));
      final rebuilt = _build('module.exports = "v1";', 'bytecode from bun2',
          id: 'c3');

      await extractSkalBundle(dir.path, assets: _Assets(rebuilt));

      expect(read('skal-app.cjs.jsc'), 'bytecode from bun2');
    });

    test('a relaunch with nothing new loads only the stamp', () async {
      await extractSkalBundle(dir.path, assets: _Assets(_v1));
      final relaunch = _Assets(_v1);

      final path = await extractSkalBundle(dir.path, assets: relaunch);

      expect(path, file('skal-app.cjs').path);
      expect(relaunch.loads, [_stampKey]);
    });

    test('a copy cut short is replaced even though the stamp matches',
        () async {
      await extractSkalBundle(dir.path, assets: _Assets(_v1));
      file('skal-app.cjs.jsc').writeAsStringSync('bytecode');

      await extractSkalBundle(dir.path, assets: _Assets(_v1));

      expect(read('skal-app.cjs.jsc'), 'bytecode for v1');
    });

    test('a missing file is replaced', () async {
      await extractSkalBundle(dir.path, assets: _Assets(_v1));
      file('skal-app.cjs').deleteSync();

      await extractSkalBundle(dir.path, assets: _Assets(_v1));

      expect(read('skal-app.cjs'), 'module.exports = "v1";');
    });

    test('a launch killed mid-copy leaves nothing that looks current',
        () async {
      await extractSkalBundle(dir.path, assets: _Assets(_v1));
      // Killed after writing v2's .jsc, before its .cjs.
      await expectLater(
          extractSkalBundle(dir.path, assets: _Assets(_v2, failOn: _cjs)),
          throwsStateError);

      await extractSkalBundle(dir.path, assets: _Assets(_v2));

      expect(read('skal-app.cjs'), 'module.exports = "v2";');
      expect(read('skal-app.cjs.jsc'), 'bytecode for v2');
    });

    test('a copy made without a stamp drops the older stamp beside it',
        () async {
      // v1 with a stamp, then a build of other JS without one, then v1
      // again. Same sizes throughout, so only the stamp can tell them apart.
      await extractSkalBundle(dir.path, assets: _Assets(_v1));
      final unstamped = _build('module.exports = "v9";', 'bytecode for v9');
      await extractSkalBundle(dir.path, assets: _Assets(unstamped));

      await extractSkalBundle(dir.path, assets: _Assets(_v1));

      expect(read('skal-app.cjs'), 'module.exports = "v1";');
      expect(read('skal-app.cjs.jsc'), 'bytecode for v1');
    });

    group('a build without a stamp', () {
      final v1 = _build('module.exports = "v1";', 'bytecode for v1');
      final v2 = _build('module.exports = "v2";', 'bytecode for v2');

      test('still replaces a stale copy', () async {
        file('skal-app.cjs').writeAsStringSync('module.exports = "v1";');
        file('skal-app.cjs.jsc').writeAsStringSync('bytecode for v1');

        await extractSkalBundle(dir.path, assets: _Assets(v2));

        expect(read('skal-app.cjs'), 'module.exports = "v2";');
        expect(read('skal-app.cjs.jsc'), 'bytecode for v2');
      });

      test('leaves no matching .cjs when killed mid-copy', () async {
        // Without a stamp the .cjs is what vouches for the pair, so it has
        // to be written after the .jsc.
        file('skal-app.cjs').writeAsStringSync('module.exports = "v1";');
        file('skal-app.cjs.jsc').writeAsStringSync('bytecode for v1');
        await expectLater(
            extractSkalBundle(dir.path, assets: _Assets(v2, failOn: _jsc)),
            throwsStateError);

        await extractSkalBundle(dir.path, assets: _Assets(v2));

        expect(read('skal-app.cjs.jsc'), 'bytecode for v2');
      });

      test('relaunches without loading the bytecode', () async {
        await extractSkalBundle(dir.path, assets: _Assets(v1));
        final relaunch = _Assets(v1);

        await extractSkalBundle(dir.path, assets: relaunch);

        expect(relaunch.loads, [_stampKey, _cjs]);
      });
    });

    test('a stamp that does not parse is not trusted', () async {
      file('skal-app.cjs').writeAsStringSync('module.exports = "v1";');
      file('skal-app.cjs.jsc').writeAsStringSync('bytecode for v1');
      file('skal-app.stamp').writeAsStringSync('garbage\n');
      final v2 = _build('module.exports = "v2";', 'bytecode for v2')
        ..[_stampKey] = utf8.encode('garbage\n');

      await extractSkalBundle(dir.path, assets: _Assets(v2));

      expect(read('skal-app.cjs'), 'module.exports = "v2";');
    });
  });

  // The stamp is a format shared by two languages: the build writes it in
  // JS, the app reads it in Dart. These run the real writer.
  group('scripts/skal-bundle-stamp.js', () {
    const script = '../../../scripts/skal-bundle-stamp.js';

    Future<Map<String, List<int>>> stampedBuild(
        List<int> cjs, List<int> jsc) async {
      final out = Directory('${dir.path}/build')..createSync();
      File('${out.path}/skal-app.cjs').writeAsBytesSync(cjs);
      File('${out.path}/skal-app.cjs.jsc').writeAsBytesSync(jsc);
      final run = await Process.run('bun', [script, out.path]);
      expect(run.exitCode, 0, reason: '${run.stdout}${run.stderr}');
      final files = {
        _cjs: File('${out.path}/skal-app.cjs').readAsBytesSync(),
        _jsc: File('${out.path}/skal-app.cjs.jsc').readAsBytesSync(),
        _stampKey: File('${out.path}/skal-app.stamp').readAsBytesSync(),
      };
      out.deleteSync(recursive: true);
      return files;
    }

    test('writes a stamp the app accepts', () async {
      final build =
          await stampedBuild(utf8.encode('module.exports = "v1";'), [1, 2, 3]);
      final copy = Directory('${dir.path}/copy');

      await extractSkalBundle(copy.path, assets: _Assets(build));
      final relaunch = _Assets(build);
      await extractSkalBundle(copy.path, assets: relaunch);

      expect(relaunch.loads, [_stampKey],
          reason: 'the app fell back to comparing bytes, so it could not '
              'parse the stamp: ${utf8.decode(build[_stampKey]!)}');
    });

    test('changes when only the bytecode changes', () async {
      final js = utf8.encode('module.exports = "v1";');
      final a = await stampedBuild(js, [1, 2, 3]);
      final b = await stampedBuild(js, [1, 2, 4]);

      expect(b[_stampKey], isNot(a[_stampKey]));
    });

    test('changes when the JS changes but keeps its size', () async {
      final a =
          await stampedBuild(utf8.encode('module.exports = "v1";'), [1, 2, 3]);
      final b =
          await stampedBuild(utf8.encode('module.exports = "v2";'), [1, 2, 3]);

      expect(b[_stampKey], isNot(a[_stampKey]));
    });

    test('git tracks or ignores each stamp exactly as its bundle', () async {
      // An untracked stamp next to a committed bundle survives the checkout
      // or pull that changes the bundle, and the pair then ships stale JS.
      Future<bool> ignored(String path) async =>
          (await Process.run('git', ['check-ignore', '-q', path])).exitCode ==
          0;
      for (final host in _hosts) {
        final assets = '$host/flutter-host/assets';
        expect(await ignored('$assets/skal-app.stamp'),
            await ignored('$assets/skal-app.cjs'),
            reason: 'see the skal-app.stamp rules in the repo .gitignore');
      }
    });

    test('every stamp in the tree matches the bundle beside it', () async {
      // A stamp that outlives its bundle brings the stale-bundle bug back:
      // the app trusts the stamp and keeps the old copy.
      for (final host in _hosts) {
        final assets = '$host/flutter-host/assets';
        final stamp = File('$assets/skal-app.stamp');
        if (!stamp.existsSync()) continue;
        final fresh = await stampedBuild(
            File('$assets/skal-app.cjs').readAsBytesSync(),
            File('$assets/skal-app.cjs.jsc').readAsBytesSync());
        expect(stamp.readAsBytesSync(), fresh[_stampKey],
            reason: '$assets/skal-app.stamp is stale — run `bun run build` '
                'in $host');
      }
    });
  });

  group('every host', () {
    const template = '../../../scripts/templates/default';

    test('ships this skal_bundle.dart byte for byte', () {
      final ours = File('lib/skal_bundle.dart').readAsBytesSync();
      for (final host in [template, ..._hosts]) {
        expect(File('$host/flutter-host/lib/skal_bundle.dart').readAsBytesSync(),
            ours,
            reason: '$host has drifted — copy '
                '$template/flutter-host/lib/skal_bundle.dart over it');
      }
    });

    test('calls it from main.dart instead of keeping its own copy', () {
      for (final host in [template, ..._hosts]) {
        final main = File('$host/flutter-host/lib/main.dart').readAsStringSync();
        expect(main, contains('extractSkalBundle('), reason: host);
        expect(main, isNot(contains("'assets/skal-app.cjs")), reason: host);
      }
    });
  });
}

/// Every in-repo host besides the template, relative to this package.
/// benchmark_v2's hosts are left out on purpose: they are gitignored, and
/// their startup path is part of the published cold-start numbers.
const _hosts = ['../../kitchen-sink', '../../gallery', '../../virt-bench'];
