// `flutter create`'s counter-app test lived here. It needs a `MyApp` this
// host does not have, so `flutter test` did not compile.
//
// libskal does not load under `flutter test`, and this host builds its
// shell inline in `_boot`, so all this checks is that the host compiles.
// The app template's shell has real tests:
// scripts/templates/default/flutter-host/test/widget_test.dart.

import 'package:flutter_test/flutter_test.dart';

import 'package:gallery/main.dart' as host;

void main() {
  test('the host compiles', () => expect(host.main, isA<Function>()));
}
