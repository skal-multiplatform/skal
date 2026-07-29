Never commit unless explicitly told

# Performance first, always

Every change is a performance decision. When two implementations are
equally correct, take the one that does less work — fewer allocations,
fewer encodes, fewer copies, fewer wakes, fewer frames. Say so in the
comment when the cheaper shape is non-obvious, so the next person
doesn't "simplify" it back.

But **a performance claim is a measurement, not an argument.** The rules
below all exist because they were broken here and cost real time.

## Never claim a number you did not measure properly

- **No perf claim from a debug build.** Debug Flutter and the iOS
  simulator are for correctness and interaction, never for numbers.
  Release, on the closest thing to real hardware available. macOS
  release is buildable locally; the simulator refuses release.
- **No perf claim from a single sample.** A second run of identical code
  once gave 695 ms → 8 ms for the same payload. One sample is noise with
  a decimal point. Take medians, and report the spread when it is wide.
- **A/B interleaved**, baseline and candidate alternating, so machine
  state lands on both. Sequential A-then-B has produced +99.5%, −6.7%
  and +0.1% for the same pair.
- **Prove the workload ran.** Assert the count. A "39% faster" list
  benchmark was timing 10 virtualized rows, not 2000. A 20k-dispatch
  loop clocked 17 ns/op because the queue ceiling was refusing almost
  every call — it was timing the rejection path.
- **A big segment is not a critical-path segment.** Sizing the phases
  tells you where time is *spent*, not where it is *costing*. Three
  targets picked by size in one session all evaporated under a control:
  a 78 ms "bundle extraction" that sub-timing showed was 3 ms (the
  phase timer bracketed a whole function and charged it the label on
  the outside); a 59 ms first-frame raster that a one-rect control
  screen cut to 2.3 ms with **zero** change to the total, because the
  frame waits on vsync regardless; and a 91 ms MethodChannel delay that
  sits entirely off the path — `Fully drawn` lands 84 ms *after* the
  call it supposedly gates. The only evidence that a segment costs
  anything is removing it and re-measuring the **total**.
- **A/B/A, and quantify the drift.** When two builds can't be
  interleaved per-run (same applicationId, compile-time flags), run
  A-block, B-block, A-block and report the A-to-A drift alongside the
  delta. A change smaller than the drift is not proven. This caught a
  combined arm reading "no change" that was hiding a real +20 ms win
  under a −13 ms regression, and a prefetch that looked like a clean
  win at n=3 and was an 18 ms regression at n=10.
- If the honest answer is "too noisy to tell", that is the answer. Say
  it instead of picking the flattering run.

## Before reporting a bug found through a tool, rule out the tool

Four times in one session an environment artifact impersonated a product
bug. Reproduce outside the harness, or prove the harness is innocent,
first:

- **The browser pane is often `visibilityState: "hidden"`, viewport
  0×0.** Hidden documents fire no scroll events and deliver no rAF or
  ResizeObserver callbacks. `resize_window` does not fix it. Windowed
  lists "not re-windowing" and lazy Flutter-embed hosts "never booting"
  were both this. Use a real browser (`open <url>`) and have the page
  report back via `fetch('/__probe?...')` — the static server logs the
  path, and `preview_logs` can read it.
- **Vite/browser HTTP cache serves stale modules.** An alias fix looked
  inert through three reloads. Prove what is actually served by fetching
  the module and grepping its text, or test the production build on a
  fresh port.
- **Inactive tabs are hidden, so their children have zero size.** Lazy
  work gated on first layout correctly does not fire there. Activate the
  tab before concluding anything.
- **A simulator RUNTIME can be the bug.** Emoji rendered as tofu on the
  iOS 26.3 simulator — `🚀` U+1F680 and `↩` U+21A9 both, while `♥`
  U+2665 was fine. Not Skal: the same build renders them on the iOS 18.6
  simulator and on web. The emoji font is even present in the 26.3
  runtime (`AppleColorEmoji-160px.ttc`), so it is a fallback failure in
  the engine on that runtime, not a missing file. Before touching text
  or font code, run the SAME build on a second runtime.

  The attempted fix cost more than the bug: adding `fontFamilyFallback`
  with the platform emoji fonts turned EVERY glyph in the app to tofu,
  because that property REPLACES Flutter's implicit fallback chain
  rather than extending it — an emoji-only list leaves nothing with
  Latin glyphs.
- **`find.byType` skips offstage widgets by default.** An `IndexedStack`
  child is offstage, so the obvious widget test passed against the
  unfixed code. Read the parent's child list directly.

## Test the other side of the wire

Tests written by the pass that wrote the code cover the half its author
was looking at. Chunked replies shipped with a mutation-tested splitter
and a reassembler with no tests at all — three live bugs sat in that
gap, all on the untested side.

- Every test gets **mutation-checked**: break the fix, watch the test
  fail. A test that passes with the fix deleted is worse than no test.
- A test double that under-reports what the real consumer does will fail
  correct code. Model what the real reader consumes.
- When N config files or symbol lists must agree, assert it. Four link
  scripts drifted and `skal_prewarm_store` went unexported on iOS only —
  it links, loads, boots and renders, and the only observable is a
  missing symbol.

## Read the whole file before asserting what it does

Claims about CI, build scripts and configs have been wrong from reading
the first screen. Check the artifact you are about to trust: several
`libskal.dylib` copies exist and they do not all export the same
symbols.
