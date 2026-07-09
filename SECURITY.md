# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately via GitHub's security advisory
form: **[Report a vulnerability](https://github.com/skal-multiplatform/skal/security/advisories/new)**
(repo → Security → Report a vulnerability). Do not open public issues
for security reports.

You can expect an acknowledgement within a few days. Please include a
minimal reproduction and the affected platform(s).

## Scope notes

- `libskal` embeds bun + JavaScriptCore. Vulnerabilities in *upstream*
  bun/WebKit should be reported upstream first (they have their own
  security processes); report here if Skal's integration or its pinned
  fork versions are what expose the issue.
- The JS hot-reload WebSocket server (`scripts/hot-reload-server.js`)
  and dev tooling are **development-only** and intentionally
  unauthenticated on localhost; they are gated out of release builds
  (`kDebugMode` / `--dart-define=SKAL_HOT`) and are out of scope for
  production security reports.
