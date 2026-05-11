import { createSignal, createMemo, For } from 'solid-js';

const TWEET_LINES = [
  "Just shipped a new feature, feeling great about how it turned out 🚀",
  "Hot take: the best APIs are the ones you don't have to read docs for",
  "Spent the morning refactoring legacy code — so much cleaner now",
  "Compose Multiplatform is genuinely maturing into something special",
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

const TWEETS = Array.from({ length: 5000 }, (_, i) => {
  const author = `@user${(i * 2654435761) >>> 17}`;
  return `${author}: ${TWEET_LINES[i % TWEET_LINES.length]} (#${i + 1})`;
});

const COUNT_BUTTONS = [50, 200, 500, 1000, 2000, 5000];

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
  // texts, etc.). On a fragment with 50 tweets, every setCount allocates
  // 50+ fresh text nodes — the string heap fills in ~126 iterations.
  //
  // With a single root element, children are inserted individually and
  // each function child gets its own isolated effect. setCount only
  // re-runs the count-text effect, nothing else.
  return (
    <column background="#FFFAFAFA" padding={16} gap={12}>
      <box
        background="#FF1DA1F2"
        padding={12}
        cornerRadius={8}
      >
        {() => `Count: ${count()}`}
      </box>
      <row gap={8}>
        <button label="Increment" onClick={() => setCount(count() + 1)} />
        <button label="Decrement" onClick={() => setCount(count() - 1)} />
      </row>
      <button
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

      <row>
        <For each={COUNT_BUTTONS}>
          {(n) => (
            <button
              label={`${n}`}
              onClick={() => {
                const t1 = performance.now();
                setVisibleTweets(n);
                const ms = (performance.now() - t1).toFixed(3);
                setTweetBenchMs(`set to ${n} in ${ms} ms (handler)`);
              }}
            />
          )}
        </For>
      </row>
      {tweetBenchMs}

      <For each={tweetsToShow()}>
        {(tweet) => tweet}
      </For>
    </column>
  );
}
