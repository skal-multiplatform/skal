// JSX in this file compiles against `skal/renderer-web` (the DOM
// target) — set up by vite.config.js's second solid() plugin
// matching `*.dom.jsx`. The outer App.jsx compiles against
// `skal/renderer` (the bridge target). Same Skal components, same
// babel macro lowering — only the renderer module that `createElement`
// resolves to differs.
//
// Used by App.jsx's `registerHtmlView('skal-jsx-counter', …)` factory:
// the JSX here builds DOM elements (Skal-styled <div>/<span>/<button>
// trees) that Flutter Web composites into the page via
// HtmlElementView.

import { Column, Row, Text, Button } from 'skal';
import { createSignal } from 'solid-js';

export function EmbedSkalCounter() {
  const [n, setN] = createSignal(0);
  return (
    <Column gap={8} padding={12} background="#FFF8FAFC" cornerRadius={10}>
      <Text
        label={`Skal JSX inside HtmlEmbed (DOM render) — n = ${n()}`}
        fontSize={13}
        fontWeight={600}
        color="#FF1A1A2E"
      />
      <Row gap={8}>
        <Button label="+1" onClick={() => setN((c) => c + 1)} />
        <Button label="-1" onClick={() => setN((c) => c - 1)} />
        <Button label="reset" onClick={() => setN(0)} />
      </Row>
      <Text
        label="Same <Column>/<Text>/<Button> syntax as App.jsx — just compiled with moduleName: skal/renderer-web because this file is *.dom.jsx. The babel macro + skal-flutter codegen vocab work identically; only the sink (DOM vs bridge) changes."
        fontSize={11}
        color="#FF4A4A5E"
      />
    </Column>
  );
}
