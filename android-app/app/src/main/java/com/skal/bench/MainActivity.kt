package com.skal.bench

import android.app.Activity
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.skal.Skal
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
        val skal = Skal()
        val initMs = (System.nanoTime() - initStart) / 1_000_000.0

        val source = assets.open("skal-app.js").bufferedReader().use { it.readText() }
        val evalStart = System.nanoTime()
        val initResult = skal.evaluate(source, "skal-app.js")
        val evalMs = (System.nanoTime() - evalStart) / 1_000_000.0
        Log.i(TAG, "skal init=${"%.1f".format(initMs)}ms eval=${"%.1f".format(evalMs)}ms result=$initResult")

        val bridge = SkalBridge(skal)
        bridge.pumpOps()
        bridge.ensureRoot()

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    DemoChrome(initMs, evalMs) {
                        SkalRoot(bridge)
                    }
                }
            }
        }
    }
}

@Composable
private fun DemoChrome(initMs: Double, evalMs: Double, content: @Composable () -> Unit) {
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
        Spacer(Modifier.height(8.dp))
        Box(modifier = Modifier.fillMaxWidth()) {
            content()
        }
    }
}
