import { createSignal, createMemo, For } from 'solid-js';
import { Container, Column, Row, Text, Button, ListView } from 'skal';

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
