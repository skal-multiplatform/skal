package com.skal.skal_flutter

import io.flutter.FlutterInjector
import io.flutter.app.FlutterApplication
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.FlutterEngineCache
import io.flutter.plugins.GeneratedPluginRegistrant

// Android cold-start optimisations for a Skal host.
//
// Measured on a Galaxy A14 5G (Android 15, release, arm64-v8a), A/B/A
// blocks with session drift quantified — see docs/ANDROID_COLD_START.md
// for the full protocol and the things that did NOT work.
//
// The structural problem: React Native loads its native runtime in
// Application.onCreate (~28 ms, off the activity critical path), while a
// stock FlutterActivity creates the engine inside its own onCreate — 77 ms
// ON the critical path. These two hooks move Skal onto RN's footing.
//
//   loader pre-warm    -8 ms   activity_create_done 114 -> 106 ms
//   engine pre-create  -23 ms  js_done 264 -> 238 ms
//
// Both are best-effort: every failure path falls back to exactly the
// stock behaviour, because a cold-start optimisation that can brick
// startup is not an optimisation.
class SkalHostApplication : FlutterApplication() {
    companion object {
        /// Cache key the activity uses to pick the pre-created engine up.
        const val ENGINE_ID = "skal-host-engine"
    }

    override fun onCreate() {
        super.onCreate()

        // ── Pre-warm the Flutter native loader ──────────────────────
        //
        // startInitialization does the libflutter.so load and resource
        // extraction. FlutterActivity.onCreate would otherwise do it
        // synchronously; starting here lets it overlap activity
        // dispatch, theme resolution and window setup.
        try {
            FlutterInjector.instance().flutterLoader().startInitialization(this)
        } catch (t: Throwable) {
            android.util.Log.w("skal", "flutter loader prewarm skipped: $t")
        }

        // ── Pre-create the FlutterEngine ────────────────────────────
        //
        // This is the bigger half: constructing the engine (VM start,
        // isolate setup) is what the 77 ms actually was — pre-warming the
        // loader alone only recovered 8 of it.
        //
        // The Dart entrypoint is deliberately NOT executed here.
        // MainActivity runs it before super.onCreate, which keeps the
        // door open for hosts that need to pass entrypoint arguments
        // derived from the launch intent.
        //
        // Plugins are registered HERE, before Dart starts, because
        // main() awaits getApplicationSupportDirectory() almost
        // immediately — registering later races it. ActivityAware
        // plugins (camera) still receive onAttachedToActivity when the
        // engine attaches to MainActivity, so early registration is
        // safe for them.
        try {
            val engine = FlutterEngine(this)
            GeneratedPluginRegistrant.registerWith(engine)
            FlutterEngineCache.getInstance().put(ENGINE_ID, engine)
        } catch (t: Throwable) {
            android.util.Log.w("skal", "engine prewarm skipped: $t")
        }
    }
}
