# WebCrypto is slow above 64 bytes — and it is a dispatch, not the crypto

**Status:** measured, root-caused in the source, **not yet fixed.**
**Found:** 2026-08-01, benchmarking Skal against React Native +
`react-native-quick-crypto` on a Samsung Galaxy A14 5G (Android 15,
arm64), release builds, physical hardware.

## The finding

`crypto.subtle` operations pay a **fixed work-queue round trip of
≈0.165 ms per call**. Below the threshold Skal is *faster* than RN;
above it, 2.4×–8.3× slower.

| SHA-256 over | Skal | RN (quick-crypto) | |
|---|---:|---:|---|
| 1 byte | **0.0145 ms** | 0.0371 ms | Skal 2.6× faster |
| 1 KB | 0.1793 ms | **0.0378 ms** | RN 4.7× |
| 64 KB | 0.3459 ms | **0.0901 ms** | RN 3.8× |
| 1 MB | 2.1778 ms | **0.8557 ms** | RN 2.5× |

The jump from 1 byte to 1 KB is **12×** for 1023 extra bytes. That is
not a gradient, it is a threshold.

## Where it is

`vendor/bun/src/jsc/bindings/webcrypto/CryptoAlgorithmSHA256.cpp:54`
(and identically in `SHA1`, `SHA224`, `SHA384`, `SHA512`, `SHA3`):

```cpp
void CryptoAlgorithmSHA256::digest(Vector<uint8_t>&& message, ...)
{
    if (message.size() < 64) {          // <-- the threshold
        digest->addBytes(...);          // inline, on the calling thread
        auto result = digest->computeHash();
        ScriptExecutionContext::postTaskTo(...);
        return;
    }
    workQueue.dispatch(context.globalObject(), [...]);   // thread-pool hop
}
```

`workQueue` is `Bun::PhonyWorkQueue`, which forwards to
`CppTask.Concurrent` → Bun's `WorkPool`. So every digest of 64 bytes or
more costs a thread hand-off, a `crossThreadCopy` of the result, and a
`postTaskTo` back to the JS context.

**Worse: only the SHA digests have that fast path at all.** HMAC,
AES-GCM, ECDSA, PBKDF2 and RSA route through
`CryptoAlgorithm::dispatchOperationInWorkQueue`
(`CryptoAlgorithm.cpp:96`), which has **no inline case at any size** —
`grep -c 'size() < ' CryptoAlgorithm.cpp` returns 0.

This is **upstream bun/WebKit code**, not a Skal modification: the
webcrypto files carry no `[skal]`-prefixed commits in `vendor/bun`. We
inherit it by vendoring, and can patch it in the fork.

## The proposed fix, and its trade-off

Raise the threshold. Hashing 64 KB inline costs ~0.166 ms of CPU;
dispatching it costs ~0.165 ms of latency **plus** the same hashing.
Break-even is around **72 KB** — everything below that is strictly
cheaper done inline.

The trade-off is real and should be stated in whatever ships: the
dispatch exists to keep the JS thread free. Raising the threshold buys
throughput at the cost of blocking the main thread for up to the same
duration it would otherwise have spent waiting. **A few tens of KB looks
like the right balance** — well above the 64-byte status quo, well below
the point where a UI frame would be missed.

The larger win is adding an inline path to
`dispatchOperationInWorkQueue`, since that is where HMAC, AES, ECDSA and
PBKDF2 all land today with no fast path whatsoever.

## What this is NOT — four hypotheses that were tested and refuted

Kept because ruling them out is how the real cause was found, and
because each is the obvious first guess:

| hypothesis | evidence against |
|---|---|
| per-`await` promise overhead | Skal's 1-byte digest is **2.6× faster** than RN's, and `await Promise.resolve()` is 0.0001 ms vs RN's 0.0040. Batching 50 digests behind one await made Skal **worse**, not better. |
| `libskal.so` lacks the ARMv8 SHA instructions | the binary contains `"SHA256 block transform for ARMv8, CRYPTOGAMS"`, 56 `sha256h`/`sha256su` instructions, and imports `getauxval` for CPU feature detection. |
| work scheduled onto LITTLE cores | Skal's hot thread ran **85% on cpu6/cpu7**, the 2.2 GHz Cortex-A75 pair. |
| the Bun worker pool is slow | the `Bun Pool` threads were nearly idle (57 ticks against the main thread's 988). |

The measurement that isolated it: **PBKDF2** performs ~20 000 SHA-256
compressions inside *one* native call on a *tiny* buffer, so it exercises
the hash core without the per-call cost.

| ns per SHA-256 compression | inside PBKDF2 (one call) | hashing a 64 KB JS buffer |
|---|---:|---:|
| Skal | 310 | **733** |
| RN | 233 | **89** |

RN gets 2.6× *faster* per compression on the big contiguous buffer, as
any hash implementation should. Skal gets 2.4× *slower* — which rules
out the hash core and points at the call.

## Caveats

- **One device, one Android version**, release builds.
- **Skal's crypto timings vary 2–5× run to run** where RN's reproduce
  within ±2% on the identical harness. Skal's figures are bands.
- **A buffer copy may contribute on top of the dispatch** — not
  separated, because `perf_event_open` is blocked without root on this
  device so `simpleperf` could not profile the release build.
- Measurements must be taken with the **screen held awake**
  (`svc power stayon true`). A dozing screen inflated Skal's numbers ~2×
  and left RN's untouched — an error that penalises exactly one arm.

Full data, harness and read-outs: `benchmark_v2/final-benchmark/`
(gitignored) — §6 of `RESULTS.md`, plus `data/crypto-diag-*.png`.
