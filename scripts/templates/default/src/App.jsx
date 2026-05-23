// __APP_NAME__ — Skal app entry. Edit this file to build your UI.
//
// Capitalized JSX tags (<Column>, <Row>, <Text>, <Button>) compile
// down to lowercase intrinsic tags at build time (see the
// `babel-plugin-skal-jsx` macro in vite.config.js), so they cost
// nothing at runtime.

import { createSignal } from 'solid-js';
import { Column, Row, Text, Button } from 'skal';

export default function App() {
  const [count, setCount] = createSignal(0);

  return (
    <Column padding={24} gap={16} background="#FFF2F2F7">
      <Text label="Hello, Skal" fontSize={28} fontWeight={800} color="#FF1C1C1E" />
      <Text label="Edit src/App.jsx to start building." fontSize={14} color="#FF8E8E93" />
      <Row gap={12}>
        <Button label={`Tapped ${count()} time${count() === 1 ? '' : 's'}`} onClick={() => setCount(c => c + 1)} />
        <Button label="Reset" onClick={() => setCount(0)} />
      </Row>
    </Column>
  );
}
