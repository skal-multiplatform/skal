# create-skal

The `npm create skal` entry point:

```bash
npm create skal my-app      # == npx @skal/cli create my-app
```

All real behavior lives in [`@skal/cli`](https://www.npmjs.com/package/@skal/cli) —
this package is a thin delegating shim so the `npm create` convention works.
(`npm create @skal my-app` via `@skal/create` does the same thing.)
See the CLI's README for commands, prerequisites, and how the shared
`~/.skal` runtime works.
