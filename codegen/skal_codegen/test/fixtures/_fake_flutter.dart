// Minimal "fake Flutter" — just enough class shape for the analyzer
// to type-check our test-fixture Widget classes without requiring
// the codegen package to depend on the Flutter SDK at all.
//
// The codegen tool itself is pure Dart by design — it consumes Dart
// AST/element data, produces Dart source as text. It only NEEDS
// Flutter present at the consumer's `dart run build_runner build`
// site, because that's where the dev's pubspec resolves real Flutter
// imports.
//
// For unit tests we can stand in this file. Class shapes here exist
// purely so `extends StatelessWidget` resolves and `Color color`
// type-checks; runtime behavior is irrelevant — `dart test` never
// instantiates anything.

class Key {}

/// Stand-in for dart:ui's `VoidCallback = void Function()`. The
/// codegen recognizes both this typedef alias AND raw `void Function()`
/// param types as equivalent — see `_isVoidCallback` in type_mapper.dart.
typedef VoidCallback = void Function();

/// Stand-in for dart:ui's `ValueChanged<T> = void Function(T value)`.
/// Same equivalence as VoidCallback: codegen accepts both this alias
/// AND raw `void Function(T)`. See `_valueChangedTypeArg`.
typedef ValueChanged<T> = void Function(T value);

class Widget {
  const Widget();
}

abstract class StatelessWidget extends Widget {
  const StatelessWidget({Key? key});

  Widget build(BuildContext context);
}

abstract class StatefulWidget extends Widget {
  const StatefulWidget({Key? key});
}

class BuildContext {}

class Color {
  final int value;
  const Color(this.value);
}

class TextStyle {
  final Color? color;
  final double? fontSize;
  const TextStyle({this.color, this.fontSize});
}

class Text extends Widget {
  final String data;
  final TextStyle? style;
  const Text(this.data, {Key? key, this.style});

  @override
  String toString() => 'Text($data)';
}

/// Minimal EdgeInsets stand-in. Real Flutter's EdgeInsets exposes the
/// same `left/top/right/bottom` final-double fields, plus three
/// alternative constructors (`.all`, `.symmetric`, `.only`). The
/// analyzer's constant evaluator flattens all of them to the same
/// four-double shape, so the codegen logic that reads those fields
/// works the same against this stub.
class EdgeInsets {
  final double left;
  final double top;
  final double right;
  final double bottom;

  const EdgeInsets.fromLTRB(this.left, this.top, this.right, this.bottom);

  const EdgeInsets.all(double v)
      : left = v,
        top = v,
        right = v,
        bottom = v;

  const EdgeInsets.symmetric({double horizontal = 0, double vertical = 0})
      : left = horizontal,
        top = vertical,
        right = horizontal,
        bottom = vertical;
}

/// Stand-in for any controller-style class — must have a `dispose()`
/// method so the synthesized host adapter's lifecycle compiles
/// against the fake. Real Flutter controllers (CameraController,
/// VideoPlayerController, ChangeNotifier-derived things) all expose
/// this shape.
///
/// Methods on this class also exercise the codegen's JS → Dart RPC
/// dispatch path: each is auto-discovered as a callable surface from
/// the JSX side via `await ref.method(args)`. Filter rules in
/// `_collectControllerMethods` keep us from exposing dispose() or
/// inherited Object methods.
class FakeController {
  int _value;
  FakeController({int initial = 0}) : _value = initial;

  // RPC-eligible methods — codegen wires these into the host's
  // dispatcher switch:
  void bump(int delta) { _value += delta; }
  void reset() { _value = 0; }
  int getValue() => _value;
  Future<bool> ping() async => true;
  // String args + returns. Exercises both directions of the string
  // bridge: JS → Dart via OP_METHOD_ARG with eventArgStr, Dart → JS
  // via _writeMethodReply emitting eventArgStr (reply heap).
  String describe(String prefix) => '$prefix: value=$_value';

  // NOT RPC-eligible — host owns the lifecycle. Codegen filters this
  // out by name.
  void dispose() {}
}

/// Stand-in for a controller-driven viewport widget. Takes the
/// controller as its first POSITIONAL parameter — the host pattern's
/// canonical convention. Real Flutter analogues: CameraPreview,
/// VideoPlayer, both `Foo(this.controller, {...})`.
class FakeViewer extends StatelessWidget {
  final FakeController controller;
  const FakeViewer(this.controller, {Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) => const Text('viewer');
}
