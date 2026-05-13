// Skal runtime — Solid components and helpers built on top of the
// bridge. Apps import from here for primitives that are Skal-specific
// (i.e. not part of stock Solid).
//
// Status: reserved tooling. <ChunkedFor> exists but the demo
// (App.jsx) uses plain <For> because <listView>'s Flutter-side
// virtualization already bounds per-frame work to ~10 widgets and
// JS-side chunking becomes redundant. ChunkedFor remains useful for
// the cases listView can't help with: non-virtualized layouts,
// infinite-feed UX where users expect to see items stream in, or
// "the list is small enough that scrolling doesn't matter but the
// initial mount is expensive enough to want progressive feedback."
// Re-import in App.jsx when one of those shapes shows up.

import { createSignal, createMemo, createEffect, onCleanup, For } from 'solid-js';

/**
 * <ChunkedFor each={items}>{(item) => <Tweet …/>}</ChunkedFor>
 *
 * Drop-in replacement for Solid's `<For>` that mounts items in
 * adaptively-sized chunks across multiple frames, yielding to the
 * event loop between chunks. The host (Flutter) gets to drain the
 * bridge ring and paint partial results, so a 5000-item list shows
 * "the list growing" instead of "click → freeze → everything appears."
 *
 * Adaptive sizing: each chunk's wall-clock time is measured, and the
 * next chunk's target size shrinks or grows toward `targetMs` (default
 * 6 ms — leaves ~half the 16 ms frame budget for the host's drain +
 * paint pass). After 2–3 chunks this self-tunes to whatever device is
 * running the app, regardless of how heavy each item is to mount.
 *
 * Cancellation: if `each` changes mid-stream (user clicks a different
 * count button), the previous stream stops immediately. Solid's
 * keyed-list diff still works because we only ever feed a prefix of
 * the new `each` array to the inner <For>.
 *
 * Props:
 *   each:        the source array (re-runs whenever it changes)
 *   children:    item renderer, same signature as Solid's <For>
 *   initial:     starting visible count (default 50 — feels instant)
 *   targetMs:    per-chunk wall-clock budget (default 6 ms)
 *   minChunk:    smallest chunk size (default 10)
 *   maxChunk:    largest chunk size (default 2000)
 *   onProgress:  optional (count, total) => void called after each chunk
 *
 * Returns: whatever <For> returns. Use exactly like <For>.
 */
export function ChunkedFor(props) {
  const [visible, setVisible] = createSignal(0);

  // Re-run whenever the source array identity changes — Solid memos
  // are identity-based on what we read inside, so this triggers on
  // every `each` reassignment by the parent component.
  createEffect(() => {
    const source = props.each;
    if (!source) { setVisible(0); return; }

    const total = source.length;
    const initial = Math.min(props.initial ?? 50, total);
    const targetMs = props.targetMs ?? 6;
    const minChunk = props.minChunk ?? 10;
    const maxChunk = props.maxChunk ?? 2000;

    // Preserve already-mounted items when `each` changes. Naive "reset
    // visible to initial" causes a dispose-and-remount of every shared
    // component (e.g. going 5000 → 2000 throws away the 2000 we
    // already have and re-mounts them, generating O(N) churn that can
    // even crash JSC's GC under high disposal volume). Instead:
    //
    //   - If new total < visible (source shrunk): clamp down, no churn.
    //   - If new total > visible (source grew):  resume streaming from
    //     wherever we already were, not from `initial`.
    //   - First-time mount: visible is 0, clamp up to `initial`.
    let chunkSize = initial;
    let cancelled = false;

    const startFrom = Math.min(Math.max(visible(), initial), total);
    if (startFrom !== visible()) setVisible(startFrom);

    function step() {
      if (cancelled) return;
      const current = visible();
      if (current >= total) return;

      const t0 = performance.now();
      const next = Math.min(current + chunkSize, total);
      try {
        setVisible(next);
      } catch (e) {
        // Microtasks aren't covered by the caller's try/catch; an
        // uncaught throw here would reach bun's error printer (which
        // has its own bugs at scale). Swallow + log so streaming
        // degrades gracefully instead of crashing the runtime.
        console.error('Skal: ChunkedFor step failed:', e?.message ?? e);
        cancelled = true;
        return;
      }
      const elapsed = performance.now() - t0;

      // Adaptive sizing — converge toward `targetMs` per chunk. The
      // 1.5× / ÷1.5 step damps oscillation while still adapting fast
      // (3–4 chunks to lock in on the right size).
      if (elapsed < targetMs * 0.5) {
        chunkSize = Math.min(((chunkSize * 3) >> 1) || chunkSize + 1, maxChunk);
      } else if (elapsed > targetMs) {
        chunkSize = Math.max((chunkSize * 2 / 3) | 0, minChunk);
      }

      props.onProgress?.(next, total);

      if (next < total) queueMicrotask(step);
    }

    if (initial < total) queueMicrotask(step);
    onCleanup(() => { cancelled = true; });
  });

  // Slice memo — only the prefix the streamer has revealed so far
  // reaches the inner <For>. Identity-based diffing inside <For>
  // means already-mounted items aren't remounted on each slice grow.
  const sliced = createMemo(() => (props.each ?? []).slice(0, visible()));

  return <For each={sliced()}>{props.children}</For>;
}
