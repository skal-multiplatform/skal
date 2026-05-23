// SkalRegistry — name-keyed dispatch table for custom (third-party)
// widgets and value types.
//
// Why this exists:
//
//   The built-in widgets (`<Column>`, `<ListView>`, …) live in the
//   bridge: enum-keyed types, dedicated `_buildForType` cases, full
//   compile-time knowledge of every prop. That's fast but closed —
//   adding `<GoogleMap>` would mean editing wire.dart + root.dart +
//   renderer.js, and re-shipping Skal for every Flutter package the
//   dev wants to use.
//
//   The registry opens that closed set. When JSX uses an unknown tag,
//   the renderer emits an opCreateCustomNode with the tag name. The
//   host looks the name up in this registry and runs the matching
//   builder — which is just a Dart function the dev (or codegen) wrote
//   knowing the target widget's constructor.
//
//   The dev's adapter for GoogleMap is ~5 lines. The codegen tool
//   produces the same 5 lines automatically for ~70% of Flutter
//   packages.
//
// Two kinds of registration:
//
//   • `registerWidget(name, builder)` — the builder returns a
//     [Widget], invoked by the bridge during `_buildForType` for
//     wtCustom nodes. This is what `<GoogleMap>`, `<VideoPlayer>`,
//     etc. register.
//
//   • `registerValue<T>(name, builder)` — the builder returns an
//     arbitrary Dart object (a `LatLng`, a `CameraPosition`, a
//     `Marker`). These are invoked by parent adapters via
//     `SkalBridge.buildValue<T>(nodeId)` to convert child nodes into
//     typed values. Lets JSX express structured data through child
//     elements:
//
//       <Map>
//         <Camera>
//           <LatLng lat={...} lng={...} />
//         </Camera>
//         <Marker><LatLng .../></Marker>
//       </Map>
//
//     where each inner tag is a value builder, not a widget.
//
// Lifecycle:
//
//   Registration is global (one process-wide table). Devs typically
//   register at app boot in `main.dart`:
//
//     void main() {
//       SkalRegistry.registerWidget('GoogleMap', _buildGoogleMap);
//       SkalRegistry.registerValue<LatLng>('LatLng', _buildLatLng);
//       runApp(SkalApp(...));
//     }
//
//   For codegen, the generator emits a `registerAll()` function in
//   `lib/generated/skal_adapters.g.dart` that the dev calls from
//   `main()`. Manual adapters and generated ones coexist — late
//   registration overrides earlier, so devs can shadow generated
//   defaults if they need different behavior.

import 'package:flutter/widgets.dart';

import 'bridge.dart';
import 'node_state.dart';

/// Builder for a custom widget. Returns the Flutter [Widget] that
/// should render for a given [NodeState]. The [SkalBridge] is passed
/// alongside so the builder can recurse — typically via
/// `bridge.buildWidget(childId)` or `bridge.buildValue<T>(childId)` —
/// when its constructor takes other widgets or structured values.
///
/// Reactivity: the bridge wraps each custom node in a
/// `MemoizingListenableBuilder` keyed on the node's `cold` notifier
/// (just like built-in widgets). So when any of the node's props
/// change, the builder re-runs with the latest values automatically.
/// Hot props (opacity/transform) are applied by the outer chrome and
/// don't trigger a rebuild.
typedef SkalWidgetBuilder = Widget Function(NodeState n, SkalBridge bridge);

/// Builder for a custom value type. Returns an arbitrary Dart object
/// (`LatLng`, `Marker`, `CameraPosition`, ...) constructed from the
/// node's props and children. Parent widget builders invoke this via
/// `bridge.buildValue<T>(nodeId)` — typically when iterating child
/// nodes that represent structured config:
///
/// ```dart
/// final markers = <Marker>{};
/// for (final id in n.childIds) {
///   final m = bridge.buildValue<Marker>(id);
///   if (m != null) markers.add(m);
/// }
/// ```
typedef SkalValueBuilder<T> = T Function(NodeState n, SkalBridge bridge);

/// Process-wide registry of custom widget + value builders.
///
/// All methods are static. Holds two maps internally; calling
/// `registerWidget('Foo', …)` followed by `registerWidget('Foo', …)`
/// replaces the first registration (handy for dev iteration). The
/// dispatch path uses `Map.[]` which is O(1).
class SkalRegistry {
  SkalRegistry._();

  static final Map<String, SkalWidgetBuilder> _widgets =
      <String, SkalWidgetBuilder>{};
  static final Map<String, SkalValueBuilder<Object?>> _values =
      <String, SkalValueBuilder<Object?>>{};

  /// Associate [name] with [builder] for widget dispatch. Subsequent
  /// nodes created from JSX with this tag (or programmatically with
  /// `wtCustom` + this name) will render via [builder].
  ///
  /// Re-registering the same name silently replaces. No warning — devs
  /// often re-register during hot reload, and codegen registrations
  /// run before manual ones (so devs can override generated builders
  /// by registering after).
  static void registerWidget(String name, SkalWidgetBuilder builder) {
    _widgets[name] = builder;
  }

  /// Associate [name] with a value builder. Parent widget builders
  /// look up these via `bridge.buildValue<T>(childId)` to convert
  /// nodes representing structured config into typed Dart values.
  ///
  /// The generic [T] is the value's type. The registry erases it
  /// internally (stored as `Object?` returner) but `buildValue<T>`
  /// casts on the way out, so consumers stay typed.
  static void registerValue<T>(String name, SkalValueBuilder<T> builder) {
    _values[name] = (n, b) => builder(n, b) as Object?;
  }

  /// Internal — looked up by `_buildForType` in `root.dart` when it
  /// hits a wtCustom node. Returns the builder, or null if no match
  /// (the bridge renders an error placeholder in that case).
  static SkalWidgetBuilder? widgetBuilderFor(String name) => _widgets[name];

  /// Internal — looked up by `SkalBridge.buildValue<T>`. Returns the
  /// type-erased builder; the bridge casts to [T] at the call site.
  static SkalValueBuilder<Object?>? valueBuilderFor(String name) =>
      _values[name];

  /// Test-only: drop every registration. Don't call from production
  /// code — registry state is process-wide and resetting it midway
  /// through a frame leaves orphan nodes pointing at nonexistent
  /// builders.
  @visibleForTesting
  static void resetForTesting() {
    _widgets.clear();
    _values.clear();
  }

  /// Names currently registered for widget dispatch — useful for
  /// debugging / building dev-only diagnostic UI. Returns a snapshot;
  /// the live map isn't exposed.
  static List<String> get registeredWidgetNames =>
      List<String>.unmodifiable(_widgets.keys);

  /// Names currently registered for value dispatch.
  static List<String> get registeredValueNames =>
      List<String>.unmodifiable(_values.keys);
}
