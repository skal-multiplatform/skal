# __APP_NAME__

A Skal app — SolidJS rendered natively by Flutter. **Not React
Native**: signals not hooks, numeric props not CSS, colors are
8-digit `#AARRGGBB`.

Use the `skal` skill (`.claude/skills/skal/`) before writing or
modifying any UI code — it covers the component catalog, Solid idioms,
state/navigation/animation APIs, and the gotchas that break builds.
See `AGENTS.md` for the condensed version.

UI code lives in `src/` (entry: `src/App.jsx`). Verify changes with
`bun run build:js-only`; run with `bun run dev:web` or `bun run dev:macos`.
