package com.skal.desktop

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.MenuBar
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.WindowPosition
import androidx.compose.ui.window.WindowState
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import java.util.prefs.Preferences
import com.skal.createSkal
import com.skal.bridge.SkalBridge
import com.skal.bridge.SkalRoot
import java.io.File

// JS bundle source paths — same artifacts the android-app's APK ships
// (assets/skal-app.{js,cjs,cjs.jsc}). We resolve them out of the
// monorepo's android-app/assets/ during `:run` so iterating on the
// Solid app via `js-app && bun run build` is picked up on next launch
// without a desktop-app rebuild. (TODO_PLATFORMS § 3.6: switch to a
// Compose Desktop resource for `:packageDmg` so the .dmg is
// self-contained.)
private val ASSETS_DIR = File(System.getProperty("user.dir"), "../android-app/app/src/main/assets")
private val SKAL_APP_JS = File(ASSETS_DIR, "skal-app.js")
private val SKAL_APP_CJS = File(ASSETS_DIR, "skal-app.cjs")
private val SKAL_APP_JSC = File(ASSETS_DIR, "skal-app.cjs.jsc")

fun main() {
    // ── Runtime init OUTSIDE the application { } composable scope ─────
    //
    // `application { ... }` is a @Composable lambda — anything inside
    // re-runs on every recomposition (e.g. window resize / drag, which
    // mutate WindowState). An earlier version had createSkal() + the
    // evaluate() pair inside the lambda; a single 30-second run logged
    // 1,139 [SkalDesktop] init lines, each one leaking a fresh JSC VM
    // + 2 MiB bridge buffer + bun worker thread. We block the JVM main
    // thread here for the demo; a real app would show a loader and
    // skip rendering until ready (TODO_PLATFORMS § 3.7).
    val initStart = System.nanoTime()
    // createSkal() is the multiplatform factory in shared/ — on JVM
    // it wraps the JNI-loaded com.skal.Skal class as a SkalRuntime.
    val skal = createSkal()
    val initMs = (System.nanoTime() - initStart) / 1_000_000.0

    // Two evaluation paths, matching android-app's debug-vs-release
    // split (TODO_PLATFORMS § 3.6):
    //   * Bytecode-cached: feed bun the .cjs file via
    //     evaluateModuleAtPath. Bun's module loader spots the @bun
    //     @bytecode marker, reads the sibling .cjs.jsc bytecode,
    //     attaches it to JSC's SourceProvider, and the parser
    //     short-circuits — no parse cost. Saves ~500-700 ms cold
    //     on this 18 KB Solid bundle.
    //   * Source eval: `evaluate(source, …)`, re-parses every launch.
    //     Used only as a fallback when the bytecode pair is missing
    //     (e.g. fresh checkout where `js-app && bun run build` hasn't
    //     produced the .jsc yet) or has drifted from libskal's JSC
    //     version (TODO_PLATFORMS § 1.7 — bytecode cache validation).
    val evalStart = System.nanoTime()
    val (initResult, evalKind) = if (SKAL_APP_CJS.exists() && SKAL_APP_JSC.exists()) {
        skal.evaluateModuleAtPath(SKAL_APP_CJS.absolutePath) to "bytecode"
    } else {
        skal.evaluate(SKAL_APP_JS.readText(), "skal-app.js") to "source"
    }
    val evalMs = (System.nanoTime() - evalStart) / 1_000_000.0
    println("[SkalDesktop] init=${"%.1f".format(initMs)}ms eval=${"%.1f".format(evalMs)}ms ($evalKind) result=$initResult")

    val bridge = SkalBridge(skal)
    bridge.pumpOps()
    bridge.ensureRoot()

    application {
        // Window-state persistence (TODO_PLATFORMS § 3.5). Stash size +
        // position in java.util.prefs so the user's last layout survives
        // restarts. Preferences-backed because:
        //   - Cross-platform out-of-the-box (no extra dep);
        //   - Tiny payload (4 ints + 2 floats);
        //   - macOS persists under ~/Library/Preferences/com.skal.plist
        //     which Time Machine + iCloud back up by default.
        val prefs = Preferences.userRoot().node("com/skal/desktop/window")
        val initialWidth = prefs.getFloat("width", 420f)
        val initialHeight = prefs.getFloat("height", 800f)
        val initialX = prefs.getFloat("x", Float.NaN)
        val initialY = prefs.getFloat("y", Float.NaN)
        val windowState = rememberWindowState(
            size = DpSize(initialWidth.dp, initialHeight.dp),
            position = if (initialX.isNaN() || initialY.isNaN()) {
                WindowPosition.PlatformDefault
            } else {
                WindowPosition(initialX.dp, initialY.dp)
            },
        )

        Window(
            onCloseRequest = {
                // Persist whatever the user resized/dragged the window to,
                // then quit. State is read on next launch.
                prefs.putFloat("width", windowState.size.width.value)
                prefs.putFloat("height", windowState.size.height.value)
                prefs.putFloat("x", windowState.position.x.value)
                prefs.putFloat("y", windowState.position.y.value)
                prefs.flush()
                exitApplication()
            },
            title = "Skal — Solid in JS, Compose Desktop rendering",
            state = windowState,
        ) {
            // Native menu bar — File ▸ Quit. macOS surfaces this in the
            // global menu bar (top of screen) instead of inside the
            // window. ⌘Q via the system shortcut works without an
            // explicit `shortcut =` because Apple's menu wires it up.
            MenuBar {
                Menu("File", mnemonic = 'F') {
                    Item("Quit Skal", onClick = ::exitApplication)
                }
            }

            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    DemoChrome(initMs, evalMs, bridge) {
                        SkalRoot(bridge)
                    }
                }
            }
        }
    }
}

@Composable
private fun DemoChrome(
    initMs: Double,
    evalMs: Double,
    bridge: SkalBridge,
    content: @Composable () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text(
            text = "Skal — Desktop · Solid in JS, Compose rendering",
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            text = "init ${"%.1f".format(initMs)} ms · first eval ${"%.1f".format(evalMs)} ms",
            fontFamily = FontFamily.Monospace,
            style = MaterialTheme.typography.bodySmall,
        )
        PerfHud(bridge)
        Spacer(Modifier.height(8.dp))
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            content()
        }
    }
}

/** Same FPS + pump-time HUD as android-app's MainActivity, no Android deps. */
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
                        val propWrites = bridge.propWritesLastDrain
                        val propTouched = bridge.coldPropsTouchedLastDrain
                        displayText = "$fps FPS (${"%.2f".format(avgFrameMs)} ms) · " +
                            "pump ${"%.3f".format(pumpMs)} ms (peak ${"%.2f".format(peakMs)} ms) · " +
                            "props ${propWrites}/${propTouched}"
                        // Mirror to stdout so headless / log-captured runs can
                        // see steady-state FPS without a screen recorder.
                        // Once per ~1 sec at 60Hz (HUD refresh = 10 frames,
                        // and we throttle the println to every 6th HUD tick =
                        // ~1 sec). Avoids drowning the log on long sessions.
                        if (++stdoutThrottle >= 6) {
                            stdoutThrottle = 0
                            println("[SkalDesktop] $displayText")
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
