# Changelog

## 0.1.0

First tagged version. Not yet published to pub.dev — the package is
delivered inside the vendored `.skal-runtime` a scaffolded app carries,
so consumers depend on it by path rather than by version.

- `SkalAdapterBuilder`, a `build_runner` Builder that reads a consumer's
  `lib/skal_codegen.yaml` and emits one combined adapter plus a JSON
  manifest for the Vite side.
- Constructor introspection over Dart's `analyzer`, mapping widget
  constructor parameters onto Skal props.
- `analyzer ^14`. The transitional element model (`*2`/`*3` suffixes)
  that analyzer 7 exposed is gone, which is what forced the Flutter
  floor to 3.47: `analyzer >=13.1` needs `meta >=1.18.3`, and older
  Flutters pin `meta 1.17.0`.
- Duration defaults are read from the constructor's default expression
  rather than out of a private SDK field.
