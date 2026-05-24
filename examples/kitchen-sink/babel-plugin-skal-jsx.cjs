// Babel plugin — rewrites capitalized JSX tags like <Column> back to
// their lowercase intrinsic form <column> at build time, but ONLY
// when the capitalized identifier was imported from a module the
// plugin has been told to recognize. Other capitalized tags (user
// components like <Tweet>, third-party imports from unrecognized
// modules) are left alone.
//
// Why this exists:
//
//   Solid's babel preset treats capitalized JSX tags as function
//   components — `<Column>` compiles to `createComponent(Column, …)`,
//   which calls the imported `Column` function. That call sets up a
//   reactive owner scope, runs a one-line wrapper, then re-emits a
//   lowercase intrinsic call. The chain adds ~200–500 ns per node
//   mount — a few ms on a 30K-node tree.
//
//   This plugin moves the rewrite to compile time. Capitalized JSX
//   in source becomes lowercase JSX in the AST that Solid's preset
//   then processes, producing the same fast intrinsic call path
//   used by the original lowercase syntax. Zero runtime overhead;
//   the developer still gets capitalized JSX for IDE auto-complete,
//   type safety (via JSDoc @type annotations), and refactoring tools.
//
// Why all work happens in Program.enter:
//
//   Naively, you'd put separate ImportDeclaration / JSXOpeningElement
//   visitors at the top level and trust babel's "plugins run before
//   presets" rule. That works for ImportDeclaration but NOT for JSX —
//   solid's preset traverses via JSXElement enter, replacing the
//   subtree with a CallExpression in one shot. If our JSXOpeningElement
//   visitor is in a separate visitor map, babel interleaves the two —
//   and in practice solid's JSXElement.enter wins, replacing the JSX
//   before our visitor sees the children.
//
//   The fix: do everything inside our Program.enter, using
//   `path.traverse(...)` to walk the whole tree manually. That happens
//   in a single subtree pass that completes BEFORE solid's preset
//   gets to run any of its visitors on the descendants. By the time
//   the main traversal reaches the body, we've already lowercased
//   the JSX and stripped the imports — solid sees a clean lowercase
//   AST.
//
// Multi-module support:
//
//   The `'skal'` module ships with the framework and provides the
//   built-in widgets. Third-party Flutter-package wrappers (e.g.
//   `skal_image_picker`) ship their own modules with their own
//   capitalized names. The plugin accepts:
//
//     [skalJsxPlugin, {
//       moduleName: 'skal',            // built-ins (legacy single-module)
//       modules: {                     // additional modules + their names
//         'skal_image_picker': { ImagePicker: 'imagePicker' },
//         'skal_video_player': { VideoPlayer: 'videoPlayer' },
//       },
//     }]
//
//   For custom widgets, the lowered tag name is camelCase (first
//   letter lowercased) and matches the registry key on the Dart
//   side. The renderer.js fallthrough hits the custom path for any
//   tag it doesn't recognize in its built-in TAG_TO_WIDGET, so the
//   lowered name flows through naturally.
//
// Pattern reference: this is the same trick used by MDX,
// vanilla-extract, babel-plugin-styled-components — scope-aware
// import rewriting.

const DEFAULT_MODULE = 'skal';

// Canonical map: capitalized JSX identifier → lowercase intrinsic tag
// name that the renderer's TAG_TO_WIDGET map recognizes. Identity case
// for most; Container is the Flutter-aligned alias for Box.
//
// Adding a new built-in widget: one entry here + matching lowercase
// tag in renderer.js's TAG_TO_WIDGET + matching wt constant in
// wire.dart/bridge.js + matching _build* in root.dart.
//
// Adding a third-party custom widget: don't touch this map — the
// adapter package provides its own name map via the `modules` option.
const BUILT_IN_WIDGET_NAMES = {
  Box:                  'box',
  Container:            'box',
  Column:               'column',
  Row:                  'row',
  Text:                 'text',
  Button:               'button',
  ScrollView:           'scrollView',
  ListView:             'listView',
  ReorderableListView:  'reorderableListView',
  Image:                'image',
  Stack:                'stack',
  Switch:               'switch',
  Slider:               'slider',
  Checkbox:             'checkbox',
  ActivityIndicator:    'activityIndicator',
  ProgressBar:          'progressBar',
  LazyGrid:             'lazyGrid',
  Wrap:                 'wrap',
  SafeArea:             'safeArea',
  RichText:             'richText',
  TextInput:            'textInput',
  Navigator:            'navigator',
  Screen:               'screen',
  Tabs:                 'tabs',
  Tab:                  'tab',
  AnimatedList:         'animatedList',
  CrossFade:            'crossFade',
  Hero:                 'hero',
  ListTile:             'listTile',
  PageView:             'pageView',
  Dismissible:          'dismissible',
  CustomScrollView:     'customScrollView',
  SliverAppBar:         'sliverAppBar',
  SliverList:           'sliverList',
  SliverGrid:           'sliverGrid',
  Canvas:               'canvas',
  DragItem:             'dragItem',
  DropZone:             'dropZone',
  Radio:                'radio',
  Chip:                 'chip',
  SegmentedButton:      'segmentedButton',
  ExpansionTile:        'expansionTile',
  Dropdown:             'dropdown',
  Stepper:              'stepper',
  Step:                 'step',
  Drawer:               'drawer',
  BottomSheet:          'bottomSheet',
  BackdropFilter:       'backdropFilter',
  InteractiveViewer:    'interactiveViewer',
  // Shape C — visible Flutter Web rendering inside a DOM region.
  // Web-only intrinsic; on native it's an unknown tag (nothing to
  // render — would require a Flutter-side handler that doesn't exist).
  FlutterEmbed:         'flutterEmbed',
};

module.exports = function ({ types: t }) {
  return {
    name: 'skal-jsx',
    visitor: {
      Program(path, state) {
        // Build the full module → names map from the plugin options.
        // The default 'skal' module is always present; additional
        // modules are merged in. A user can override 'skal' by setting
        // `moduleName` (legacy) or putting an entry under that key in
        // `modules` (current).
        const moduleName = state.opts.moduleName || DEFAULT_MODULE;
        const moduleToNames = new Map();
        moduleToNames.set(moduleName, BUILT_IN_WIDGET_NAMES);
        if (state.opts.modules && typeof state.opts.modules === 'object') {
          for (const m of Object.keys(state.opts.modules)) {
            const overlay = state.opts.modules[m];
            if (overlay && typeof overlay === 'object') {
              // Allow `modules['skal']` to extend built-ins rather than
              // shadow them — `{...builtins, ...overlay}` semantics.
              moduleToNames.set(m, m === moduleName
                ? { ...BUILT_IN_WIDGET_NAMES, ...overlay }
                : overlay);
            }
          }
        }

        // Per-file state: which local identifiers map to which intrinsic
        // tag names. Built from `import` declarations in the first pass.
        const localToIntrinsic = new Map();

        // ── First pass: harvest skal imports, strip them ───────────
        path.get('body').forEach((stmt) => {
          if (!stmt.isImportDeclaration()) return;
          const source = stmt.node.source.value;
          const nameMap = moduleToNames.get(source);
          if (!nameMap) return;

          const remaining = [];
          for (const spec of stmt.node.specifiers) {
            if (!t.isImportSpecifier(spec)) {
              remaining.push(spec);
              continue;
            }
            // `import { Column }` vs `import { Column as Col }`:
            //   spec.imported.name = 'Column' (canonical)
            //   spec.local.name    = 'Col'    (whatever the user used)
            // JSX references `Col`, so we key the rewrite map on local.
            const importedName = spec.imported.name;
            const localName = spec.local.name;
            const intrinsic = nameMap[importedName];
            if (intrinsic) {
              localToIntrinsic.set(localName, intrinsic);
              // (specifier dropped — JSX usages will be lowered)
            } else {
              remaining.push(spec);
            }
          }

          if (remaining.length === 0) {
            stmt.remove();
          } else {
            stmt.node.specifiers = remaining;
          }
        });

        if (localToIntrinsic.size === 0) return;

        // ── Second pass: lowercase matching JSX tags ───────────────
        // Manual traversal so this completes BEFORE solid's preset
        // visitors run on the descendants.
        path.traverse({
          JSXOpeningElement(p) {
            const n = p.node.name;
            if (!t.isJSXIdentifier(n)) return;
            const intrinsic = localToIntrinsic.get(n.name);
            if (!intrinsic) return;
            n.name = intrinsic;
          },
          JSXClosingElement(p) {
            const n = p.node.name;
            if (!t.isJSXIdentifier(n)) return;
            const intrinsic = localToIntrinsic.get(n.name);
            if (!intrinsic) return;
            n.name = intrinsic;
          },
        });
      },
    },
  };
};
