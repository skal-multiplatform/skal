package com.skal.bench

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import com.skal.Skal

private const val TAG = "SkalBench"

class MainActivity : Activity() {

    private lateinit var output: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 96, 48, 48)
            setBackgroundColor(Color.parseColor("#0d1117"))
        }
        val title = TextView(this).apply {
            text = "Skal — bun runtime on Android"
            textSize = 18f
            setTextColor(Color.parseColor("#58a6ff"))
            setPadding(0, 0, 0, 24)
            typeface = Typeface.DEFAULT_BOLD
        }
        output = TextView(this).apply {
            textSize = 13f
            setTextColor(Color.parseColor("#c9d1d9"))
            typeface = Typeface.MONOSPACE
            gravity = Gravity.START or Gravity.TOP
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
            text = "Loading libskal.so…"
        }
        root.addView(title)
        root.addView(output)
        setContentView(root)

        // Run the benchmark off the UI thread so we don't ANR if the
        // runtime takes a moment to spin up.
        Thread { runBenchmark() }.start()
    }

    private fun runBenchmark() {
        log("creating runtime…")
        val initStart = System.nanoTime()
        val skal = Skal()
        val initMs = (System.nanoTime() - initStart) / 1_000_000.0
        log(String.format("✓ runtime ready in %.1f ms", initMs))

        // ── 1: JSON.stringify + JSON.parse of ~1 MB ─────────────────
        log("")
        log("── JSON: stringify + parse of ~1 MB ──")
        val jsonStart = System.nanoTime()
        val jsonResult = skal.evaluate(JSON_BENCH_JS, "json-bench.js")
        val jsonMs = (System.nanoTime() - jsonStart) / 1_000_000.0
        Log.i(TAG, "JSON: $jsonResult")
        log("native-call wall: ${"%.1f".format(jsonMs)} ms")
        log(jsonResult ?: "(null)")

        // ── 2: SHA-256 of 1 MB via Bun.CryptoHasher (sync) ─────────
        log("")
        log("── SHA-256 of 1 MB — Bun.CryptoHasher (sync, ×20) ──")
        val shaStart = System.nanoTime()
        val shaResult = skal.evaluate(SHA256_BENCH_JS, "sha256-bench.js")
        val shaMs = (System.nanoTime() - shaStart) / 1_000_000.0
        Log.i(TAG, "SHA-256 sync: $shaResult")
        log("native-call wall: ${"%.1f".format(shaMs)} ms")
        log(shaResult ?: "(null)")

        // ── 3: SHA-256 of 1 MB via crypto.subtle.digest (async) ────
        log("")
        log("── SHA-256 of 1 MB — crypto.subtle (async, ×20) ──")
        val webStart = System.nanoTime()
        val webResult = skal.evaluate(WEB_CRYPTO_SHA256_BENCH_JS, "websubtle-bench.js")
        val webMs = (System.nanoTime() - webStart) / 1_000_000.0
        Log.i(TAG, "SHA-256 web crypto: $webResult")
        log("native-call wall: ${"%.1f".format(webMs)} ms")
        log(webResult ?: "(null)")

        // ── 3: Async — proves the event loop is actually running ───
        log("")
        log("── async (Web Crypto + setTimeout) ──")
        val asyncStart = System.nanoTime()
        val asyncResult = skal.evaluate(ASYNC_BENCH_JS, "async-bench.js")
        val asyncMs = (System.nanoTime() - asyncStart) / 1_000_000.0
        Log.i(TAG, "Async: $asyncResult")
        log("native-call wall: ${"%.1f".format(asyncMs)} ms")
        log(asyncResult ?: "(null)")

        // Intentionally NOT calling skal.close(): bun's VirtualMachine
        // teardown is wired for process-exit cleanup (destructMainThreadOnExit).
        // For an embed we leak the VM until the process dies — same lifetime
        // model as Hermes/JSC in React Native.
        //
        // Also: bun installs pthread thread-exit hooks that crash when the
        // *thread that initialized the VM* terminates. Park this thread so
        // we don't trigger the hooks during normal Kotlin Thread teardown.
        // The OS reaps it on activity destroy.
        try {
            Thread.currentThread().join()
        } catch (_: InterruptedException) {
        }
    }

    private fun log(line: String) {
        Log.i(TAG, line)
        runOnUiThread {
            output.text = "${output.text}\n$line"
        }
    }

    companion object {
        // Build an object that stringifies to ~1 MB. Time stringify + parse.
        // Uses Date.now() — ms granularity is fine for 100+ ms operations.
        private const val JSON_BENCH_JS = """
            (() => {
              const buildStart = Date.now();
              const items = new Array(9500);
              for (let i = 0; i < items.length; i++) {
                items[i] = {
                  id: i,
                  uuid: '00000000-0000-4000-8000-' + (i * 1234567).toString(16).padStart(12, '0'),
                  name: 'item-' + i,
                  active: (i & 1) === 0,
                  score: (i * 1.234567) % 1000,
                  tags: ['alpha', 'beta', 'gamma', 'delta'],
                  meta: { created: Date.now() - i * 1000, weight: i / items.length }
                };
              }
              const root = { kind: 'skal-bench', count: items.length, items };
              const buildMs = Date.now() - buildStart;

              const t1 = Date.now();
              const json = JSON.stringify(root);
              const t2 = Date.now();
              const parsed = JSON.parse(json);
              const t3 = Date.now();

              const MB = 1024 * 1024;
              const bytes = json.length;

              return JSON.stringify({
                jsonSize: (bytes / MB).toFixed(2) + ' MB',
                jsonBytes: bytes,
                items: items.length,
                buildMs,
                stringifyMs: t2 - t1,
                parseMs: t3 - t2,
                totalMs: t3 - t1,
                parsedItemCount: parsed.items.length
              }, null, 2);
            })()
        """

        // Hash 1 MB of random bytes with SHA-256, 20 iterations for a stable
        // average. Uses Bun.CryptoHasher (synchronous, BoringSSL-backed) —
        // crypto.subtle.digest exists too but returns a Promise, which our
        // single-shot eval doesn't pump the event loop for.
        private const val SHA256_BENCH_JS = """
            (() => {
              const SIZE = 1024 * 1024; // 1 MB
              const ITERS = 20;

              const buf = new Uint8Array(SIZE);
              // crypto.getRandomValues is capped at 64 KB per call.
              for (let i = 0; i < SIZE; i += 65536) {
                crypto.getRandomValues(buf.subarray(i, Math.min(i + 65536, SIZE)));
              }

              // Warm-up — first hash includes JIT tier-up cost.
              new Bun.CryptoHasher('sha256').update(buf).digest('hex');

              let lastHash = '';
              const t1 = performance.now();
              for (let i = 0; i < ITERS; i++) {
                const h = new Bun.CryptoHasher('sha256');
                h.update(buf);
                lastHash = h.digest('hex');
              }
              const elapsedMs = performance.now() - t1;

              const perIterMs = elapsedMs / ITERS;
              const mbPerSec = (SIZE / (1024 * 1024)) / (perIterMs / 1000);

              return JSON.stringify({
                bytes: SIZE,
                iterations: ITERS,
                totalMs: +elapsedMs.toFixed(1),
                perIterMs: +perIterMs.toFixed(2),
                throughputMBps: +mbPerSec.toFixed(0),
                sampleHash: lastHash.slice(0, 16) + '…'
              }, null, 2);
            })()
        """

        // Same SHA-256 1 MB ×20 benchmark, but through the standard Web
        // Crypto path. crypto.subtle.digest returns a Promise — top-level
        // `await` in our (async () => …)() IIFE works because the worker
        // thread runs bun's full event loop and waitForPromise drains
        // microtasks while the digest resolves.
        //
        // Underlying implementation is the same BoringSSL routine; the
        // delta vs Bun.CryptoHasher tells us the per-iteration cost of
        // the async wrapper (Promise alloc, microtask hop, ArrayBuffer
        // allocation for the result).
        private const val WEB_CRYPTO_SHA256_BENCH_JS = """
            (async () => {
              const SIZE = 1024 * 1024;
              const ITERS = 20;

              const buf = new Uint8Array(SIZE);
              for (let i = 0; i < SIZE; i += 65536) {
                crypto.getRandomValues(buf.subarray(i, Math.min(i + 65536, SIZE)));
              }

              // Warm-up — first digest pays JIT tier-up + Web Crypto
              // module load.
              await crypto.subtle.digest('SHA-256', buf);

              let lastDigest;
              const t1 = performance.now();
              for (let i = 0; i < ITERS; i++) {
                lastDigest = await crypto.subtle.digest('SHA-256', buf);
              }
              const elapsedMs = performance.now() - t1;

              const perIterMs = elapsedMs / ITERS;
              const mbPerSec = (SIZE / (1024 * 1024)) / (perIterMs / 1000);

              const hashHex = Array.from(new Uint8Array(lastDigest))
                .slice(0, 8)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

              return JSON.stringify({
                bytes: SIZE,
                iterations: ITERS,
                totalMs: +elapsedMs.toFixed(1),
                perIterMs: +perIterMs.toFixed(2),
                throughputMBps: +mbPerSec.toFixed(0),
                sampleHash: hashHex + '…'
              }, null, 2);
            })()
        """

        // Async benchmark — exercises the full event loop:
        //   - crypto.subtle.digest returns a Promise (needs microtask drain)
        //   - setTimeout needs the timer wheel to fire
        //   - top-level await needs eventLoop.waitForPromise
        // If our embedding is wrong, this hangs or returns "[object Promise]".
        private const val ASYNC_BENCH_JS = """
            (async () => {
              // Web Crypto: SHA-256 via crypto.subtle.digest (async API).
              const buf = new Uint8Array(1024 * 1024);
              for (let i = 0; i < buf.length; i += 65536) {
                crypto.getRandomValues(buf.subarray(i, Math.min(i + 65536, buf.length)));
              }
              const t1 = performance.now();
              const digest = await crypto.subtle.digest('SHA-256', buf);
              const subtleMs = performance.now() - t1;
              const hashHex = Array.from(new Uint8Array(digest))
                .slice(0, 8)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

              // setTimeout — proves the timer wheel ticks.
              const t2 = performance.now();
              await new Promise(resolve => setTimeout(resolve, 50));
              const timerMs = performance.now() - t2;

              // Promise.all — fan out 100 Promise.resolve()s, await all.
              const t3 = performance.now();
              await Promise.all(
                Array.from({ length: 100 }, (_, i) => Promise.resolve(i))
              );
              const fanoutMs = performance.now() - t3;

              return JSON.stringify({
                cryptoSubtleDigestMs: +subtleMs.toFixed(2),
                cryptoSubtleHash: hashHex + '…',
                setTimeout50Ms: +timerMs.toFixed(2),
                promiseAll100Ms: +fanoutMs.toFixed(3),
                note: 'all three of these require the event loop to tick'
              }, null, 2);
            })()
        """
    }
}
