// Fail loudly, once, when `bun test` is run without `--conditions=browser`.
//
// solid-js's export map lists `node` before `browser`, so a bare `bun test`
// resolves it to `dist/server.js` — the SSR build, where signals hold values
// but nothing is reactive. The suite then reports ~128 failures scattered
// across store and renderer tests, none of which say what is wrong; the
// nearest thing to a clue is one assertion named "the reactive build is the
// one under test".
//
// There is no bunfig key for this: `conditions` under [test], [run] and the
// top level were all tried against bun 1.3.14 and none change resolution.
// A preload cannot fix the resolution either — but it can make the failure
// name itself, which is the difference between a wrong command and an hour.
const resolved = Bun.resolveSync('solid-js', import.meta.dir);

if (resolved.endsWith('server.js')) {
  throw new Error(
    'skal-js tests need --conditions=browser.\n\n' +
    '  solid-js resolved to ' + resolved + '\n' +
    '  which is the SSR build: signals return values but never update, so\n' +
    '  ~128 tests fail for reasons unrelated to the code under test.\n\n' +
    '  Run:  bun run test        (from packages/skal-js)\n' +
    '    or: bun test --conditions=browser\n'
  );
}
