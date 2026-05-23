// Test fixture for the codegen's HOST-ADAPTER pattern — used to wrap
// widgets whose required constructor params include a controller-shaped
// runtime object that can't be encoded directly over the bridge.
//
// The codegen synthesizes:
//
//   1. A private StatefulWidget that carries JSX-side props.
//   2. Its State, which constructs a controller in initState (sync OR
//      async) via the dev-provided factory function.
//   3. The build method renders the wrapped widget with the
//      controller, falling back to SizedBox.shrink while pending or
//      an error widget on failure.
//   4. A `_build_<JsxName>` registry entry that maps NodeState → the
//      StatefulWidget's constructor params.
//
// This fixture provides:
//
//   • `makeFakeViewerSync` — a sync factory returning `FakeController`.
//     Validates the non-async emission shape.
//
//   • `makeFakeViewerAsync` — an async factory (`Future<FakeController>`).
//     Validates the `await` injection.
//
// Both reference FakeController + FakeViewer from _fake_flutter.dart.

import '_fake_flutter.dart';

/// Sync factory — returns the controller directly. Codegen should NOT
/// emit `await` for this one.
FakeController makeFakeViewerSync({int initial = 0}) {
  return FakeController(initial: initial);
}

/// Async factory — returns a Future. Codegen MUST emit `await` here
/// so the State's _ctl is the unwrapped FakeController, not a Future.
Future<FakeController> makeFakeViewerAsync({int initial = 7}) async {
  return FakeController(initial: initial);
}
