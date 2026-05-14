import { createSignal, createMemo, For } from 'solid-js';
import { Container, Column, Row, Text, Button, ListView } from 'skal';
import { createSkalRef } from './skal-runtime.jsx';
// `skal` (above) ships the Skal-protocol INTRINSIC widgets — universal,
// any host that speaks the wire protocol can render them.
// `skal-flutter` (below) ships codegen-wrapped widgets pulled from
// pub.dev — inherently Flutter-bound. The two import sources tell the
// dev at a glance whether a symbol is portable.
//
// Auto-discovered from BOTH manifests the codegen pipeline emits:
//   • lib/adapters/generated/skal_adapters.json (local CLI; Greeting +
//     Stickers in this demo — widgets the dev writes themselves)
//   • lib/skal_codegen.json (build_runner; pub-package widgets like
//     QrImageView from qr_flutter + ShimmerFromColors from shimmer)
// Named-ctor widgets surface as PascalCased concatenations
// (Shimmer.fromColors → ShimmerFromColors); default ctors keep the
// class name verbatim. Multi-child widgets (those that take
// `List<Widget> children` on the Dart side) accept any number of JSX
// children — see <Stickers> below.
import {
  Greeting,
  Stickers,
  // Counter — local stateful widget that fires typed callbacks back
  // to JSX. The codegen detects `VoidCallback onReset` and
  // `ValueChanged<int> onChanged` and emits the appropriate
  // dispatch closures. The bridge carries the typed payload in the
  // event ring's argValue slot.
  Counter,
  QrImageView,
  ShimmerFromColors,
  // First codegen-via-HOST-PATTERN widget. CameraPreview's required
  // `CameraController` can't be encoded over the bridge, so codegen
  // synthesizes a StatefulWidget that owns the controller's lifecycle
  // (initState async-init via lib/adapters/camera_factory.dart's
  // `createCamera`, dispose on unmount). The JSX-facing surface is
  // pure-prop — same as any other widget.
  Camera,
  // Ticker — host-pattern widget with JS → Dart imperative RPC. Owns
  // a TickController (Timer-driven counter) on the Dart side; the
  // synthesized host adapter registers a methodDispatcher on its
  // NodeState that routes JSX `ref.pause()` / `ref.getValue()` calls
  // to the controller. See createSkalRef in skal-runtime.jsx.
  Ticker,
} from 'skal-flutter';

const TWEET_LINES = [
  "Just shipped a new feature, feeling great about how it turned out 🚀",
  "Hot take: the best APIs are the ones you don't have to read docs for",
  "Spent the morning refactoring legacy code — so much cleaner now",
  "There's no such thing as 'just a small change' in production code",
  "If your tests are slow, that's a smell. Fast tests = good tests",
  "Bun's startup time keeps surprising me, even after a year",
  "Why is naming things still the hardest part of programming?",
  "Found a 10× speedup in a critical path today. Profilers, not guesses",
  "Reading 'The Art of Unix Programming' for the third time",
  "Premature abstraction is somehow worse than premature optimization",
  "Latency is a feature, throughput is an artifact of how you measure",
  "Half of debugging is admitting your assumption was wrong",
  "You don't ship the codebase you have. You ship the codebase you understand",
  "Cache invalidation, naming things, off-by-one. The classics",
  "Every config file format eventually grows a turing-complete templating layer",
];

// Pre-compute the tweet pool as {author, body, num} records — Tweet
// component is simpler than parsing strings at render time.
//
// Sized at 15000 so the "10000 (heap stress)" button has fresh source
// items to mount. Each tweet's strings total ~150–200 bytes
// (author, body, several hex colors, two button labels), so 10000
// fresh mounts write ~1.5–2 MiB of string-heap bytes — past the
// 1 MiB heap capacity, forcing flushAndWaitForDrain to fire its
// spin-wait + reset path at least once during the mount.
const TWEETS = Array.from({ length: 15000 }, (_, i) => ({
  author: `@user${(i * 2654435761) >>> 17}`,
  body: TWEET_LINES[i % TWEET_LINES.length],
  num: i + 1,
}));

const COUNT_BUTTONS = [50, 200, 500, 1000, 2000, 5000, 10000];

// Palette — defined once at module scope so the prop diff cache hits on
// identical color strings across every tweet. Otherwise each tweet would
// allocate a fresh string for every setProperty call.
const COLOR_CARD_BG       = '#FFFFFFFF';
const COLOR_CARD_BORDER   = '#FFE5E5EA';
const COLOR_AUTHOR        = '#FF1DA1F2';
const COLOR_BODY          = '#FF1F2937';
const COLOR_REACTION_IDLE_BG     = '#FFF1F5F9';
const COLOR_REACTION_IDLE_FG     = '#FF475569';
const COLOR_REACTION_LIKE_BG     = '#FF22C55E';  // green when liked
const COLOR_REACTION_REPLY_BG    = '#FFEF4444';  // red when replied
const COLOR_REACTION_ACTIVE_FG   = '#FFFFFFFF';

/**
 * One tweet card. Solid creates a fresh component instance per tweet, so
 * each Tweet has its own per-card signals (like state, like count, etc).
 * Clicking a reaction toggles its "active" state and bumps the count.
 *
 * Performance shape:
 *  - Each interaction (one click) updates ~3 reactive props on the
 *    affected button (background, color, label) — Solid's fine-grained
 *    tracking means only THAT button's effects re-run, not any sibling
 *    tweet, not the author/body text.
 *  - The bridge's diff cache short-circuits redundant writes when toggling
 *    back to a previously-seen color, so a like→unlike→like cycle writes
 *    each color value exactly once over its lifetime.
 *  - The host drain coalesces those 3 prop writes into ONE rebuild
 *    of the affected button (one cold.notify() per node per drain).
 */
function Tweet(props) {
  const [likes, setLikes]     = createSignal(0);
  const [liked, setLiked]     = createSignal(false);
  const [replies, setReplies] = createSignal(0);
  const [replied, setReplied] = createSignal(false);

  return (
    <Column
      background={COLOR_CARD_BG}
      padding={12}
      cornerRadius={10}
      borderWidth={1}
      borderColor={COLOR_CARD_BORDER}
      gap={6}
    >
      <Text fontWeight={700} fontSize={14} color={COLOR_AUTHOR} label={`#${props.num} · ${props.author}`} />
      <Text fontSize={14} color={COLOR_BODY} maxLines={3} textOverflow={1} label={props.body} />
      <Row gap={10}>
        {/* Reactive attribute values: use expressions that DIRECTLY
            call the signal (likes(), liked(), …). Solid's babel
            plugin detects the signal call and wraps the expression
            in effect() automatically. Do NOT wrap in an outer arrow
            function — `() => expr` is opaque to the plugin and
            passes through to setProperty as a literal Function value
            (which `String(fn)` then renders as source code). */}
        <Button
          label={`♥ ${likes()}`}
          fontSize={12}
          padding={6}
          cornerRadius={16}
          background={liked() ? COLOR_REACTION_LIKE_BG : COLOR_REACTION_IDLE_BG}
          color={liked() ? COLOR_REACTION_ACTIVE_FG : COLOR_REACTION_IDLE_FG}
          onClick={() => {
            // Toggle-and-adjust: like+1 the first click, like-1 the
            // second. Matches the familiar Twitter/X heart semantics.
            const next = !liked();
            setLiked(next);
            setLikes(likes() + (next ? 1 : -1));
          }}
        />
        <Button
          label={`↩ ${replies()}`}
          fontSize={12}
          padding={6}
          cornerRadius={16}
          background={replied() ? COLOR_REACTION_REPLY_BG : COLOR_REACTION_IDLE_BG}
          color={replied() ? COLOR_REACTION_ACTIVE_FG : COLOR_REACTION_IDLE_FG}
          onClick={() => {
            const next = !replied();
            setReplied(next);
            setReplies(replies() + (next ? 1 : -1));
          }}
        />
      </Row>
    </Column>
  );
}

export default function App() {
  const [count, setCount] = createSignal(0);
  const [bigBenchMs, setBigBenchMs] = createSignal('tap +1000 to benchmark fast-path');
  const [visibleTweets, setVisibleTweets] = createSignal(50);
  const [tweetBenchMs, setTweetBenchMs] = createSignal('');
  // Bridge-driven callback state — fed by the codegen-emitted
  // dispatchEventInt / dispatchEvent calls inside Counter's
  // generated adapter. Validates the round-trip:
  //   Counter Dart-side fires → bridge writes typed event →
  //   JS drain decodes → reactively updates this signal → re-render.
  const [counterLog, setCounterLog] = createSignal('— waiting for counter events —');

  // Imperative ref for the Ticker host. JSX-side calls
  // `ticker.pause()`, `ticker.getValue()` (returns Promise<number>),
  // etc. The Proxy emits OP_INVOKE_METHOD; the codegen-generated
  // _TickerHost dispatches to TickController methods on the Dart side.
  const ticker = createSkalRef();
  const [tickerLog, setTickerLog] = createSignal('— tap a button to RPC the Ticker —');

  // createMemo: derived signal, recomputed only when visibleTweets changes.
  // <For> below will diff the old vs new array using identity (default) and
  // emit only the minimum add/remove ops to the bridge.
  const tweetsToShow = createMemo(() => TWEETS.slice(0, visibleTweets()));

  // IMPORTANT: return a single container element, NOT a fragment.
  //
  // If you return `<>...</>`, Solid's universal renderer treats the whole
  // array as reactive: any signal change re-runs the array-level effect,
  // which calls each function child to "unwrap" it, which CREATES NEW text
  // nodes for every string-returning child (the tweet list, the bench
  // texts, etc.).
  //
  // With a single root element, children are inserted individually and
  // each function child gets its own isolated effect. setCount only
  // re-runs the count-text effect, nothing else.
  return (
    // <ListView> — virtualized scroll container. ListView.builder on
    // Flutter only materializes the ~10 items in the visible window
    // plus a small overscan buffer, so a 5000-tweet feed mounts ~10
    // Element trees up front instead of 50K. The NodeState graph
    // still holds all 5000 entries because Solid's <For> mounted them
    // — the host just doesn't build the off-screen widgets.
    //
    // Children-list backing is ListChildList (O(1) append, O(N − pos)
    // mid-list mutation). For drag-and-drop reorder UIs, swap to
    // <ReorderableListView> (TreapChildList, O(log N) everywhere).
    //
    // The control row (Count / Increment / benchmarks / count
    // buttons) scrolls together with the tweet feed, which matches
    // the Twitter/X UX of "search bar scrolls away as you read".
    <ListView background="#FFFAFAFA" padding={16} gap={12}>
      {/* Custom widget — registered on the Flutter side via
          SkalRegistry, rendered through the wtCustom dispatch in
          root.dart. Validates the substrate end-to-end. */}
      <Greeting name="Skal" color="#FF1DA1F2" fontSize={20} />
      {/* ShimmerFromColors (third-party, codegen-generated from the
          Shimmer.fromColors NAMED constructor — synthesized as
          `ClassName + PascalCase(ctorName)`). Demonstrates the
          widget-child flow end-to-end: JSX child → bridge node →
          SkalNode reader → real Flutter tree. The shimmering
          animation runs on the Greeting widget below. */}
      <ShimmerFromColors baseColor={0xFFBDBDBD} highlightColor={0xFFE0E0E0} period={1500}>
        <Greeting name="loading…" color="#FF333333" fontSize={28} />
      </ShimmerFromColors>
      {/* Real third-party Flutter package wrapped via skal_codegen.
          The QrImageView adapter at
          flutter/skal_flutter/lib/adapters/generated/qr_flutter.g.dart
          was generated by running codegen against qr_flutter's
          QrImageView class. */}
      <QrImageView data="https://skal.dev" size={200} />
      {/* First stateful-widget wrap via the codegen HOST pattern.
          Behind the scenes: a synthesized `_CameraHost` StatefulWidget
          that calls our `createCamera` factory in initState, awaits
          its Future<CameraController>, and renders CameraPreview once
          the controller's ready. If the device has no cameras (e.g.
          macOS without permission, iOS simulator), the host's catch
          block renders an inline error banner. */}
      <Container background="#FF000000" padding={4} cornerRadius={8}>
        <Camera resolutionIndex={1} />
      </Container>
      {/* Counter — local stateful widget exercising the codegen's
          callback path. `onChanged` is a ValueChanged<int> (bridge
          carries the int payload in the event ring's typed-arg
          slot); `onReset` is a VoidCallback (no payload).
          Tapping +/−/reset inside the Dart widget fires the
          callbacks; the JSX signal updates; this label re-renders. */}
      <Counter
        initial={0}
        onChanged={(n) => setCounterLog(`onChanged(${n})`)}
        onReset={() => setCounterLog('onReset()')}
      />
      <Text label={counterLog()} fontSize={14} color="#FF333333" />
      {/* Ticker — host pattern + JS → Dart imperative RPC. Dart side
          runs a Timer-driven counter; JSX side has a ref Proxy that
          dispatches `ref.pause()`, `ref.getValue()`, etc. across the
          bridge. Awaiting the value returns a Promise resolved by the
          codegen-emitted EV_METHOD_REPLY decode path. */}
      <Ticker ref={ticker} intervalMs={500} />
      <Row gap={6}>
        <Button label="pause" onClick={async () => {
          await ticker.pause();
          setTickerLog('pause() ✓');
        }} />
        <Button label="resume" onClick={async () => {
          await ticker.resume();
          setTickerLog('resume() ✓');
        }} />
        <Button label="reset" onClick={async () => {
          await ticker.reset();
          setTickerLog('reset() ✓');
        }} />
        <Button label="+10" onClick={async () => {
          await ticker.bump(10);
          const v = await ticker.getValue();
          setTickerLog(`bump(10), now getValue() → ${v}`);
        }} />
        <Button label="read" onClick={async () => {
          const v = await ticker.getValue();
          const paused = await ticker.isPaused();
          setTickerLog(`getValue() → ${v}, isPaused() → ${paused}`);
        }} />
        {/* String arg + String return — round-trips via the reply heap. */}
        <Button label="describe" onClick={async () => {
          const s = await ticker.describe('hello from JSX');
          setTickerLog(`describe() → ${s}`);
        }} />
        {/* JSON object return — Dart's snapshot() returns Map; bridge
            JSON-encodes; JS auto-parses. Receive a real object on JSX side. */}
        <Button label="snapshot" onClick={async () => {
          const snap = await ticker.snapshot();
          setTickerLog(
            `snapshot() → value=${snap.value} paused=${snap.paused} ts=${snap.timestamp}`,
          );
        }} />
        {/* Force-fail RPC — calls a method that doesn't exist on the
            controller. Promise rejects with the Dart-side error string. */}
        <Button label="bogus" onClick={async () => {
          try {
            await ticker.totallyMadeUp();
            setTickerLog('bogus(): unexpectedly resolved');
          } catch (e) {
            setTickerLog(`bogus() rejected: ${e.message}`);
          }
        }} />
      </Row>
      <Text label={tickerLog()} fontSize={14} color="#FF333333" />
      {/* Multi-child custom widget — Stickers takes `List<Widget>
          children` on the Dart side, and the codegen-emitted reader
          walks NodeState.childCount to produce one SkalNode per JSX
          child. Three Greeting children below → three rows in the
          rendered column. End-to-end proof of the List<Widget> path. */}
      <Stickers background={0xFFFFE082} gap={6} padding={10}>
        <Greeting name="multi-child A" color="#FF6B4F00" fontSize={14} />
        <Greeting name="multi-child B" color="#FF6B4F00" fontSize={14} />
        <Greeting name="multi-child C" color="#FF6B4F00" fontSize={14} />
      </Stickers>
      <Container background="#FF1DA1F2" padding={12} cornerRadius={8}>
        {() => `Count: ${count()}`}
      </Container>
      <Row gap={8}>
        <Button label="Increment" onClick={() => setCount(count() + 1)} />
        <Button label="Decrement" onClick={() => setCount(count() - 1)} />
      </Row>
      <Button
        label="+1000 (benchmark)"
        onClick={() => {
          const startCount = count();
          const t1 = performance.now();
          let iter = 0;
          let crashAt = -1;
          let crashMsg = '';
          try {
            for (; iter < 1000; iter++) {
              setCount(count() + 1);
            }
          } catch (e) {
            crashAt = iter;
            crashMsg = (e && (e.message || String(e))) || 'unknown';
          }
          const ms = (performance.now() - t1).toFixed(3);
          const delta = count() - startCount;
          if (crashAt >= 0) {
            setBigBenchMs(`crashed @${crashAt}: ${crashMsg} · delta=${delta}`);
          } else {
            setBigBenchMs(`+1000 ${ms}ms · iter=${iter} delta=${delta}`);
          }
        }}
      />
      {bigBenchMs}

      <Row>
        <For each={COUNT_BUTTONS}>
          {(n) => (
            <Button
              label={`${n}`}
              onClick={() => {
                const t1 = performance.now();
                try {
                  setVisibleTweets(n);
                  const ms = (performance.now() - t1).toFixed(3);
                  setTweetBenchMs(`set to ${n} in ${ms} ms`);
                } catch (e) {
                  const msg = (e && (e.message || String(e))) || 'unknown';
                  setTweetBenchMs(`ERROR @ ${n}: ${msg}`);
                }
              }}
            />
          )}
        </For>
      </Row>
      {tweetBenchMs}

      <For each={tweetsToShow()}>
        {(tweet) => (
          <Tweet author={tweet.author} body={tweet.body} num={tweet.num} />
        )}
      </For>
    </ListView>
  );
}
