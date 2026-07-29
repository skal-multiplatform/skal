package com.skal.skal_flutter

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.android.RenderMode
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.embedding.engine.dart.DartExecutor

class MainActivity : FlutterActivity() {
    // Use the engine SkalHostApplication already built, instead of
    // letting FlutterActivity construct one on the critical path.
    //
    // Returning non-null makes the delegate treat the engine as
    // host-provided, so it will NOT run the Dart entrypoint itself —
    // which is why onCreate below has to. Returning null (cache miss,
    // prewarm failed) falls back to stock behaviour.
    override fun provideFlutterEngine(context: android.content.Context) =
        FlutterEngineCache.getInstance().get(SkalHostApplication.ENGINE_ID)

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        // Start Dart BEFORE super.onCreate so it overlaps the rest of
        // activity setup. Guarded on isExecutingDart so a warm activity
        // re-create does not try to run main() twice.
        FlutterEngineCache.getInstance()
            .get(SkalHostApplication.ENGINE_ID)
            ?.let { engine ->
                if (!engine.dartExecutor.isExecutingDart) {
                    engine.dartExecutor.executeDartEntrypoint(
                        DartExecutor.DartEntrypoint.createDefault())
                }
            }
        super.onCreate(savedInstanceState)
    }

    // ── Render mode ─────────────────────────────────────────────────
    //
    // FlutterActivity defaults to RenderMode.surface for an opaque
    // background: a dedicated BLAST SurfaceView layer that SurfaceFlinger
    // composites separately from the app window. An atrace of a cold
    // launch showed that layer and the system splash layer being
    // reconciled for 101 ms AFTER Flutter's content had already
    // presented.
    //
    // RenderMode.texture draws inside the normal view hierarchy, so
    // content and the splash reveal share one compositing path.
    //
    // MEASURED (Galaxy A14, release, D/E/D n=10, 8 ms drift):
    //   platform tax  167 -> 89 ms
    //   cold start    416 -> 352 ms      (-65 ms)
    //   scroll raster p50 1.70 -> 1.61, p90 3.11 -> 2.40, p99 9.41 -> 5.12
    //
    // The conventional objection is that TextureView adds a GPU copy per
    // frame and is slower for sustained rendering. Measured here it is
    // equal at p50 and BETTER at p90/p99 — that guidance largely predates
    // Impeller on Vulkan. But the copy cost scales with resolution and
    // scene complexity, so:
    //
    // OVERRIDE THIS BACK TO super.getRenderMode() IF YOU SEE trouble with
    // camera previews, video, or any platform view — TextureView is the
    // classic place those misbehave — or on a device where the extra copy
    // is bandwidth-bound. It is one line, and the measurement above is
    // one device and two screens, not a universal law.
    override fun getRenderMode(): RenderMode = RenderMode.texture
}
