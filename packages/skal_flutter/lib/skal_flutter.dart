// Skal — Dart/Flutter framework half. Barrel re-export of the public
// surface, so apps can `import 'package:skal_flutter/skal_flutter.dart'`
// for the common case instead of pinning four specific subfile imports.
//
// Apps that need fine-grained imports (or want to avoid pulling in
// unused symbols) can still target `package:skal_flutter/skal/<file>.dart`
// directly — see lib/skal/ for the per-file split.

export 'skal/bridge.dart';
export 'skal/dialogs.dart';
export 'skal/registry.dart';
export 'skal/root.dart';
export 'skal/wire.dart';
export 'skal_ffi.dart';
