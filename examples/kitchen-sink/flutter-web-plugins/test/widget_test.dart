// The plugin host is JS-driven (its only output is the
// `__skalPluginCall` hook on globalThis — see lib/main.dart). There's
// no widget tree to test in isolation; meaningful tests live on the
// JS side (`packages/skal-js/src/plugin-bridge-web.js` + the
// kitchen-sink probe in `examples/kitchen-sink/src/App.jsx`'s JS tab).
//
// We keep an empty `main()` so `flutter test` exits 0 in this package
// — otherwise the default counter-app smoke test (referencing the
// removed `MyApp`) would fail compilation.

void main() {}
