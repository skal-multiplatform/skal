package com.skal.ios

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.window.ComposeUIViewController
import com.skal.SkalRuntime
import com.skal.createSkal
import com.skal.bridge.SkalBridge
import com.skal.bridge.SkalRoot
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSBundle
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.stringWithContentsOfFile
import platform.UIKit.UIViewController

/**
 * Entry point used by an Xcode app to obtain a UIViewController hosting
 * the Compose UI. Swift code looks like:
 *
 *     import Skal
 *     // ...
 *     let controller = MainKt.MainViewController()
 *     // present `controller` — e.g. set as `UIWindow.rootViewController`
 *
 * Compose Multiplatform's `ComposeUIViewController` does the heavy
 * lifting: spins up its own `MTKView`-backed Skia surface, hooks
 * `UIWindow` lifecycle into the Compose recomposer, and forwards
 * UIKit touch events into Compose's input pipeline.
 */
@OptIn(ExperimentalForeignApi::class)
@Suppress("FunctionName") // mirrors the SwiftUI/UIKit convention for factory fns
fun MainViewController(): UIViewController = ComposeUIViewController {
    val runtime: SkalRuntime = createSkal()

    // Load + evaluate skal-app.js (or .cjs+.jsc bytecode) out of the
    // .app bundle, then mount the SkalBridge against the same runtime.
    //
    // Two paths, mirroring desktop-app's Main.kt:
    //   * Bytecode-cached: feed bun the .cjs file via
    //     evaluateModuleAtPath. Bun's module loader spots the @bun
    //     @bytecode marker, reads the sibling .cjs.jsc bytecode,
    //     attaches it to JSC's SourceProvider, and the parser
    //     short-circuits — no parse cost. CRITICAL on iOS because
    //     JSC's JIT is disabled in third-party iOS apps; the
    //     interpreter would otherwise re-parse the entire bundle on
    //     every cold start. Saves ~500-700 ms.
    //   * Source eval: fallback to `evaluate(source, …)` when the
    //     bytecode pair is missing (e.g. dev builds where Vite
    //     hasn't produced .jsc yet).
    val bundleStatus = remember {
        try {
            val cjsPath = NSBundle.mainBundle.pathForResource("skal-app", "cjs")
            val jscPath = NSBundle.mainBundle.pathForResource("skal-app.cjs", "jsc")
            if (cjsPath != null && jscPath != null) {
                val result = runtime.evaluateModuleAtPath(cjsPath)
                "bytecode → $result"
            } else {
                val path = NSBundle.mainBundle.pathForResource("skal-app", "js")
                    ?: return@remember "skal-app.js not in bundle Resources/"
                val source = NSString.stringWithContentsOfFile(path, NSUTF8StringEncoding, null)
                    ?: return@remember "skal-app.js empty / read failed"
                val result = runtime.evaluate(source as String, "skal-app.js")
                "source (${(source as String).length} chars) → $result"
            }
        } catch (t: Throwable) {
            "${t::class.simpleName}: ${t.message}"
        }
    }

    val bridge = remember { SkalBridge(runtime).also { it.pumpOps(); it.ensureRoot() } }

    SkalIosScaffold(runtime, bundleStatus, bridge)
}

/**
 * Top-of-screen status + the actual SkalRoot composable mounting the JS
 * tree below. The status block is small and only computes once per
 * composition; SkalRoot drives every frame from then on.
 */
@Composable
private fun SkalIosScaffold(
    runtime: SkalRuntime,
    bundleStatus: String,
    bridge: SkalBridge,
) {
    val runtimeKind = runtime::class.simpleName ?: "SkalRuntime"
    val probe = remember {
        try {
            "1+2 = ${runtime.evaluate("1+2", "skal:probe")}"
        } catch (t: Throwable) {
            "${t::class.simpleName}: ${t.message}"
        }
    }
    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxSize().padding(16.dp),
            ) {
                Text(
                    text = "Skal — iOS · real bun runtime",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = "$runtimeKind · $probe",
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    text = "skal-app.js: $bundleStatus",
                    style = MaterialTheme.typography.bodySmall,
                )
                PerfHud(bridge)
                Box(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    SkalRoot(bridge)
                }
            }
        }
    }
}

/**
 * Same FPS + pump-time HUD as `desktop-app`'s `PerfHud` and `android-app`'s
 * `MainActivity.PerfHud`. Reading [SkalBridge.pumpAvgNs] / [SkalBridge.pumpPeakNs]
 * each tick gives a quick read on whether the bridge is keeping up with
 * the per-frame op stream.
 *
 * On iOS the host display is typically 120 Hz on ProMotion devices (the
 * Info.plist sets `CADisableMinimumFrameDurationOnPhone: true` so Compose
 * isn't capped to 60 Hz). The 30-frame rolling window covers ~250 ms at
 * 120 Hz — long enough to smooth jitter, short enough that a sudden +200
 * batch is still visible.
 *
 * Mirrors the readings to `println()` (which becomes `NSLog` on iOS, visible
 * via `xcrun simctl spawn booted log stream --predicate 'eventMessage CONTAINS "SkalIos"'`
 * or in Xcode's console). The throttle is `pad6` so we emit at ~1 sec on a
 * 60 Hz host and ~0.5 sec on 120 Hz — cheap, no risk of drowning the log.
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
        var stdoutThrottle = 0
        while (true) {
            withFrameNanos { frameTimeNs ->
                if (lastFrameNs != 0L) {
                    val delta = frameTimeNs - lastFrameNs
                    if (deltaCount == deltas.size) deltaSum -= deltas[deltaIdx]
                    else deltaCount++
                    deltas[deltaIdx] = delta
                    deltaSum += delta
                    deltaIdx = (deltaIdx + 1) % deltas.size
                    if (++throttle >= 10) {
                        throttle = 0
                        val avgFrameNs = deltaSum / deltaCount
                        val avgFrameMs = avgFrameNs / 1_000_000.0
                        val fps = (1_000_000_000.0 / avgFrameNs).toInt()
                        val pumpMs = bridge.pumpAvgNs / 1_000_000.0
                        val peakMs = bridge.pumpPeakNs / 1_000_000.0
                        // Kotlin's %.Xf on Native goes through NumberFormat which
                        // can pull in a chunky locale resolver; format manually.
                        displayText = "$fps FPS (${avgFrameMs.toFixed2()} ms) · " +
                            "pump ${pumpMs.toFixed3()} ms (peak ${peakMs.toFixed2()} ms)"
                        if (++stdoutThrottle >= 6) {
                            stdoutThrottle = 0
                            println("[SkalIos] $displayText")
                        }
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

/** Lightweight `%.2f` replacement — avoids Kotlin/Native's NumberFormat. */
private fun Double.toFixed2(): String {
    val rounded = ((this * 100).toLong()).toString()
    return when {
        rounded.length <= 2 -> "0.${rounded.padStart(2, '0')}"
        else -> "${rounded.dropLast(2)}.${rounded.takeLast(2)}"
    }
}

/** Lightweight `%.3f` replacement. */
private fun Double.toFixed3(): String {
    val rounded = ((this * 1000).toLong()).toString()
    return when {
        rounded.length <= 3 -> "0.${rounded.padStart(3, '0')}"
        else -> "${rounded.dropLast(3)}.${rounded.takeLast(3)}"
    }
}
