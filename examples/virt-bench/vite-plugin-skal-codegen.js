// Vite plugin for skal_codegen — reads the JSON manifest emitted by
// the Dart-side Builder + materializes the JSX-side companion module
// + provides macro config so build_runner-wrapped widgets are
// directly importable from JSX with zero manual JS-side glue.
//
// Manifest source (emitted by codegen/skal_codegen/lib/builder.dart):
//
//   {
//     "widgets": {
//       "QrImageView": "qrImageView",
//       "VideoPlayer": "videoPlayer"
//     }
//   }
//
// What this plugin provides:
//
//   1. A VIRTUAL MODULE `skal-flutter` (default; override via
//      `moduleName:`) — JSX can
//      `import { QrImageView, VideoPlayer } from 'skal-flutter'`
//      without any file existing under the app's src/. The plugin
//      synthesizes the module's source at build time from the manifest.
//      The companion `skal` package carries the universal intrinsics
//      (resolved via bun workspaces).
//
//   2. A MACRO CONFIG fragment — the babel-plugin-skal-jsx needs to
//      know which capitalized identifiers from which modules to
//      lower to which lowercase intrinsic tags. We expose the
//      manifest's widgets as a `modules` entry the dev's
//      vite.config.js spreads into the macro's existing config.
//
// Usage in the consumer's vite.config.js:
//
//   import { skalCodegen } from './vite-plugin-skal-codegen.js';
//
//   const codegen = skalCodegen({
//     // Either a single manifest string, or an array if multiple
//     // generators (CLI + build_runner) contribute widgets:
//     manifests: [
//       '../flutter/skal_flutter/lib/adapters/generated/skal_adapters.json',
//       '../flutter/skal_flutter/lib/skal_codegen.json',
//     ],
//   });
//
//   export default defineConfig({
//     plugins: [
//       codegen.vitePlugin,                  // virtual module
//       solid({
//         babel: {
//           plugins: [[skalJsxPlugin, {
//             modules: {
//               ...codegen.macroModules,     // auto-discovered widgets
//               // Hand-written escape-hatch modules (when needed for
//               // widgets the codegen can't yet wrap) go here:
//               // 'skal-foo': {Foo: 'foo'},
//             },
//           }]],
//         },
//       }),
//     ],
//   });
//
// Two return values bundled in one object because the same manifest
// drives both the virtual module AND the macro config — calling the
// plugin twice with the same manifest path would parse it twice.

import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

// Default module name reflects the BACKEND, not the implementation.
// The `skal` module ships the intrinsic widgets defined by Skal's
// wire protocol — universal across hosts (Flutter / RN / web /
// native, anyone who implements the bridge). `skal-flutter` ships
// widgets wrapped from pub.dev — inherently Flutter-bound, since
// the codegen output references Flutter classes directly.
//
// Future backends would follow the same pattern: `skal-rn`,
// `skal-uikit`, etc. The dev's import line tells them at a glance
// whether the symbol is portable.
const VIRTUAL_MODULE_ID = 'skal-flutter';
// Vite convention: virtual modules start with `\0` after resolution
// so other plugins don't try to resolve them as filesystem paths.
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_MODULE_ID;

/**
 * @typedef {Object} SkalCodegenOptions
 * @property {string} [manifest]    Path to a single skal_codegen.json
 *   manifest. Resolved relative to the directory containing
 *   vite.config.js. Either this OR [manifests] must be provided.
 * @property {string[]} [manifests]   Multiple manifest paths to merge.
 *   Use this when both the local CLI and build_runner emit manifests
 *   in the same project. Later entries override earlier ones on key
 *   collision (last-wins, matches Object spread semantics).
 * @property {string} [moduleName]   Override the virtual module
 *   name. Default `skal-flutter`. Override when running multiple
 *   codegen pipelines side-by-side (e.g. one per backend), since
 *   each pipeline owns its own module namespace.
 */

/**
 * @typedef {Object} SkalCodegenHandles
 * @property {import('vite').Plugin} vitePlugin   Drop into vite's
 *   `plugins:` array.
 * @property {Record<string, Record<string, string>>} macroModules
 *   Spread into the babel-plugin-skal-jsx `modules:` option.
 */

/**
 * Wire up the manifest-driven JSX side of the codegen workflow.
 * Returns both a Vite plugin (for the virtual module) and a macro
 * config fragment (for the babel-plugin-skal-jsx). They share the
 * single manifest read.
 *
 * @param {SkalCodegenOptions} opts
 * @returns {SkalCodegenHandles}
 */
export function skalCodegen(opts) {
  if (!opts || (!opts.manifest && !opts.manifests)) {
    throw new Error(
      "skalCodegen: required option 'manifest' or 'manifests' missing"
    );
  }
  const moduleName = opts.moduleName || VIRTUAL_MODULE_ID;
  const virtualId = '\0' + moduleName;

  // Normalize to an array so the merge loop is uniform whether the
  // dev passed one manifest or several.
  const manifestRefs = opts.manifests || [opts.manifest];

  // Resolve each manifest path against process.cwd() (the dev's
  // vite.config.js dir). Read at plugin-construction time so the
  // macro modules fragment is ready synchronously when the consumer's
  // vite.config.js references it.
  const manifestPaths = manifestRefs.map((m) =>
    resolvePath(process.cwd(), m)
  );

  // Merge widgets across all manifests into a single map. Pulled out
  // into a helper so the dev-server hot-reload path can call it on
  // each manifest mtime change, not just at startup.
  function _mergeManifests() {
    const merged = {};
    for (const path of manifestPaths) {
      const next = _readManifest(path);
      for (const [name, regKey] of Object.entries(next)) {
        if (Object.prototype.hasOwnProperty.call(merged, name)) {
          const prevRegKey = merged[name];
          if (prevRegKey !== regKey) {
            // eslint-disable-next-line no-console
            console.warn(
              `[skal-codegen] manifest collision: <${name}> declared in `
              + `multiple manifests (was '${prevRegKey}', now '${regKey}' `
              + `from ${path}). Later manifest wins; earlier wrap will `
              + `not dispatch. To shadow intentionally, ignore this warning.`,
            );
          }
        }
        merged[name] = regKey;
      }
    }
    return merged;
  }

  // Mutable across hot reloads: the virtual module's `load()` reads
  // `widgets` each call so a re-merge after a file change is visible
  // immediately. The startup read populates the macroModules fragment
  // (whose shape is frozen into the babel config at vite-config-eval
  // time — see the limitation note at the bottom of handleHotUpdate).
  let widgets = _mergeManifests();
  const macroModules = { [moduleName]: { ...widgets } };

  /** @type {import('vite').Plugin} */
  const vitePlugin = {
    name: 'skal-codegen',
    resolveId(source) {
      if (source === moduleName) return virtualId;
      return null;
    },
    load(id) {
      // Re-synthesize on every load — when handleHotUpdate invalidates
      // the virtual module after a manifest change, the next load()
      // call sees the freshly-merged widget set without restarting Vite.
      if (id === virtualId) return _synthesizeModule(widgets, moduleName);
      return null;
    },
    // Re-read the manifest(s) on changes so `build_runner watch` +
    // `vite dev` together pick up newly-generated widgets without a
    // full restart. Skipped on production builds (`buildStart` fires
    // there too, but the file watcher isn't running).
    buildStart() {
      for (const p of manifestPaths) {
        if (existsSync(p)) this.addWatchFile(p);
      }
    },
    // Dev-server hot reload: when one of our manifest files changes,
    // re-merge them and invalidate the virtual module. Vite then
    // refetches the module via `load()`, which now returns the
    // re-synthesized source for the new widget set. The babel macro
    // config is locked at vite-config-eval time, so this hot-reloads
    // the IMPORT shape (re-emitted stub bodies) — net-new widgets
    // also become available to dev imports without a restart, but
    // JSX that uses them needs the dev to nudge the source file (the
    // babel transform doesn't re-evaluate macro config across HMR).
    // Existing imports of existing widgets reflect updates immediately.
    handleHotUpdate({ file, server }) {
      if (!manifestPaths.includes(file)) return;
      widgets = _mergeManifests();
      const mod = server.moduleGraph.getModuleById(virtualId);
      if (mod) {
        server.moduleGraph.invalidateModule(mod);
        return [mod];
      }
    },
  };

  return { vitePlugin, macroModules };
}

function _readManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    // No manifest yet — dev hasn't run build_runner. Return an empty
    // widget set; the virtual module will be empty, the macro config
    // will be a no-op. Vite still picks up the empty module without
    // error, so the dev can build their JSX shell before codegen
    // catches up.
    return {};
  }
  const json = readFileSync(manifestPath, 'utf-8');
  const parsed = JSON.parse(json);
  const widgets = (parsed && parsed.widgets) || {};
  if (typeof widgets !== 'object' || Array.isArray(widgets)) return {};
  return widgets;
}

function _synthesizeModule(widgets, moduleName) {
  // Build with a regular array of plain string literals — backticks
  // in the synthesized SOURCE need to survive into the emitted module
  // text. Doing it as a template literal in THIS file would have
  // required double-escaping every backtick. The throw message uses
  // ordinary string concatenation so the synthesized source is plain
  // ASCII without any nested template-literal escaping.
  // Use the actual moduleName in the error so the dev sees which
  // import source the broken JSX came from (the same module might
  // be aliased to different names across configs).
  const errMsg =
    '"' + moduleName + ': <" + name + "> was used without the ' +
    "babel-plugin-skal-jsx transform recognizing '" + moduleName + "'. " +
    'Ensure the consumer\\u0027s vite.config.js spreads ' +
    'codegen.macroModules into the macro\\u0027s modules option."';
  const lines = [
    '// SYNTHESIZED at build time by vite-plugin-skal-codegen.js',
    `// from the codegen JSON manifest. Module name: '${moduleName}'.`,
    '//',
    '// In a correctly-configured build the babel-plugin-skal-jsx',
    '// transform strips these imports before they reach the runtime,',
    '// rewriting <ClassName ...> JSX directly to the lowercase intrinsic',
    '// tag. The function bodies below only execute if the macro misses',
    '// — in which case the throw surfaces the misconfiguration with a',
    '// pointer to the fix.',
    '',
    'function _makeMissingMacroComponent(name) {',
    '  return function() {',
    `    throw new Error(${errMsg});`,
    '  };',
    '}',
    '',
  ];
  for (const className of Object.keys(widgets).sort()) {
    lines.push(
      `export const ${className} = _makeMissingMacroComponent('${className}');`,
    );
  }
  if (Object.keys(widgets).length === 0) {
    lines.push(
      '// (manifest is empty — `dart run build_runner build` to populate)',
    );
  }
  lines.push('');
  return lines.join('\n');
}
