# skal_codegen

Generates Skal adapters for Flutter widgets you did not write.

Skal's fast-path primitives cross the bridge as first-class wire ops. Anything
else — a pub.dev widget, one of your own — needs an adapter that registers it
with `SkalRegistry` and maps its constructor parameters onto Skal props.
Writing those by hand is mechanical and easy to get subtly wrong. This package
reads the widget classes with Dart's `analyzer`, introspects their
constructors, and emits the adapters.

> **Not on pub.dev.** A scaffolded Skal app carries this package inside its
> vendored `.skal-runtime` and depends on it by path, so there is nothing a
> published version would solve today. `publish_to: 'none'` in the pubspec
> records that on purpose.

## Two ways to run it

### build_runner (the normal path)

```yaml
# pubspec.yaml
dev_dependencies:
  build_runner: ^2.4.0
  skal_codegen:
    path: ../.skal-runtime/packages/skal_codegen
```

Create the marker file `lib/skal_codegen.yaml` naming the packages to wrap:

```yaml
packages:
  - qr_flutter
  - video_player
```

Then:

```bash
dart run build_runner build
```

That writes `lib/skal_codegen.g.dart` (the combined adapter) and
`lib/skal_codegen.json` (a manifest the Vite plugin reads to generate the JSX
side). Register them from `main.dart`:

```dart
import 'skal_codegen.g.dart' as gen;

void main() {
  gen.registerAll();
  runApp(const SkalApp());
}
```

The builder is `auto_apply: dependents` and `build_to: source`, so it runs as
soon as the package is a dev dependency and writes into your source tree
rather than the build cache.

It keys off a marker file rather than your pubspec because build_runner
derives output paths by suffix substitution; the `$lib$` synthetic input makes
that resolution fight you over a doubled `lib/`. The marker file is the
ecosystem's standard way around it.

### CLI (one-off, or wrapping something outside your tree)

```bash
dart run skal_codegen <input...> [-o <output.dart>] [-r <root>] [--package <name>]
```

Inputs are Dart files or directories (walked recursively, skipping `*.g.dart`).
`--root` must contain both a `pubspec.yaml` and a
`.dart_tool/package_config.json`, so run `flutter pub get` first — type
resolution needs the package config to follow imports into the pub cache.

## Requirements

Flutter 3.47 or newer. This package is on `analyzer ^14`, which needs
`meta >=1.18.3`; Flutter pins `meta 1.17.0` up to 3.41 and the resolve fails
there. `skal doctor` checks this and says so.

## Layout

| | |
|---|---|
| `lib/builder.dart` | the `build_runner` Builder and its factory |
| `lib/src/generator.dart` | emits the adapter source |
| `lib/src/type_mapper.dart` | Dart constructor parameter → Skal prop |
| `lib/src/package_resolver.dart` | resolves a package name to its lib/ in the pub cache |
| `bin/skal_codegen.dart` | the CLI driver |

See [WRAPPING_PUB_PACKAGES.md](https://github.com/skal-multiplatform/skal/blob/main/docs/WRAPPING_PUB_PACKAGES.md)
for the decision tree on when an adapter is the right answer at all.
