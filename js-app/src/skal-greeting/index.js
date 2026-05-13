// skal-greeting — example Skal adapter package.
//
// In production this would live as its own pub.dev + npm publication
// (e.g. `skal_greeting` for the Dart adapter, `skal-greeting` for the
// JS-side component export). For now it sits in the demo tree to
// validate the substrate end-to-end.
//
// Mechanics:
//
//   1. The dev's pubspec.yaml depends on the Dart package; the dev's
//      main() calls its `registerAll()` (or relies on codegen to do
//      so) to register a Widget builder under the name "greeting" in
//      SkalRegistry.
//
//   2. The dev's vite.config.js adds this module to the babel macro's
//      `modules` option so `<Greeting>` JSX gets lowered to the
//      `<greeting>` intrinsic tag at compile time.
//
//   3. The babel macro strips this import line; the runtime exports
//      below are dead code in a correctly-configured build. They
//      exist only so a misconfigured build throws a helpful error
//      instead of rendering blank.
//
//   4. JSX consumers do:
//
//        import { Greeting } from 'skal-greeting';
//        <Greeting name="Skal" color="#FF1DA1F2" fontSize={24} />
//
//      and get hover docs + prop type-check from the JSDoc below.

function makeMissingMacroComponent(name) {
  return function _skalMissingMacro() {
    throw new Error(
      `skal-greeting: <${name}> was used without the babel-plugin-skal-jsx ` +
      `transform recognizing this module. Add 'skal-greeting' to the ` +
      `plugin's \`modules\` option in vite.config.js.`
    );
  };
}

/**
 * @typedef {Object} GreetingProps
 * @property {string} [name]      who to greet (default "World")
 * @property {string | number} [color]   ARGB hex (`"#FF1DA1F2"`) or u32
 * @property {number} [fontSize]  in dp, default 24
 */

/**
 * Example "hello world" custom widget. Renders a styled Text greeting.
 * Useful as a smoke test for the SkalRegistry substrate — it exercises
 * string props (`name`), color props (`color`), and float props
 * (`fontSize`) without pulling in any third-party Flutter dependency.
 *
 * @type {(props: GreetingProps) => import('solid-js').JSX.Element}
 */
export const Greeting = makeMissingMacroComponent('Greeting');
