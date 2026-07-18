# __APP_NAME__ — agent guide

This is a **Skal** app: SolidJS JSX rendered natively by Flutter
(no DOM, no CSS, no WebView on native; the web target renders DOM).
Docs: https://skal.run/docs/ · condensed brief: https://skal.run/llms.txt

**Skal is not React Native.** It is SolidJS — signals, not hooks;
components run once; styling is numeric props, not CSS. Code written
from React/React Native memory will not compile.

Before writing or changing any UI code, read the full guide that ships
with this app:

- `.claude/skills/skal/SKILL.md` — how to build Skal UIs (idioms,
  state, navigation, lists, animation, gotchas, verify commands)
- `.claude/skills/skal/references/components.md` — the ~50-component
  catalog with per-prop documentation (generated from source; trust it
  over memory, and do not invent props)

(The same files are mirrored at `.agents/skills/skal/`.)

## The 10-second version

```jsx
import { createSignal, Show, For } from 'solid-js';
import { Column, Row, Text, Button } from 'skal';   // always import from 'skal'

const [count, setCount] = createSignal(0);
<Column padding={24} gap={16} background="#FFF2F2F7">   {/* colors: #AARRGGBB */}
  <Text label={`Tapped ${count()}`} fontSize={16} />    {/* signals are CALLED */}
  <Button label="Tap" onClick={() => setCount(c => c + 1)} />
</Column>
```

- Conditional UI: `<Show when={...}>` · lists: `<For each={...}>` ·
  big lists: `<ListView count={n} renderItem={(i) => ...} />`
- State that persists: `createSkalStore` from `'skal/store'`
- Navigation: `createRouter` from `'skal/runtime'`
- Verify a change: `bun run build:js-only` (compile check) ·
  `bun run dev:web` (browser preview) · `bun run dev:macos` (native)

Entry point: `src/App.jsx`. The Flutter host in `flutter-host/` rarely
needs edits — UI work happens in JS/JSX.
