<!-- Keep it focused: one concern per PR. Delete sections that don't apply. -->

## What and why

<!-- What changes, and what problem it solves. This codebase's comments
     explain *why* rather than *what* — the same goes here. -->

## How it was verified

<!-- Not "tests pass". What did you actually run, and what did it say? -->

- [ ] `bun run test` (JS · native · codegen · Flutter)
- [ ] Ran on a real target: <!-- macOS / iOS / Android / web — say which -->

**If you fixed a bug:** does a test fail with the fix reverted? A test that
passes with the fix deleted is worse than no test.

<!-- Paste the mutation check: the assertion that fires, and on what. -->

## Cross-target

<!-- Skal's most expensive defect class is "correct on one target, silently
     wrong on another" — a prop honoured on web and ignored on Flutter, a
     callback handed a value on native and an Event on web. If you touched
     the renderer, a prop, or an event path, say which targets you checked. -->

- Targets exercised: <!-- e.g. macOS + web; iOS simulator only; N/A -->

## Performance

<!-- Only if you touched the bridge, renderer, or store — see
     docs/PERFORMANCE.md for the invariants. -->

A performance claim is a measurement, not an argument. If you're claiming one:

- [ ] Release build, not debug, and not the iOS simulator
- [ ] Medians over several runs, A/B interleaved — not one sample, not A-then-B
- [ ] The workload provably ran (assert the count; a virtualized list benchmark
      that times 10 rows instead of 2000 will happily report 39% faster)

"Too noisy to tell" is a valid result. Say it rather than picking the
flattering run.

## Docs

- [ ] Updated the docs this changes, or confirmed none needed
- [ ] If it changes the scaffold, the generated app was checked — a new app has
      no `docs/` directory, so in-repo relative links are dead there
