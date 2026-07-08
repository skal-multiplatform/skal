// Dev-provided factory for the codegen HOST pattern.
//
// What this file is:
//
//   The `<Camera />` JSX symbol is backed by a Dart `_CameraHost`
//   StatefulWidget that the codegen synthesizes. That widget needs to
//   construct a `CameraController` at mount time, asynchronously, with
//   logic specific to the `camera` plugin (call `availableCameras()`,
//   pick one by name, instantiate the controller, await its
//   `initialize()`). None of that fits the generic codegen.
//
//   This file provides that one missing piece — a single async
//   function whose signature codegen reads to derive the JSX-side
//   props (`cameraName?`, `resolutionIndex`), and whose body codegen
//   awaits and assigns to the synthesized State's controller field.
//   See lib/skal_codegen.yaml's `hosts:` entry for the wiring.
//
//   The codegen handles EVERYTHING else: StatefulWidget boilerplate,
//   initState/dispose lifecycle, mounted-check on async completion,
//   error fallback rendering, NodeState → prop reading.
//
// What the dev has to write (this file):
//
//   ~15 lines of plugin-specific construction logic. Compare to the
//   prior "manual escape hatch" pattern (shimmer_manual.dart) which
//   needed the full ~30-line StatefulWidget + State + dispose + build
//   each time.

import 'package:camera/camera.dart';

/// Pick a camera and return an initialized [CameraController].
///
/// [cameraName] — exact name of the camera as reported by
/// `availableCameras()` (e.g. `'0'` for the rear camera on many
/// devices, `'1'` for front). If null, picks the first available.
///
/// [resolutionIndex] — index into [ResolutionPreset.values]. Common
/// values:
///   0 = low (320×240)
///   1 = medium (480×720)  ← default
///   2 = high (720×1280)
///   3 = veryHigh (1080×1920)
///   4 = ultraHigh (2160×3840)
///   5 = max (highest the device supports)
///
/// Throws [StateError] if no cameras are reported (simulator, no
/// permission, plugin-init failure). Codegen's synthesized host
/// catches the throw + renders an inline error widget.
Future<CameraController> createCamera({
  String? cameraName,
  int resolutionIndex = 1,
}) async {
  final cams = await availableCameras();
  if (cams.isEmpty) {
    throw StateError('no cameras available — permission denied, '
        'no hardware, or running on a simulator');
  }
  final picked = cameraName != null
      ? cams.firstWhere(
          (c) => c.name == cameraName,
          orElse: () => cams.first,
        )
      : cams.first;
  final controller = CameraController(
    picked,
    ResolutionPreset.values[resolutionIndex.clamp(
      0,
      ResolutionPreset.values.length - 1,
    )],
  );
  await controller.initialize();
  return controller;
}
