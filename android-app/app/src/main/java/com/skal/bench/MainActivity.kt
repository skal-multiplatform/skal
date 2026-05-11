package com.skal.bench

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.skal.createSkal
import com.skal.bridge.SkalBridge
import com.skal.bridge.SkalRoot

private const val TAG = "SkalBench"

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Load + initialize the JS app off the UI thread, then mount the
        // bridge once it's ready. We block the UI briefly here for the demo;
        // a real app would show a loader and skip recomposition until ready.
        val initStart = System.nanoTime()
        // createSkal() is the multiplatform factory in shared/ — on JVM
        // it returns a SkalRuntime backed by the JNI-loaded com.skal.Skal
        // Java class (which still owns the libskal.so loadLibrary call).
        val skal = createSkal()
        val initMs = (System.nanoTime() - initStart) / 1_000_000.0

        val evalStart = System.nanoTime()
        val initResult = if (BuildConfig.DEBUG) {
            // Debug: load the Vite IIFE bundle and evaluate as a Program.
            // Re-parses every launch. Sets us up for hot-reload later — a
            // debug channel can push updated source for re-evaluation.
            val source = assets.open("skal-app.js").bufferedReader().use { it.readText() }
            skal.evaluate(source, "skal-app.js")
        } else {
            // Release: extract the bun-built CJS bundle + its .jsc bytecode
            // sibling from APK assets to filesDir, then dynamic-import the
            // .cjs path. Bun's module loader sees the @bun @bytecode @bun-cjs
            // marker in the source header, looks for a sibling .jsc, attaches
            // its bytes as a CachedBytecode on the SourceProvider, and JSC's
            // parser short-circuits — no per-launch parse cost.
            //
            // Files are extracted on every launch (cheap — ~250 KB write)
            // because we don't yet track APK install timestamps to skip the
            // copy when unchanged. Could be optimized later.
            val cjsPath = extractAsset("skal-app.cjs")
            extractAsset("skal-app.cjs.jsc")
            skal.evaluateModuleAtPath(cjsPath)
        }
        val evalMs = (System.nanoTime() - evalStart) / 1_000_000.0
        Log.i(TAG, "skal init=${"%.1f".format(initMs)}ms eval=${"%.1f".format(evalMs)}ms result=$initResult")

        val bridge = SkalBridge(skal)
        bridge.pumpOps()
        bridge.ensureRoot()

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    DemoChrome(initMs, evalMs, bridge) {
                        SkalRoot(bridge)
                    }
                }
            }
        }
    }

    /**
     * Copy [name] from the APK's assets/ directory into the app's filesDir
     * — but skip the copy if the destination already matches the APK's
     * lastModified time (i.e. nothing was upgraded since the last launch).
     *
     * Background: the release path needs `skal-app.cjs` + `.cjs.jsc` on
     * a real filesystem so bun's module loader can `await import(file://…)`
     * them with the bytecode cache attached. APK assets aren't mmap'd as
     * regular files (they're inside the .apk's zip stream), so we extract
     * once. Re-extracting on every launch costs ~1-10 ms for the 250 KB
     * pair — small but unnecessary on warm launches where the APK install
     * timestamp hasn't changed.
     *
     * Strategy: stash the APK's lastModified time in a sibling marker
     * file (`<name>.mtime`). If marker matches the current APK and the
     * extracted file is on disk, skip the copy. Otherwise, copy and
     * write the new marker.
     *
     * Per TODO_PLATFORMS § 2.5.
     */
    private fun extractAsset(name: String): String {
        val outFile = filesDir.resolve(name)
        val markerFile = filesDir.resolve("$name.apk-mtime")

        // The .apk's lastModified jumps on every install/upgrade — even
        // for sideloads via `adb install -r`. PackageManager surfaces it
        // as ApplicationInfo.sourceDir's mtime; we read it directly rather
        // than via PackageInfo.lastUpdateTime (the latter rounds to whole
        // seconds and is sometimes unset on dev builds).
        val apkMtime = applicationInfo.sourceDir?.let { java.io.File(it).lastModified() } ?: 0L
        val markerMtime = if (markerFile.exists()) markerFile.readText().toLongOrNull() ?: -1L else -1L

        if (outFile.exists() && markerMtime == apkMtime && apkMtime > 0L) {
            // Already extracted from this APK install — skip the copy.
            return outFile.absolutePath
        }

        assets.open(name).use { input ->
            outFile.outputStream().use { output ->
                input.copyTo(output)
            }
        }
        // Write the marker AFTER the file is fully on disk so a crash
        // mid-copy leaves the marker stale → next launch re-extracts.
        markerFile.writeText(apkMtime.toString())
        return outFile.absolutePath
    }
}

@Composable
private fun DemoChrome(
    initMs: Double,
    evalMs: Double,
    bridge: SkalBridge,
    content: @Composable () -> Unit,
) {
    androidx.compose.foundation.layout.Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
    ) {
        Text(
            text = "Skal — Solid in JS, Compose rendering",
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            text = "init ${"%.1f".format(initMs)} ms · first eval ${"%.1f".format(evalMs)} ms",
            fontFamily = FontFamily.Monospace,
            style = MaterialTheme.typography.bodySmall,
        )
        PerfHud(bridge)
        Spacer(Modifier.height(8.dp))
        // Box takes remaining vertical space so the SkalScrollColumn inside
        // SkalRoot has a bounded height (verticalScroll requires it).
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            content()
        }
    }
}

/**
 * Live perf overlay. Two numbers:
 *
 *  • **FPS** — derived from the gap between `withFrameNanos` callbacks,
 *    averaged over the last 30 frames. This measures whether the
 *    Choreographer is firing at vsync rate. Drops below the device's
 *    refresh rate (60/90/120) mean we missed frames.
 *
 *  • **pump** — exponential moving average of [SkalBridge.pumpAvgNs],
 *    which is updated *only* on frames that actually drained ops. So this
 *    is "drain cost when there's work to do," not "average cost across all
 *    frames." Idle frames (no signal flips) don't contribute to the EMA.
 *
 * Cost: one subtract + one ring-buffer write per frame, plus one Compose
 * state mutation throttled to ~6 Hz. < 0.1% CPU; well below the
 * `System.nanoTime()` noise floor.
 */
@Composable
private fun PerfHud(bridge: SkalBridge) {
    var displayText by remember { mutableStateOf("warming up…") }

    LaunchedEffect(bridge) {
        var lastFrameNs = 0L
        val deltas = LongArray(30)
        var deltaIdx = 0
        var deltaCount = 0
        var deltaSum = 0L
        var throttle = 0

        while (true) {
            withFrameNanos { frameTimeNs ->
                if (lastFrameNs != 0L) {
                    val delta = frameTimeNs - lastFrameNs
                    // Sliding window with running sum: replace the oldest
                    // entry, adjust sum by (new - old). O(1) per frame.
                    if (deltaCount == deltas.size) {
                        deltaSum -= deltas[deltaIdx]
                    } else {
                        deltaCount++
                    }
                    deltas[deltaIdx] = delta
                    deltaSum += delta
                    deltaIdx = (deltaIdx + 1) % deltas.size

                    // Throttle the state update so we don't recompose the
                    // Text 60×/sec for a number humans can't read that fast.
                    if (++throttle >= 10) {
                        throttle = 0
                        val avgFrameNs = deltaSum / deltaCount
                        val avgFrameMs = avgFrameNs / 1_000_000.0
                        val fps = (1_000_000_000.0 / avgFrameNs).toInt()
                        val pumpMs = bridge.pumpAvgNs / 1_000_000.0
                        val peakMs = bridge.pumpPeakNs / 1_000_000.0
                        val propWrites = bridge.propWritesLastDrain
                        val propTouched = bridge.coldPropsTouchedLastDrain
                        displayText = "$fps FPS (${"%.2f".format(avgFrameMs)} ms) · " +
                            "pump ${"%.3f".format(pumpMs)} ms (peak ${"%.2f".format(peakMs)} ms) · " +
                            "props ${propWrites}/${propTouched}"
                    }
                }
                lastFrameNs = frameTimeNs
            }
        }
    }

    Text(
        text = displayText,
        fontFamily = FontFamily.Monospace,
        style = MaterialTheme.typography.bodySmall,
    )
}
