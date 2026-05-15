// Skal — component demo.
//
// Exercises every fast-path widget plus the three subsystems:
// animation (`animate` prop), the design system (`setDesign`), and
// the imperative dialog API (`showDialog` / `showActionSheet` /
// `showSnackbar`).
//
// JSX conventions used here:
//   • Return a single root element (a <ListView>), never a fragment.
//   • Reactive props use a DIRECT signal-call expression
//     (`label={`x ${sig()}`}`), never an arrow wrapper — Solid's
//     babel plugin must see the signal call to make it reactive.
//   • <For> diffs lists into minimal bridge add/remove ops.

import { createSignal, For } from 'solid-js';
import {
  Box, Column, Row, Text, Button, ListView,
  Image, Stack, Switch, Slider, Checkbox, ActivityIndicator,
  ProgressBar, LazyGrid, Wrap, SafeArea, RichText, ReorderableListView,
  TextInput,
} from 'skal';
import {
  setDesign, showDialog, showActionSheet, showSnackbar,
} from './renderer.js';

// ── Palette — module scope so the bridge's prop-diff cache hits on
//    identical color strings across every node. ───────────────────
const BG     = '#FFF2F2F7';
const CARD   = '#FFFFFFFF';
const BORDER = '#FFE5E5EA';
const INK    = '#FF1C1C1E';
const SUBTLE = '#FF8E8E93';
const ACCENT = '#FF0A84FF';
const GREEN  = '#FF34C759';
const ORANGE = '#FFFF9F0A';
const RED    = '#FFFF3B30';
const PURPLE = '#FF5E5CE6';
const CHIP   = '#FFEFEFF4';

/** A titled card. A plain Solid component — not a Skal intrinsic, so
 *  the babel plugin leaves `<Section>` as a `createComponent` call. */
function Section(props) {
  return (
    <Column
      background={CARD}
      cornerRadius={14}
      padding={16}
      gap={12}
      borderWidth={1}
      borderColor={BORDER}
    >
      <Text label={props.title} fontSize={15} fontWeight={800} color={INK} />
      {props.children}
    </Column>
  );
}

export default function App() {
  const [mode, setMode]       = createSignal('material');
  const [dark, setDark]       = createSignal(false);
  const [sw, setSw]           = createSignal(true);
  const [cb, setCb]           = createSignal(false);
  const [slider, setSlider]   = createSignal(40);
  const [name, setName]       = createSignal('');
  const [animOn, setAnimOn]   = createSignal(false);
  const [gesture, setGesture] = createSignal('none yet');
  const [dialog, setDialog]   = createSignal('— try a dialog button —');
  const [rows, setRows]       = createSignal(
    ['First item', 'Second item', 'Third item', 'Fourth item'],
  );

  // setDesign writes a wire op; the host rebuilds its MaterialApp
  // theme + CupertinoTheme in response.
  const applyDesign = (m, d) => {
    setMode(m);
    setDark(d);
    setDesign(m, d ? 1 : 0);
  };

  return (
    <ListView background={BG} padding={16} gap={14}>
      <Text label="Skal — Component Demo" fontSize={24} fontWeight={800} color={INK} />
      <Text
        label="Every fast-path widget, plus animation, the design system, and dialogs."
        fontSize={13}
        color={SUBTLE}
      />

      {/* ── Design system ───────────────────────────────────────── */}
      <Section title="Design system — setDesign()">
        <Text
          label={`active: ${mode()} · ${dark() ? 'dark' : 'light'}`}
          fontSize={13}
          color={SUBTLE}
        />
        <Row gap={8}>
          <Button label="Material" onClick={() => applyDesign('material', dark())} />
          <Button label="Cupertino" onClick={() => applyDesign('cupertino', dark())} />
          <Button
            label={dark() ? 'Light mode' : 'Dark mode'}
            onClick={() => applyDesign(mode(), !dark())}
          />
        </Row>
        <Text
          label="Buttons, switches, sliders, the text field & spinner all swap Material↔Cupertino."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Layout ──────────────────────────────────────────────── */}
      <Section title="Layout — box · row · wrap">
        <Row gap={8}>
          <Box width={56} height={56} background={ACCENT} cornerRadius={10} />
          <Box width={56} height={56} background={GREEN} cornerRadius={10} />
          <Box width={56} height={56} background={ORANGE} cornerRadius={10} />
        </Row>
        <Text label="Wrap — children flow onto new runs:" fontSize={11} color={SUBTLE} />
        <Wrap gap={6}>
          <For each={['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa']}>
            {(t) => (
              <Box
                background={CHIP}
                cornerRadius={12}
                paddingLeft={10}
                paddingRight={10}
                paddingTop={6}
                paddingBottom={6}
              >
                <Text label={t} fontSize={12} color={INK} />
              </Box>
            )}
          </For>
        </Wrap>
      </Section>

      {/* ── Stack ───────────────────────────────────────────────── */}
      <Section title="Stack — overlap + positioned children">
        <Stack width="fill" height={120}>
          <Box width="fill" height={120} background={PURPLE} cornerRadius={12} />
          <Box
            top={10}
            left={10}
            background={CARD}
            cornerRadius={8}
            paddingLeft={10}
            paddingRight={10}
            paddingTop={4}
            paddingBottom={4}
          >
            <Text label="top · left" fontSize={11} color={INK} />
          </Box>
          <Box bottom={10} right={10} width={30} height={30} background={RED} cornerRadius={15} />
        </Stack>
      </Section>

      {/* ── Text & RichText ─────────────────────────────────────── */}
      <Section title="Text & RichText">
        <Text label="Styled text — 18sp, weight 700." fontSize={18} fontWeight={700} color={INK} />
        <RichText>
          <Text label="Rich text " fontSize={16} color={INK} />
          <Text label="mixes " fontSize={16} color={ACCENT} fontWeight={800} />
          <Text label="size, " fontSize={22} color={RED} fontWeight={700} />
          <Text label="weight " fontSize={16} color={GREEN} fontWeight={800} />
          <Text label="and colour inline." fontSize={16} color={INK} />
        </RichText>
      </Section>

      {/* ── Image ───────────────────────────────────────────────── */}
      <Section title="Image — network · BoxFit · rounded">
        <Image
          src="https://picsum.photos/seed/skal/640/360"
          width="fill"
          height={160}
          contentScale={1}
          cornerRadius={12}
        />
        <Text
          label="contentScale=1 (cover); cornerRadius clips the pixels. Requires network."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Scrolling ───────────────────────────────────────────── */}
      <Section title="Scrolling — horizontal list · lazy grid · reorderable">
        <Text label="listView axis=1 (horizontal, virtualized):" fontSize={11} color={SUBTLE} />
        <ListView axis={1} height={66} gap={8}>
          <For each={[ACCENT, GREEN, ORANGE, PURPLE, RED, '#FF00C7BE', '#FFAF52DE', '#FFFFD60A']}>
            {(c) => <Box width={66} height={50} background={c} cornerRadius={10} />}
          </For>
        </ListView>
        <Text label="lazyGrid — crossAxisCount=4:" fontSize={11} color={SUBTLE} />
        <LazyGrid crossAxisCount={4} aspectRatio={1} gap={8} height={150}>
          <For each={Array.from({ length: 12 }, (_, i) => i)}>
            {(i) => (
              <Box
                background={i % 3 === 0 ? ACCENT : i % 3 === 1 ? GREEN : ORANGE}
                cornerRadius={8}
              />
            )}
          </For>
        </LazyGrid>
        <Text label="reorderableListView — drag a row to reorder:" fontSize={11} color={SUBTLE} />
        <ReorderableListView
          height={200}
          gap={6}
          onReorder={(from, to) => {
            // The app owns the list — reorder the source array so the
            // new order sticks (otherwise the next diff snaps it back).
            const next = rows().slice();
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            setRows(next);
          }}
        >
          <For each={rows()}>
            {(t) => (
              <Box background={CHIP} cornerRadius={8} padding={12}>
                <Text label={t} fontSize={13} color={INK} />
              </Box>
            )}
          </For>
        </ReorderableListView>
      </Section>

      {/* ── Controls ────────────────────────────────────────────── */}
      <Section title="Controls — switch · checkbox · slider · text field">
        <Row gap={12}>
          <Switch checked={sw()} onChange={(v) => setSw(v)} />
          <Text label={sw() ? 'switch: on' : 'switch: off'} fontSize={13} color={INK} />
        </Row>
        <Row gap={12}>
          <Checkbox checked={cb()} onChange={(v) => setCb(v)} />
          <Text
            label={cb() ? 'checkbox: checked' : 'checkbox: unchecked'}
            fontSize={13}
            color={INK}
          />
        </Row>
        <Slider value={slider()} min={0} max={100} onChange={(v) => setSlider(v)} />
        <Text label={`slider: ${Math.round(slider())}`} fontSize={13} color={INK} />
        <TextInput
          value={name()}
          placeholder="Type your name…"
          onChange={(v) => setName(v)}
          onSubmit={(v) => showSnackbar(`Submitted: ${v}`)}
        />
        <Text
          label={name() ? `Hello, ${name()}!` : '— type above; press Enter to submit —'}
          fontSize={13}
          color={SUBTLE}
        />
      </Section>

      {/* ── Indicators ──────────────────────────────────────────── */}
      <Section title="Indicators — spinner · progress bar">
        <Row gap={12}>
          <ActivityIndicator color={ACCENT} />
          <Text label="CircularProgressIndicator" fontSize={13} color={INK} />
        </Row>
        <Text label="determinate — tracks the slider above:" fontSize={11} color={SUBTLE} />
        <ProgressBar progress={slider() / 100} color={ACCENT} />
        <Text label="indeterminate:" fontSize={11} color={SUBTLE} />
        <ProgressBar color={GREEN} />
      </Section>

      {/* ── Animation ───────────────────────────────────────────── */}
      <Section title="Animation — animate prop (Dart-side tween)">
        <Row gap={8}>
          <Box
            width={64}
            height={64}
            background={ACCENT}
            cornerRadius={14}
            animate={{ duration: 450, curve: 'easeInOut' }}
            opacity={animOn() ? 0.3 : 1}
            scaleX={animOn() ? 1.4 : 1}
            scaleY={animOn() ? 1.4 : 1}
            rotation={animOn() ? 0.5 : 0}
            translationX={animOn() ? 70 : 0}
          />
        </Row>
        <Button
          label={animOn() ? 'Reset' : 'Animate'}
          onClick={() => setAnimOn(!animOn())}
        />
        <Text
          label="opacity + scale + rotation + translation tween together — JS only flips one signal; the whole tween runs host-side."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Gestures ────────────────────────────────────────────── */}
      <Section title="Gestures — onTap · onLongPress · onDoubleTap">
        <Box
          background={CHIP}
          cornerRadius={12}
          padding={22}
          onTap={() => setGesture('onTap')}
          onLongPress={() => setGesture('onLongPress')}
          onDoubleTap={() => setGesture('onDoubleTap')}
        >
          <Text label="Tap / long-press / double-tap this box" fontSize={13} color={INK} />
        </Box>
        <Text label={`last gesture: ${gesture()}`} fontSize={12} color={SUBTLE} />
      </Section>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <Section title="Dialogs — imperative JS API">
        <Row gap={8}>
          <Button
            label="Alert"
            onClick={async () => {
              await showDialog({
                title: 'Heads up',
                message: 'A plain alert dialog.',
                actions: [{ label: 'OK', value: 'ok' }],
              });
              setDialog('alert: dismissed');
            }}
          />
          <Button
            label="Confirm"
            onClick={async () => {
              const r = await showDialog({
                title: 'Delete file?',
                message: 'This cannot be undone.',
                actions: [
                  { label: 'Cancel', value: 'cancel' },
                  { label: 'Delete', value: 'delete', style: 'destructive' },
                ],
              });
              setDialog(`confirm → ${r ?? 'dismissed'}`);
            }}
          />
        </Row>
        <Row gap={8}>
          <Button
            label="Action sheet"
            onClick={async () => {
              const r = await showActionSheet({
                title: 'Choose an action',
                actions: [
                  { label: 'Copy', value: 'copy' },
                  { label: 'Share', value: 'share' },
                  { label: 'Delete', value: 'delete', style: 'destructive' },
                ],
              });
              setDialog(`sheet → ${r ?? 'cancelled'}`);
            }}
          />
          <Button
            label="Snackbar"
            onClick={() => {
              showSnackbar('Hello from a snackbar 👋');
              setDialog('snackbar: shown');
            }}
          />
        </Row>
        <Text label={dialog()} fontSize={12} color={SUBTLE} />
      </Section>

      {/* ── SafeArea ────────────────────────────────────────────── */}
      <Section title="SafeArea">
        <SafeArea>
          <Box background={CHIP} cornerRadius={8} padding={14}>
            <Text
              label="Insets past notches & system bars. (No visible effect here — the app root already applies one.)"
              fontSize={12}
              color={INK}
            />
          </Box>
        </SafeArea>
      </Section>

      <Text label="— end of demo —" fontSize={12} color={SUBTLE} />
    </ListView>
  );
}
