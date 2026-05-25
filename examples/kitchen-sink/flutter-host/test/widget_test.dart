// Skal's kitchen-sink app boots a JS bundle into a libskal-backed
// JSC runtime (native) or via dart:js_interop (web), which can't be
// driven from `flutter test` without a lot of stubbing. Tests live
// at the JS layer (`bun test`) + the framework layer
// (`packages/skal_flutter test`). Keep `flutter test` exiting 0 so
// CI doesn't fail on a smoke run.
//
// The default `flutter create` test referenced a `MyApp` widget that
// doesn't exist in Skal's main.dart; replacing with this empty entry
// keeps the file present (some workflows expect a default test) but
// doesn't run anything.

void main() {}
