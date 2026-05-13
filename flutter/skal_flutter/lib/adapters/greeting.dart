// Example custom-widget adapter — a self-contained `<Greeting>` widget
// that exists ONLY to validate the SkalRegistry / wtCustom plumbing
// end-to-end. Not a useful widget on its own.
//
// What this file demonstrates for real third-party adapters:
//
//   1. A "wrapper" is just a Dart function that reads a NodeState's
//      custom props and returns a Flutter Widget. No bridge wiring
//      required beyond the one registerWidget call.
//
//   2. Prop reads use the typed `getCustomProp*(name, fallback)`
//      family on NodeState. Each call is a Map lookup, sub-µs.
//      Falling back to a sensible default keeps the adapter robust
//      when the JSX omits an optional prop.
//
//   3. Reactivity is automatic. The bridge's per-node cold notifier
//      fires whenever any prop on this node changes, the wrapping
//      MemoizingListenableBuilder reruns the build closure, and this
//      function gets called again with the updated NodeState. No
//      manual subscription needed.
//
//   4. The adapter is registered globally via SkalRegistry.registerWidget.
//      The dev calls registerAll() from their main() before runApp().
//      For codegen, a generator emits the same shape automatically.
//
// JSX usage (after configuring the babel macro + JS-side import):
//
//   import { Greeting } from 'skal-greeting';
//   <Greeting name="Skal" color="#FF1DA1F2" />
//
// This module's pair is `js-app/src/skal-greeting/index.js` (the JS
// component export + JSDoc types) and a vite.config.js entry adding
// 'skal-greeting' to the babel macro's `modules` option.

import 'package:flutter/material.dart';

import '../skal/node_state.dart';
import '../skal/bridge.dart';
import '../skal/registry.dart';

Widget _buildGreeting(NodeState n, SkalBridge bridge) {
  // Custom props are name-keyed strings — both ends of the bridge
  // agree on the names (the dev writes them in JSX, the adapter
  // reads them here). No enum table to keep in sync.
  final name = n.getCustomPropStr('name') ?? 'World';

  // Colors come over the wire as packed ARGB u32 (`0xAARRGGBB`).
  // JSX accepts CSS-style hex strings like `"#FF1DA1F2"` — the
  // renderer parses them on the JS side via parseColor() before
  // emitting the bridge op, so here we always see the u32 form.
  final colorArgb = n.getCustomPropU32('color', 0xFF000000);

  // Numeric size — accept either int or float via getCustomPropF32
  // (the renderer's _setCustomProperty dispatches integer-looking
  // values to U32 and float values to F32; either path round-trips
  // back to the same number here within precision).
  final fontSize = n.getCustomPropF32('fontSize', 24.0);

  return Padding(
    padding: const EdgeInsets.all(16),
    child: Text(
      'Hello, $name!',
      style: TextStyle(
        color: Color(colorArgb),
        fontSize: fontSize,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

/// Single entry point devs call from `main()`. Mirrors the shape
/// codegen will generate — `lib/generated/skal_adapters.g.dart`
/// will export the same `registerAll()` signature.
void registerAll() {
  SkalRegistry.registerWidget('greeting', _buildGreeting);
}
