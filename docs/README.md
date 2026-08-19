# Skal documentation

Current reference only. Working notes, plans and superseded write-ups
live in `notes/`, which is untracked.

Docs carrying a **"written while this was being built"** banner are design
records from the time of implementation. They are kept because the rationale
in them is still worth reading, but individual claims may have been overtaken
by the code — where they disagree with the source, the source wins. The files
without a banner were verified against the code on 2026-08-19.

## Numbers

| | |
|---|---|
| [BENCHMARKS.md](BENCHMARKS.md) | **Every performance claim Skal makes**, measured against React Native on real hardware — plus what has *not* been measured, and the one comparison still unresolved. |

## How things work

| | |
|---|---|
| [COMPONENTS.md](COMPONENTS.md) | The fast-path widget layer — the 49 primitives that cross the bridge as first-class wire ops, and why the rest are props instead. |
| [PROPS.md](PROPS.md) | How a prop travels from JSX through the encoder, across shared memory, into a Flutter widget. Hot vs cold props, the wire format, the invariants. |
| [NAVIGATION.md](NAVIGATION.md) | Screen stack, native transitions, back-gesture arbitration, and keep-alive. |
| [ANIMATION.md](ANIMATION.md) | Motion runs host-side; JS declares the target. Tweens, list enter/exit, Hero, spring physics — zero per-frame bridge traffic. |
| [NATIVE_SUPPORT.md](NATIVE_SUPPORT.md) | What a Skal app can reach natively today, and what it can't. |
| [WEB.md](WEB.md) | The web target — DOM renderer, the hidden Flutter Web instance that serves plugins, and the prerendered SSG shape this site is built on. |
| [bytecode-cache.md](bytecode-cache.md) | Why cold start skips the parser, and how the cache is built and invalidated. |

## Doing things

| | |
|---|---|
| [WRAPPING_PUB_PACKAGES.md](WRAPPING_PUB_PACKAGES.md) | Expose any pub.dev widget or plugin API to JSX. Start at the decision tree. |
| [TESTING.md](TESTING.md) | Three runtimes, three test layers — `bun test`, `flutter test`, Maestro on device. |
| [DEBUGGING.md](DEBUGGING.md) | Debugging across JS, Dart and native, including the parts that need a real device. |
| [crash-symbolication.md](crash-symbolication.md) | Turning a native crash address into a line of source. |

## Why it's built this way

| | |
|---|---|
| [PERFORMANCE.md](PERFORMANCE.md) | The invariants a change has to respect, what is already optimal, and what has been rejected and why. Numbers live in BENCHMARKS.md. |
| [ENGINE_CHOICE.md](ENGINE_CHOICE.md) | Decision record — why bun + JSC + Flutter rather than the obvious alternatives. |
