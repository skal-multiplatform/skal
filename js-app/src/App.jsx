// Skal — demo app.
//
// Three bottom tabs (NAVIGATION.md Phase 3):
//   • UI    — every fast-path widget, animation, design system, dialogs,
//             nested navigation + tabs.
//   • List  — the virtualized tweet feed (a 15 000-item stress source).
//   • Libs  — codegen-wrapped third-party / custom widgets: QR code,
//             shimmer, camera, counter, ticker (JS↔Dart RPC), stickers.
//
// The root `<Tabs>` keeps every tab subtree alive (IndexedStack) — so
// switching tabs never re-mounts; scroll position and signal state on
// each tab survive.

import { createSignal, createMemo, For, onMount } from 'solid-js';
import {
  Box, Column, Row, Text, Button, ListView, ScrollView,
  Image, Stack, Switch, Slider, Checkbox, ActivityIndicator,
  ProgressBar, LazyGrid, Wrap, SafeArea, RichText, ReorderableListView,
  TextInput, Tabs, Tab, Hero, AnimatedList, CrossFade, ListTile, PageView,
  Dismissible, CustomScrollView, SliverAppBar, SliverList, SliverGrid, Canvas,
  DragItem, DropZone, Radio, Chip, SegmentedButton, ExpansionTile, Dropdown,
  Stepper, Step, Drawer, BottomSheet, BackdropFilter, InteractiveViewer,
} from 'skal';
import {
  setDesign, showDialog, showActionSheet, showSnackbar,
  showDatePicker, showTimePicker,
} from './renderer.js';
import { createRouter, createSkalRef } from './skal-runtime.jsx';
import { createSkalStore } from './skal/store/store.js';
// `skal-flutter` — codegen-wrapped widgets (custom adapters + pub.dev
// packages). The separate import source tells the dev at a glance that
// these are Flutter-bound, not portable Skal intrinsics. Auto-discovered
// from the codegen manifests; see vite-plugin-skal-codegen.js.
import {
  Greeting,
  Stickers,
  Counter,
  QrImageView,
  ShimmerFromColors,
  Camera,
  Ticker,
} from 'skal-flutter';

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

// ════════════════════════════════════════════════════════════════════
// UI tab — the fast-path component demo.
// ════════════════════════════════════════════════════════════════════

// ── Navigation demo — two screens behind a createRouter() ─────────

/** List screen — tapping a row pushes the detail screen. The route's
 *  `title` ("Mailboxes") renders as the screen's AppBar. A `<Drawer>`
 *  sibling routes to the screen's Scaffold.drawer slot — the AppBar
 *  hamburger + edge-swipe open it (host-owned, zero bridge traffic). */
function NavList(props) {
  const rows = ['Inbox', 'Starred', 'Drafts', 'Archive'];
  return (
    <>
      <Column background={BG} padding={16} gap={8} height="fill">
        <For each={rows}>
          {(name) => (
            <Box
              background={CARD}
              cornerRadius={8}
              padding={12}
              onTap={() => props.router.navigate('detail', { name }, { title: name })}
            >
              <Text label={`${name}   ›`} fontSize={14} color={INK} />
            </Box>
          )}
        </For>
      </Column>
      <Drawer background={CARD}>
        <Box padding={20} background={ACCENT}>
          <Text label="Mail" fontSize={20} fontWeight={800} color="#FFFFFF" />
        </Box>
        <For each={rows}>
          {(name) => (
            <Box padding={14}>
              <Text label={name} fontSize={14} color={INK} />
            </Box>
          )}
        </For>
      </Drawer>
    </>
  );
}

/** Detail screen — pushed with a per-route `title`, so its AppBar
 *  carries an automatic back button (NAVIGATION.md Phase 2). No manual
 *  Back affordance needed; the list behind it stays mounted. */
function NavDetail(props) {
  return (
    <Column background={BG} padding={16} gap={10} height="fill">
      <Text label={props.name} fontSize={20} fontWeight={800} color={INK} />
      <Text
        label="The AppBar's ‹ back button (and the system back / swipe gesture) all pop this route. The list screen behind stayed mounted — back is instant, no re-render, scroll preserved."
        fontSize={13}
        color={SUBTLE}
      />
    </Column>
  );
}

// ── Animations page — a dedicated screen, pushed from the UI tab's
//    Animation card. Demos land here as ANIMATION.md phases ship. ──
// Hero-demo swatches — module scope so the prop-diff cache hits.
const HERO_SWATCHES = [ACCENT, GREEN, ORANGE, PURPLE];

function AnimationsPage() {
  const [animOn, setAnimOn]     = createSignal(false);
  const [coldOn, setColdOn]     = createSignal(false);
  const [springOn, setSpringOn] = createSignal(false);
  const [springPos, setSpringPos] = createSignal(0);
  const [dragGlide, setDragGlide] = createSignal('0, 0');
  const [faded, setFaded]       = createSignal(false);
  const [listItems, setListItems] = createSignal(['Alpha', 'Beta', 'Gamma']);
  let itemSeq = 3;

  // A nested screen-stack router for the shared-element (Hero) demo.
  const heroRouter = createRouter({
    gallery: (p) => (
      <Column background={BG} padding={16} gap={12} height="fill">
        <Text label="Tap a swatch — it flies to the detail screen." fontSize={13} color={SUBTLE} />
        <Row gap={12}>
          <For each={HERO_SWATCHES}>
            {(c) => (
              <Hero tag={`hero-${c}`}>
                <Box
                  width={56}
                  height={56}
                  background={c}
                  cornerRadius={12}
                  onTap={() => p.router.navigate('detail', { color: c })}
                />
              </Hero>
            )}
          </For>
        </Row>
      </Column>
    ),
    detail: {
      component: (p) => (
        <Column background={BG} padding={16} gap={12} height="fill">
          <Hero tag={`hero-${p.params.color}`}>
            <Box width="fill" height={180} background={p.params.color} cornerRadius={20} />
          </Hero>
          <Text
            label="The swatch flew here from the gallery — a shared-element transition, GPU-composited host-side."
            fontSize={13}
            color={SUBTLE}
          />
        </Column>
      ),
      title: 'Detail',
      transition: 'fade', // ANIMATION.md §10 — fade page transition
    },
  }, 'gallery');

  return (
    <ScrollView background={BG} padding={16} gap={14}>
      <Text label="Animations" fontSize={24} fontWeight={800} color={INK} />
      <Text
        label="Host-side motion — JS flips one signal, Flutter runs the whole tween. Zero per-frame bridge traffic. See ANIMATION.md for the full plan."
        fontSize={13}
        color={SUBTLE}
      />
      <Section title="Implicit hot-prop tween — the animate prop">
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
      <Section title="Cold-prop tween — colour · radius · padding">
        <Box
          animate={{ duration: 400, curve: 'easeInOut' }}
          background={coldOn() ? RED : ACCENT}
          cornerRadius={coldOn() ? 32 : 8}
          padding={coldOn() ? 28 : 12}
          width="fill"
        >
          <Text
            label="AnimatedContainer tweens these host-side"
            fontSize={12}
            color="#FFFFFFFF"
          />
        </Box>
        <Button
          label={coldOn() ? 'Reset' : 'Animate'}
          onClick={() => setColdOn(!coldOn())}
        />
        <Text
          label="background, cornerRadius and padding are cold props — the host's AnimatedContainer tweens them; JS writes each value once."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      <Section title="Looping — repeat · reverse">
        <Row gap={20}>
          <Box
            width={44}
            height={44}
            background={PURPLE}
            cornerRadius={22}
            animate={{ duration: 800, curve: 'easeInOut', repeat: true, reverse: true }}
            scaleX={1.35}
            scaleY={1.35}
          />
          <Box
            width={44}
            height={44}
            background={GREEN}
            cornerRadius={10}
            animate={{ duration: 1400, repeat: true }}
            rotation={6.2832}
          />
          <Box
            width={44}
            height={44}
            background={ORANGE}
            cornerRadius={22}
            animate={{ duration: 900, curve: 'easeInOut', repeat: true, reverse: true }}
            opacity={0.25}
          />
        </Row>
        <Text
          label="A pulse, a spin and a breathe — each loops forever host-side; JS set the endpoints once and never touches them again."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      <Section title="Spring physics — animate.spring">
        <Column gap={10}>
          <Box
            width={48}
            height={48}
            background={ACCENT}
            cornerRadius={10}
            animate={{ duration: 700, spring: 'gentle' }}
            translationX={springOn() ? 150 : 0}
          />
          <Box
            width={48}
            height={48}
            background={GREEN}
            cornerRadius={10}
            animate={{ duration: 700, spring: 'bouncy' }}
            translationX={springOn() ? 150 : 0}
          />
          <Box
            width={48}
            height={48}
            background={ORANGE}
            cornerRadius={10}
            animate={{ duration: 700, spring: 'stiff' }}
            translationX={springOn() ? 150 : 0}
          />
        </Column>
        <Button
          label={springOn() ? 'Back' : 'Spring'}
          onClick={() => setSpringOn(!springOn())}
        />
        <Text
          label="gentle · bouncy · stiff — three spring-like curves; bouncy overshoots and wobbles into place."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      <Section title="Physics — real SpringSimulation (spring)">
        <Column gap={12}>
          <Box
            width={52}
            height={52}
            background={ACCENT}
            cornerRadius={12}
            spring="gentle"
            translationX={springPos()}
          />
          <Box
            width={52}
            height={52}
            background={GREEN}
            cornerRadius={12}
            spring="bouncy"
            translationX={springPos()}
          />
          <Box
            width={52}
            height={52}
            background={ORANGE}
            cornerRadius={12}
            spring="stiff"
            translationX={springPos()}
          />
        </Column>
        <Button
          label={springPos() === 0 ? 'Spring' : 'Back'}
          onClick={() => setSpringPos(springPos() === 0 ? 175 : 0)}
        />
        <Text
          label="A real SpringSimulation drives these — not a curve. Tap fast: the box retargets from its CURRENT position and velocity mid-flight, with no dead-stop restart. gentle settles, bouncy overshoots, stiff snaps."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      <Section title="Physics — release momentum (draggable + release)">
        <Box height={150} background={CHIP} cornerRadius={12}>
          <Box
            draggable
            release="glide"
            width={60}
            height={60}
            background={ACCENT}
            cornerRadius={14}
            onPanEnd={(x, y) => setDragGlide(`${x.toFixed(0)}, ${y.toFixed(0)}`)}
          >
            <Text label="glide" fontSize={11} color="#FFFFFFFF" />
          </Box>
        </Box>
        <Text
          label={`Throw the blue box — friction carries it on after you let go and decelerates it to rest. Resting at ${dragGlide()}.`}
          fontSize={11}
          color={SUBTLE}
        />
        <Box height={150} background={CHIP} cornerRadius={12}>
          <Box
            draggable
            release="springBack"
            width={60}
            height={60}
            background={PURPLE}
            cornerRadius={14}
          >
            <Text label="spring" fontSize={11} color="#FFFFFFFF" />
          </Box>
        </Box>
        <Text
          label="Throw the purple box — a SpringSimulation springs it home to the origin, seeded with your fling velocity (throw harder → springs back harder). All host-side: zero per-frame bridge traffic."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      <Section title="Cross-fade — CrossFade">
        <Box height={92}>
          <CrossFade>
            {faded()
              ? (
                <Box width="fill" height={92} background={PURPLE} cornerRadius={12} padding={16}>
                  <Text label="Panel B" fontSize={16} fontWeight={800} color="#FFFFFFFF" />
                </Box>
              )
              : (
                <Box width="fill" height={92} background={ACCENT} cornerRadius={12} padding={16}>
                  <Text label="Panel A" fontSize={16} fontWeight={800} color="#FFFFFFFF" />
                </Box>
              )}
          </CrossFade>
        </Box>
        <Button label="Swap panel" onClick={() => setFaded(!faded())} />
        <Text
          label="AnimatedSwitcher fades the old child out as the new fades in — the outgoing element is retained through the fade."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      <Section title="Animated list — AnimatedList">
        <AnimatedList gap={8}>
          <For each={listItems()}>
            {(item) => (
              <Box background={CHIP} cornerRadius={8} padding={12}>
                <Text label={item} fontSize={13} color={INK} />
              </Box>
            )}
          </For>
        </AnimatedList>
        <Row gap={8}>
          <Button
            label="Add"
            onClick={() => setListItems([...listItems(), `Item ${++itemSeq}`])}
          />
          <Button
            label="Remove"
            onClick={() => setListItems(listItems().slice(0, -1))}
          />
        </Row>
        <Text
          label="Add → a row fades + expands in; Remove → it collapses + fades out. Both host-side, via deferred teardown."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      <Section title="Shared element — Hero">
        <Box height={300} borderWidth={1} borderColor={BORDER} cornerRadius={8}>
          <heroRouter.View />
        </Box>
        <Text
          label="A Hero with a matching tag on each screen flies between them across the navigator push — the navigator is a real Flutter Navigator."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      <Text
        label="— end of animations —"
        fontSize={12}
        color={SUBTLE}
      />
    </ScrollView>
  );
}

function UITab() {
  const [mode, setMode]       = createSignal('material');
  const [dark, setDark]       = createSignal(false);
  const [sw, setSw]           = createSignal(true);
  const [cb, setCb]           = createSignal(false);
  const [slider, setSlider]   = createSignal(40);
  const [name, setName]       = createSignal('');
  const [gesture, setGesture] = createSignal('none yet');
  const [page, setPage]       = createSignal(0);
  const [feed, setFeed]       = createSignal(['Item one', 'Item two', 'Item three', 'Item four']);
  let feedSeq = 0;
  const [canvasShapes, setCanvasShapes] = createSignal([]);
  const [dropped, setDropped] = createSignal([]);
  const [pickSize, setPickSize] = createSignal('M');
  const [chosen, setChosen]   = createSignal([]);
  const [seg, setSeg]         = createSignal(0);
  const [expanded, setExpanded] = createSignal(false);
  const [dd, setDd]           = createSignal(0);
  const [step, setStep]       = createSignal(0);
  const [hovered, setHovered] = createSignal(false);
  const [lastKey, setLastKey] = createSignal('—');
  const [dragRest, setDragRest] = createSignal('0, 0');
  const [panDelta, setPanDelta] = createSignal('—');
  const [pinch, setPinch]     = createSignal(1);
  // onScaleUpdate reports scale relative to the gesture START, so we
  // snapshot the live value on scaleStart and multiply — successive
  // pinches then accumulate instead of snapping back to 1×.
  let pinchBase = 1;
  const [dialog, setDialog]   = createSignal('— try a dialog button —');
  const [picked, setPicked]   = createSignal('— no date / time picked —');
  const [rows, setRows]       = createSignal(
    ['First item', 'Second item', 'Third item', 'Fourth item'],
  );

  // A screen-stack router for the Navigation section. The `list` route
  // carries a static `title`; `detail` gets its title per-navigate.
  const navRouter = createRouter({
    list:   { component: (p) => <NavList router={p.router} />, title: 'Mailboxes' },
    detail: (p) => <NavDetail name={p.params.name} router={p.router} />,
  }, 'list');

  // Bottom-tab demo — `activeTab` is the controlled selected index.
  const [tab, setTab] = createSignal(0);

  // setDesign writes a wire op; the host rebuilds its MaterialApp
  // theme + CupertinoTheme in response.
  const applyDesign = (m, d) => {
    setMode(m);
    setDark(d);
    setDesign(m, d ? 1 : 0);
  };

  // ScrollView (eager / non-virtualized) — every Section is built up
  // front. The page has a fixed, modest set of Sections (no <For> over
  // a large array), so eager rendering keeps every Section's Flutter
  // element + scroll position alive while scrolling, and the nested
  // navigator / inner tabs never get torn down on scroll.
  // The UI demo lives behind a router so the Animation card can push a
  // dedicated Animations page — keep-alive, so back returns instantly
  // with this scroll position preserved.
  const uiRouter = createRouter({
    home:       { component: (p) => homeScreen(p.router) },
    animations: { component: () => <AnimationsPage />, title: 'Animations' },
  }, 'home');

  function homeScreen(router) {
    return (
    <ScrollView background={BG} padding={16} gap={14} scrollbar>
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
      <Section title="Animation">
        <Text
          label="Implicit tweens, looping, list enter/exit, Hero — all host-side, zero per-frame bridge traffic. Opens a dedicated page."
          fontSize={11}
          color={SUBTLE}
        />
        <Button
          label="Open Animations →"
          onClick={() => router.navigate('animations')}
        />
      </Section>

      {/* ── ListTile — structured Material row ───────────────────── */}
      <Section title="ListTile — structured rows">
        <Box background={CARD} cornerRadius={12} borderWidth={1} borderColor={BORDER}>
          <Column padding={0} gap={0}>
            <ListTile
              leadingIcon="person"
              title="Profile"
              subtitle="Name, photo, bio"
              trailingIcon="explore"
              onClick={() => setGesture('tapped Profile')}
            />
            <ListTile
              leadingIcon="bell"
              title="Notifications"
              subtitle="Sounds, badges, alerts"
              trailingIcon="explore"
              onClick={() => setGesture('tapped Notifications')}
            />
            <ListTile
              leadingIcon="settings"
              title="Settings"
              trailingIcon="explore"
              onClick={() => setGesture('tapped Settings')}
            />
          </Column>
        </Box>
        <Text label={`last row: ${gesture()}`} fontSize={11} color={SUBTLE} />
      </Section>

      {/* ── PageView — swipeable pages ───────────────────────────── */}
      <Section title="PageView — swipe between pages">
        <Box height={140}>
          <PageView activeTab={page()} onChange={(i) => setPage(i)}>
            <Box width="fill" height={140} background={ACCENT} cornerRadius={12} padding={20}>
              <Text label="Page 1 — swipe →" fontSize={16} fontWeight={800} color="#FFFFFFFF" />
            </Box>
            <Box width="fill" height={140} background={GREEN} cornerRadius={12} padding={20}>
              <Text label="Page 2" fontSize={16} fontWeight={800} color="#FFFFFFFF" />
            </Box>
            <Box width="fill" height={140} background={ORANGE} cornerRadius={12} padding={20}>
              <Text label="Page 3" fontSize={16} fontWeight={800} color="#FFFFFFFF" />
            </Box>
          </PageView>
        </Box>
        <Row gap={8}>
          <Button label="◀ Prev" onClick={() => setPage(Math.max(0, page() - 1))} />
          <Button label="Next ▶" onClick={() => setPage(Math.min(2, page() + 1))} />
        </Row>
        <Text label={`page ${page() + 1} of 3 — swipe or use the buttons`} fontSize={11} color={SUBTLE} />
      </Section>

      {/* ── Pull-to-refresh + swipe-to-dismiss ───────────────────── */}
      <Section title="Pull-to-refresh + swipe-to-dismiss">
        <Box height={210} borderWidth={1} borderColor={BORDER} cornerRadius={8}>
          <ListView
            onRefresh={async () => {
              // The host's spinner stays up until this Promise settles.
              await new Promise((r) => setTimeout(r, 900));
              setFeed([`Fresh item ${++feedSeq}`, ...feed()]);
            }}
          >
            <For each={feed()}>
              {(item) => (
                <Dismissible onDismiss={() => setFeed(feed().filter((x) => x !== item))}>
                  <Box width="fill" background={CHIP} cornerRadius={8} padding={14}>
                    <Text label={item} fontSize={13} color={INK} />
                  </Box>
                </Dismissible>
              )}
            </For>
          </ListView>
        </Box>
        <Text
          label="Pull the list down to refresh (a 900ms async task — the spinner waits for it); swipe any row sideways to dismiss it."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Slivers — collapsing header ──────────────────────────── */}
      <Section title="Slivers — collapsing header (CustomScrollView)">
        <Box height={340} borderWidth={1} borderColor={BORDER} cornerRadius={8}>
          <CustomScrollView>
            <SliverAppBar
              title="Collapsing header"
              height={170}
              sliverMode="pinned"
              background={ACCENT}
            >
              <Box width="fill" height={170} background={PURPLE} padding={20}>
                <Text label="Parallax background" fontSize={18} fontWeight={800} color="#FFFFFFFF" />
              </Box>
            </SliverAppBar>
            <SliverList>
              <For each={['One', 'Two', 'Three', 'Four', 'Five']}>
                {(item) => (
                  <Box width="fill" background={CARD} padding={16} borderWidth={1} borderColor={BORDER}>
                    <Text label={`Row ${item}`} fontSize={14} color={INK} />
                  </Box>
                )}
              </For>
            </SliverList>
            <SliverGrid crossAxisCount={3} aspectRatio={1} gap={8}>
              <For each={[ACCENT, GREEN, ORANGE, PURPLE, RED, ACCENT, GREEN, ORANGE, PURPLE]}>
                {(c) => <Box background={c} cornerRadius={10} />}
              </For>
            </SliverGrid>
          </CustomScrollView>
        </Box>
        <Text
          label="Scroll the panel up — the purple header collapses into a pinned blue bar. The SliverList builds rows lazily; non-sliver children would auto-wrap in a SliverToBoxAdapter."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Canvas — CustomPaint 2-D drawing ─────────────────────── */}
      <Section title="Canvas — CustomPaint 2-D drawing">
        <Box background={CARD} cornerRadius={12} borderWidth={1} borderColor={BORDER} padding={10}>
          <Canvas
            width={300}
            height={170}
            draw={(c) => {
              // A stroked baseline.
              c.strokeStyle(BORDER).lineWidth(2)
                .beginPath().moveTo(16, 150).lineTo(284, 150).stroke();
              // Five bars — the 4th tracks the Controls slider signal,
              // so this whole drawing re-records when the slider moves.
              const vals = [50, 95, 70, slider() + 10, 80];
              vals.forEach((v, i) => {
                c.fillStyle(i === 3 ? ACCENT : PURPLE)
                  .fillRect(28 + i * 52, 150 - v, 34, v);
              });
              // A filled circle + a label.
              c.fillStyle(GREEN).beginPath().circle(252, 44, 22).fill();
              c.fillStyle(INK).fontSize(12).fillText('bars · circle · path · text', 18, 22);
              // Shapes the "Draw a shape" button appends — each click
              // pushes one, the draw callback re-records and repaints.
              canvasShapes().forEach((s) => {
                c.fillStyle(s.color).beginPath().circle(s.x, s.y, s.r).fill();
              });
            }}
          />
        </Box>
        <Row gap={8}>
          <Button
            label="Draw a shape"
            onClick={() => setCanvasShapes([...canvasShapes(), {
              x: 24 + Math.random() * 252,
              y: 16 + Math.random() * 120,
              r: 8 + Math.random() * 20,
              color: [ACCENT, GREEN, ORANGE, RED, PURPLE][Math.floor(Math.random() * 5)],
            }])}
          />
          <Button label="Clear" onClick={() => setCanvasShapes([])} />
        </Row>
        <Text
          label="Bars, a circle, a stroked path, text. The 4th bar tracks the Controls slider; the buttons append/clear circles — each click flips the canvasShapes signal, so the draw callback re-records and the host repaints. Static drawings cross the bridge exactly once."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Drag-and-drop — DragItem / DropZone ──────────────────── */}
      <Section title="Drag-and-drop — DragItem onto DropZone">
        <Row gap={8}>
          <For each={['Apple', 'Banana', 'Cherry']}>
            {(fruit) => (
              <DragItem dragData={fruit}>
                <Box background={PURPLE} cornerRadius={20} padding={12}>
                  <Text label={fruit} fontSize={13} color="#FFFFFFFF" />
                </Box>
              </DragItem>
            )}
          </For>
        </Row>
        <DropZone onDrop={(d) => setDropped([...dropped(), d])}>
          <Box width="fill" height={90} background={CHIP} cornerRadius={12} padding={16}>
            <Text
              label={dropped().length
                ? `Basket: ${dropped().join(', ')}`
                : 'Drag a chip into this zone'}
              fontSize={13}
              color={INK}
            />
          </Box>
        </DropZone>
        <Row gap={8}>
          <Button label="Clear basket" onClick={() => setDropped([])} />
        </Row>
        <Text
          label="Drag a fruit chip onto the zone — it highlights host-side while you hover; on release onDrop fires with the chip's dragData string. The whole drag is host-side; only the drop crosses the bridge."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── More controls — radio / chip / segmented / accordion ── */}
      <Section title="More controls — radio · chip · segmented · accordion">
        <Row gap={16}>
          <For each={['S', 'M', 'L']}>
            {(size) => (
              <Row gap={2}>
                <Radio checked={pickSize() === size} onChange={() => setPickSize(size)} />
                <Text label={size} fontSize={13} color={INK} />
              </Row>
            )}
          </For>
        </Row>
        <Row gap={8}>
          <For each={['Red', 'Green', 'Blue']}>
            {(c) => (
              <Chip
                label={c}
                checked={chosen().includes(c)}
                onChange={(on) =>
                  setChosen(on ? [...chosen(), c] : chosen().filter((x) => x !== c))}
              />
            )}
          </For>
        </Row>
        <SegmentedButton activeTab={seg()} onChange={(i) => setSeg(i)}>
          <Text label="Day" fontSize={13} />
          <Text label="Week" fontSize={13} />
          <Text label="Month" fontSize={13} />
        </SegmentedButton>
        <Row gap={8}>
          <Text label="Priority" fontSize={13} color={INK} />
          <Dropdown activeTab={dd()} onChange={(i) => setDd(i)}>
            <Text label="Low" fontSize={13} />
            <Text label="Medium" fontSize={13} />
            <Text label="High" fontSize={13} />
          </Dropdown>
        </Row>
        <Box background={CARD} cornerRadius={8} borderWidth={1} borderColor={BORDER}>
          <ExpansionTile title="Details" onChange={(e) => setExpanded(e)}>
            <Box padding={14} background={CHIP}>
              <Text label="Body content revealed by the accordion — host-owned open state, host-side expand animation." fontSize={12} color={SUBTLE} />
            </Box>
          </ExpansionTile>
        </Box>
        <Text
          label={`size ${pickSize()} · chips ${chosen().join('/') || '—'} · segment ${['Day', 'Week', 'Month'][seg()]} · priority ${['Low', 'Medium', 'High'][dd()]} · details ${expanded() ? 'open' : 'closed'}`}
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Stepper ─────────────────────────────────────────────── */}
      <Section title="Stepper — multi-step flow">
        <Stepper activeTab={step()} onChange={(i) => setStep(i)}>
          <Step title="Account">
            <Text label="Create your account — name, email, password." fontSize={12} color={SUBTLE} />
          </Step>
          <Step title="Profile">
            <Text label="Add a photo and a short bio." fontSize={12} color={SUBTLE} />
          </Step>
          <Step title="Done">
            <Text label="All set — review and finish." fontSize={12} color={SUBTLE} />
          </Step>
        </Stepper>
        <Text label={`current step: ${step() + 1} of 3`} fontSize={11} color={SUBTLE} />
      </Section>

      {/* ── BottomSheet ─────────────────────────────────────────── */}
      <Section title="BottomSheet — draggable / expandable">
        <Box height={300} cornerRadius={12} background={CHIP}>
          <Stack>
            <Box width="fill" height="fill" padding={16}>
              <Text label="A DraggableScrollableSheet — drag the sheet up, or scroll its list past the edge to expand it." fontSize={12} color={SUBTLE} />
            </Box>
            <BottomSheet initialSize={0.4} minSize={0.18} maxSize={0.95} background={CARD}>
              <Box padding={16}>
                <Text label="Sheet content — drag or scroll" fontSize={15} fontWeight={700} color={INK} />
              </Box>
              <For each={['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta']}>
                {(r) => (
                  <Box padding={14}>
                    <Text label={r} fontSize={14} color={INK} />
                  </Box>
                )}
              </For>
            </BottomSheet>
          </Stack>
        </Box>
      </Section>

      {/* ── Effects — blur & zoom ───────────────────────────────── */}
      <Section title="Effects — BackdropFilter · InteractiveViewer">
        <Stack>
          <Image
            src="https://picsum.photos/seed/skalblur/300/160"
            width={300}
            height={160}
            contentScale={1}
            cornerRadius={10}
          />
          <Box top={0} left={150} width={150} height={160}>
            <BackdropFilter blurRadius={12}>
              <Box width={150} height={160} background="#33FFFFFF" />
            </BackdropFilter>
          </Box>
        </Stack>
        <Text label="The right half is frosted by a BackdropFilter." fontSize={11} color={SUBTLE} />
        <Box height={200} cornerRadius={12} background={CHIP}>
          <InteractiveViewer minScale={1} maxScale={4}>
            <Image
              src="https://picsum.photos/seed/skalzoom/320/200"
              width={320}
              height={200}
              contentScale={1}
            />
          </InteractiveViewer>
        </Box>
        <Text label="Pinch / scroll-wheel to zoom the image, drag to pan." fontSize={11} color={SUBTLE} />
      </Section>

      {/* ── Hover & accessibility ───────────────────────────────── */}
      <Section title="Hover — onHover · semanticLabel">
        <Box
          padding={16}
          cornerRadius={10}
          background={hovered() ? ACCENT : CARD}
          borderWidth={1}
          borderColor={BORDER}
          onHover={(over) => setHovered(over)}
          semanticLabel="A hoverable demo card"
        >
          <Text
            label={hovered() ? 'Hovering — pointer is over the card' : 'Move the pointer over this card'}
            fontSize={14}
            color={hovered() ? '#FFFFFF' : INK}
          />
        </Box>
        <Text
          label="onHover fires on pointer enter/exit (desktop/web). semanticLabel wraps the card in a Semantics node for screen readers."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Keyboard ────────────────────────────────────────────── */}
      <Section title="Keyboard — onKey">
        <Box
          padding={16}
          cornerRadius={10}
          background={CARD}
          borderWidth={1}
          borderColor={BORDER}
          onKey={(combo) => setLastKey(combo)}
        >
          <Text label={`last key: ${lastKey()}`} fontSize={14} color={INK} />
        </Box>
        <Text
          label="Click the card to focus it, then press keys (⌘S, Escape, arrows). onKey reports a normalized combo string; build any shortcut layer on it."
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

      {/* ── Drag — the draggable host-move fast-path ─────────────── */}
      <Section title="Drag — draggable (zero per-frame bridge traffic)">
        <Box height={150} background={CHIP} cornerRadius={12}>
          <Box
            draggable
            width={64}
            height={64}
            background={ACCENT}
            cornerRadius={14}
            onPanEnd={(x, y) => setDragRest(`${x.toFixed(0)}, ${y.toFixed(0)}`)}
          >
            <Text label="drag" fontSize={12} color="#FFFFFFFF" />
          </Box>
        </Box>
        <Text
          label={`Drag the blue box — the host moves it itself, no event per frame. Resting offset: ${dragRest()}`}
          fontSize={11}
          color={SUBTLE}
        />
      </Section>

      {/* ── Pan — live onPanUpdate delta ─────────────────────────── */}
      <Section title="Pan — onPanUpdate delta stream">
        <Box
          height={70}
          background={CHIP}
          cornerRadius={12}
          padding={16}
          onPanStart={() => setPanDelta('drag started')}
          onPanUpdate={(dx, dy) => setPanDelta(`dx ${dx.toFixed(1)}  dy ${dy.toFixed(1)}`)}
          onPanEnd={(vx, vy) => setPanDelta(`fling v ${vx.toFixed(0)}, ${vy.toFixed(0)} dp/s`)}
        >
          <Text label="Drag anywhere on this strip" fontSize={13} color={INK} />
        </Box>
        <Text label={`onPanUpdate: ${panDelta()}`} fontSize={11} color={SUBTLE} />
      </Section>

      {/* ── Scale — pinch onScaleUpdate ──────────────────────────── */}
      <Section title="Scale — onScaleUpdate (pinch / rotate)">
        <Box height={170} background={CHIP} cornerRadius={12}>
          <Box
            width={96}
            height={96}
            background={PURPLE}
            cornerRadius={16}
            scaleX={pinch()}
            scaleY={pinch()}
            onScaleStart={() => { pinchBase = pinch(); }}
            onScaleUpdate={(scale) => setPinch(Math.max(0.3, pinchBase * scale))}
          >
            <Text label="pinch" fontSize={13} color="#FFFFFFFF" />
          </Box>
        </Box>
        <Text
          label={`Pinch the purple box (two pointers / trackpad). Scale ×${pinch().toFixed(2)}`}
          fontSize={11}
          color={SUBTLE}
        />
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

      {/* ── Pickers ─────────────────────────────────────────────── */}
      <Section title="Pickers — date · time">
        <Row gap={8}>
          <Button
            label="Pick a date"
            onClick={async () => {
              const d = await showDatePicker({ initialDate: '2026-05-17' });
              setPicked(`date → ${d ?? 'dismissed'}`);
            }}
          />
          <Button
            label="Pick a time"
            onClick={async () => {
              const t = await showTimePicker({ initialHour: 9, initialMinute: 30 });
              setPicked(`time → ${t ?? 'dismissed'}`);
            }}
          />
        </Row>
        <Text label={picked()} fontSize={12} color={SUBTLE} />
      </Section>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <Section title="Navigation — push / pop with keep-alive">
        <Text
          label="Tap a mailbox to push a screen; the AppBar back button (or system back) pops. Native transition; the screen behind stays mounted."
          fontSize={11}
          color={SUBTLE}
        />
        <Box height={320} borderWidth={1} borderColor={BORDER}>
          <navRouter.View />
        </Box>
      </Section>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Section title="Tabs — bottom bar with keep-alive">
        <Text
          label="Every tab subtree is built once and kept alive (IndexedStack) — switching never re-mounts; scroll & state survive."
          fontSize={11}
          color={SUBTLE}
        />
        <Box height={280} borderWidth={1} borderColor={BORDER} cornerRadius={8}>
          <Tabs activeTab={tab()} onChange={setTab} height="fill">
            <Tab title="Home" icon="home">
              <Column background={BG} padding={16} gap={8} height="fill">
                <Text label="Home" fontSize={20} fontWeight={800} color={INK} />
                <Text
                  label="Switch tabs and come back — this tab was never torn down."
                  fontSize={13}
                  color={SUBTLE}
                />
              </Column>
            </Tab>
            <Tab title="Search" icon="search">
              <Column background={BG} padding={16} gap={8} height="fill">
                <Text label="Search" fontSize={20} fontWeight={800} color={INK} />
                <TextInput placeholder="Type to search…" />
              </Column>
            </Tab>
            <Tab title="Profile" icon="person">
              <Column background={BG} padding={16} gap={8} height="fill">
                <Text label="Profile" fontSize={20} fontWeight={800} color={INK} />
                <Text label={`active tab index: ${tab()}`} fontSize={13} color={SUBTLE} />
              </Column>
            </Tab>
          </Tabs>
        </Box>
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

      <Text label="— end of UI demo —" fontSize={12} color={SUBTLE} />
    </ScrollView>
    );
  }

  return <uiRouter.View />;
}

// ════════════════════════════════════════════════════════════════════
// List tab — the virtualized tweet feed.
// ════════════════════════════════════════════════════════════════════

const TWEET_LINES = [
  "Just shipped a new feature, feeling great about how it turned out 🚀",
  "Hot take: the best APIs are the ones you don't have to read docs for",
  "Spent the morning refactoring legacy code — so much cleaner now",
  "There's no such thing as 'just a small change' in production code",
  "If your tests are slow, that's a smell. Fast tests = good tests",
  "Bun's startup time keeps surprising me, even after a year",
  "Why is naming things still the hardest part of programming?",
  "Found a 10× speedup in a critical path today. Profilers, not guesses",
  "Reading 'The Art of Unix Programming' for the third time",
  "Premature abstraction is somehow worse than premature optimization",
  "Latency is a feature, throughput is an artifact of how you measure",
  "Half of debugging is admitting your assumption was wrong",
  "You don't ship the codebase you have. You ship the codebase you understand",
  "Cache invalidation, naming things, off-by-one. The classics",
  "Every config file format eventually grows a turing-complete templating layer",
];

// Pre-compute the tweet pool as {author, body, num} records. Sized at
// 15000 so the "10000 (heap stress)" button has fresh source items to
// mount — past the JS string-heap capacity, exercising the bridge's
// spin-wait + reset path.
const TWEETS = Array.from({ length: 15000 }, (_, i) => ({
  author: `@user${(i * 2654435761) >>> 17}`,
  body: TWEET_LINES[i % TWEET_LINES.length],
  num: i + 1,
}));

const COUNT_BUTTONS = [50, 200, 500, 1000, 2000, 5000, 10000];

// Tweet palette — module scope so the prop diff cache hits across cards.
const T_AUTHOR        = '#FF1DA1F2';
const T_BODY          = '#FF1F2937';
const T_REACT_IDLE_BG = '#FFF1F5F9';
const T_REACT_IDLE_FG = '#FF475569';
const T_REACT_LIKE_BG = '#FF22C55E';
const T_REACT_REPLY_BG = '#FFEF4444';
const T_REACT_ON_FG   = '#FFFFFFFF';

/** One tweet card. Each gets its own per-card signals (like state, like
 *  count, …) — Solid's fine-grained tracking re-runs only the affected
 *  button's effects on a tap, never a sibling card. */
function Tweet(props) {
  const [likes, setLikes]     = createSignal(0);
  const [liked, setLiked]     = createSignal(false);
  const [replies, setReplies] = createSignal(0);
  const [replied, setReplied] = createSignal(false);

  return (
    <Column
      background={CARD}
      padding={12}
      cornerRadius={10}
      borderWidth={1}
      borderColor={BORDER}
      gap={6}
    >
      <Text fontWeight={700} fontSize={14} color={T_AUTHOR} label={`#${props.num} · ${props.author}`} />
      <Text fontSize={14} color={T_BODY} maxLines={3} textOverflow={1} label={props.body} />
      <Row gap={10}>
        <Button
          label={`♥ ${likes()}`}
          fontSize={12}
          padding={6}
          cornerRadius={16}
          background={liked() ? T_REACT_LIKE_BG : T_REACT_IDLE_BG}
          color={liked() ? T_REACT_ON_FG : T_REACT_IDLE_FG}
          onClick={() => {
            const next = !liked();
            setLiked(next);
            setLikes(likes() + (next ? 1 : -1));
          }}
        />
        <Button
          label={`↩ ${replies()}`}
          fontSize={12}
          padding={6}
          cornerRadius={16}
          background={replied() ? T_REACT_REPLY_BG : T_REACT_IDLE_BG}
          color={replied() ? T_REACT_ON_FG : T_REACT_IDLE_FG}
          onClick={() => {
            const next = !replied();
            setReplied(next);
            setReplies(replies() + (next ? 1 : -1));
          }}
        />
      </Row>
    </Column>
  );
}

function ListTab() {
  const [visibleTweets, setVisibleTweets] = createSignal(50);
  const [tweetBenchMs, setTweetBenchMs]   = createSignal('');

  // createMemo — recomputed only when visibleTweets changes. <For>
  // diffs old vs new by identity, emitting the minimum add/remove ops.
  const tweetsToShow = createMemo(() => TWEETS.slice(0, visibleTweets()));

  // The control row scrolls together with the feed — matching the
  // Twitter/X UX where the header scrolls away as you read.
  return (
    <ListView background={BG} padding={16} gap={12}>
      <Text label="Tweet feed — virtualized" fontSize={24} fontWeight={800} color={INK} />
      <Text
        label="ListView.builder materializes only the visible window; the source pool is 15 000 items. Tap a count to mount N."
        fontSize={13}
        color={SUBTLE}
      />
      <Wrap gap={6}>
        <For each={COUNT_BUTTONS}>
          {(n) => (
            <Button
              label={`${n}`}
              onClick={() => {
                const t1 = performance.now();
                try {
                  setVisibleTweets(n);
                  const ms = (performance.now() - t1).toFixed(2);
                  setTweetBenchMs(`mounted ${n} in ${ms} ms`);
                } catch (e) {
                  const msg = (e && (e.message || String(e))) || 'unknown';
                  setTweetBenchMs(`ERROR @ ${n}: ${msg}`);
                }
              }}
            />
          )}
        </For>
      </Wrap>
      <Text
        label={tweetBenchMs() || `showing ${visibleTweets()} tweets`}
        fontSize={12}
        color={SUBTLE}
      />
      <For each={tweetsToShow()}>
        {(tweet) => (
          <Tweet author={tweet.author} body={tweet.body} num={tweet.num} />
        )}
      </For>
    </ListView>
  );
}

// ════════════════════════════════════════════════════════════════════
// Libs tab — codegen-wrapped custom & third-party widgets.
// ════════════════════════════════════════════════════════════════════

function LibsTab() {
  // Bridge-driven callback state — fed by the codegen-emitted dispatch
  // calls inside Counter's generated adapter.
  const [counterLog, setCounterLog] = createSignal('— waiting for counter events —');

  // Imperative ref for the Ticker host. JSX calls `ticker.pause()`,
  // `ticker.getValue()` (→ Promise), etc.; the Proxy emits
  // OP_INVOKE_METHOD across the bridge.
  const ticker = createSkalRef();
  const [tickerLog, setTickerLog] = createSignal('— tap a button to RPC the Ticker —');
  const [tickerUnsub, setTickerUnsub] = createSignal(null);

  // The camera is started on demand — mounting <Camera> is what fires
  // its host's initState (controller init); unmounting disposes it.
  const [cameraOn, setCameraOn] = createSignal(false);

  // ScrollView (eager) — Camera owns a controller that should not be
  // torn down + re-initialized as it scrolls in and out of a lazy
  // viewport, so this tab renders all children up front.
  return (
    <ScrollView background={BG} padding={16} gap={14}>
      <Text label="Libraries — codegen-wrapped widgets" fontSize={24} fontWeight={800} color={INK} />
      <Text
        label="Custom adapters + real pub.dev packages, brought into JSX by skal_codegen. Imported from 'skal-flutter'."
        fontSize={13}
        color={SUBTLE}
      />

      {/* ── Custom adapter — Greeting ───────────────────────────── */}
      <Section title="Greeting — hand-written adapter">
        <Greeting name="Skal" color="#FF1DA1F2" fontSize={20} />
      </Section>

      {/* ── shimmer (pub.dev) ───────────────────────────────────── */}
      <Section title="Shimmer — pub.dev, named-ctor wrap">
        <Text
          label="ShimmerFromColors — codegen-synthesized from the Shimmer.fromColors named constructor."
          fontSize={11}
          color={SUBTLE}
        />
        <ShimmerFromColors baseColor={0xFFBDBDBD} highlightColor={0xFFE0E0E0} period={1500}>
          <Greeting name="loading…" color="#FF333333" fontSize={28} />
        </ShimmerFromColors>
      </Section>

      {/* ── qr_flutter (pub.dev) ────────────────────────────────── */}
      <Section title="QR code — qr_flutter, pub.dev wrap">
        <QrImageView data="https://skal.dev" size={200} />
        <Text label="QrImageView, generated against qr_flutter's class." fontSize={11} color={SUBTLE} />
      </Section>

      {/* ── camera (pub.dev, host pattern) ──────────────────────── */}
      <Section title="Camera — host-pattern wrap (controller lifecycle)">
        <Text
          label="A synthesized _CameraHost owns the CameraController (init in initState, dispose on unmount). The controller initializes only once Start mounts <Camera> — no camera / permission → an inline error banner."
          fontSize={11}
          color={SUBTLE}
        />
        <Button
          label={cameraOn() ? 'Stop camera' : 'Start camera'}
          onClick={() => setCameraOn(!cameraOn())}
        />
        {/* Gate with a plain `&&` short-circuit, NOT <Show>. <Show>'s
            element children are evaluated eagerly by the universal
            renderer — the <Camera> node would be created (firing
            _CameraHost.initState → createCamera(), which opens the
            camera) and then discarded. `cameraOn() && <Camera/>` only
            evaluates the right side when the left is truthy, so the
            <Camera> createElement genuinely never runs until Start. */}
        {cameraOn() && (
          <Box background="#FF000000" padding={4} cornerRadius={8}>
            <Camera resolutionIndex={1} />
          </Box>
        )}
      </Section>

      {/* ── Counter — typed callbacks ───────────────────────────── */}
      <Section title="Counter — typed callbacks back to JSX">
        <Counter
          initial={0}
          onChanged={(n) => setCounterLog(`onChanged(${n})`)}
          onReset={() => setCounterLog('onReset()')}
        />
        <Text label={counterLog()} fontSize={13} color={INK} />
      </Section>

      {/* ── Ticker — JS → Dart imperative RPC ───────────────────── */}
      <Section title="Ticker — JS → Dart imperative RPC">
        <Ticker ref={ticker} intervalMs={500} />
        <Wrap gap={6}>
          <Button label="pause" onClick={async () => {
            await ticker.pause();
            setTickerLog('pause() ✓');
          }} />
          <Button label="resume" onClick={async () => {
            await ticker.resume();
            setTickerLog('resume() ✓');
          }} />
          <Button label="reset" onClick={async () => {
            await ticker.reset();
            setTickerLog('reset() ✓');
          }} />
          <Button label="+10" onClick={async () => {
            await ticker.bump(10);
            const v = await ticker.getValue();
            setTickerLog(`bump(10), now getValue() → ${v}`);
          }} />
          <Button label="read" onClick={async () => {
            const v = await ticker.getValue();
            const paused = await ticker.isPaused();
            setTickerLog(`getValue() → ${v}, isPaused() → ${paused}`);
          }} />
          <Button label="describe" onClick={async () => {
            const s = await ticker.describe('hello from JSX');
            setTickerLog(`describe() → ${s}`);
          }} />
          <Button label="snapshot" onClick={async () => {
            const snap = await ticker.snapshot();
            setTickerLog(
              `snapshot() → value=${snap.value} paused=${snap.paused} ts=${snap.timestamp}`,
            );
          }} />
          <Button label="sub/unsub" onClick={() => {
            if (tickerUnsub()) {
              tickerUnsub()();
              setTickerUnsub(() => null);
              setTickerLog('unsubscribed from ticks$');
            } else {
              const unsub = ticker.ticks$((v) => {
                setTickerLog(`stream tick: ${v}`);
              });
              setTickerUnsub(() => unsub);
              setTickerLog('subscribed to ticks$ — wait for emissions…');
            }
          }} />
        </Wrap>
        <Text label={tickerLog()} fontSize={13} color={INK} />
      </Section>

      {/* ── Stickers — multi-child + object-valued prop ─────────── */}
      <Section title="Stickers — List<Widget> children + gradient prop">
        <Stickers
          gap={6}
          padding={10}
          gradient={{
            type: 'linear',
            colors: ['#FFFFE082', '#FFB0F0D0', '#FFB0E0FF'],
            stops: [0, 0.5, 1],
            begin: 'topLeft',
            end: 'bottomRight',
          }}
        >
          <Greeting name="multi-child A" color="#FF6B4F00" fontSize={14} />
          <Greeting name="multi-child B" color="#FF6B4F00" fontSize={14} />
          <Greeting name="multi-child C" color="#FF6B4F00" fontSize={14} />
        </Stickers>
      </Section>

      <Text label="— end of Libs demo —" fontSize={12} color={SUBTLE} />
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════
// App — three bottom tabs over the demo surfaces.
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// JS tab — probes the embedded bun + JSC runtime: Web Crypto, Bun APIs,
// standard JS. Each probe is timed and its response logged, so the tab
// doubles as a live capability report — Bun / bun:sqlite probes show an
// error (not a crash) when the runtime doesn't expose them.
// ════════════════════════════════════════════════════════════════════

const _hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

// Dynamically import a built-in module (`bun:sqlite`, `node:fs`, …).
//
// The bundle is evaluated as a CLASSIC SCRIPT — Bun__REPL__evaluate runs
// it as a JSC `Program` — so there is NO `require` in scope. Dynamic
// `import()` still works: it routes through the runtime's module loader
// even from a classic script. The `import()` is built inside a
// `new Function` so neither bundler (vite nor `bun build`) ever parses
// it — they can't try, and fail, to resolve the specifier at build time,
// and rollup never sees a dynamic import in an IIFE bundle.
const _dynImport = new Function('m', 'return import(m);');
const _importMod = (name) => _dynImport(name);
// Pick a member from an imported module namespace, tolerating both a
// named export and one nested under `default` (CJS-interop shape).
const _pick = (mod, key) =>
  (mod && mod[key]) || (mod && mod.default && mod.default[key]) || undefined;

// Each probe: { label, run }. `run` is sync or async and returns a
// string (the "response"); a throw is caught and shown as an error.
const JS_PROBE_GROUPS = [
  {
    title: 'Web Crypto — crypto.subtle (global, native)',
    probes: [
      { label: 'crypto.randomUUID()', run: () => crypto.randomUUID() },
      {
        label: 'crypto.getRandomValues — 16 bytes',
        run: () => {
          const a = new Uint8Array(16);
          crypto.getRandomValues(a);
          return _hex(a);
        },
      },
      {
        label: 'crypto.subtle.digest — SHA-256 of 64 KB',
        run: async () => {
          const data = new Uint8Array(65536);
          crypto.getRandomValues(data);
          const h = await crypto.subtle.digest('SHA-256', data);
          return _hex(new Uint8Array(h)).slice(0, 32) + '…';
        },
      },
      {
        label: 'crypto.subtle — AES-GCM encrypt + decrypt',
        run: async () => {
          const key = await crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const msg = new TextEncoder().encode('hello from skal');
          const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, msg);
          const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
          return `${ct.byteLength}-byte ct → "${new TextDecoder().decode(pt)}"`;
        },
      },
    ],
  },
  {
    title: 'Bun runtime — degrades gracefully if absent',
    probes: [
      {
        label: 'Bun.version',
        run: () => {
          if (typeof Bun === 'undefined') throw new Error('Bun global not present');
          return `Bun ${Bun.version}` +
            (Bun.revision ? ` (${Bun.revision.slice(0, 7)})` : '');
        },
      },
      {
        label: 'Bun.nanoseconds()',
        run: () => {
          if (typeof Bun === 'undefined') throw new Error('Bun global not present');
          return `${Bun.nanoseconds()} ns since process start`;
        },
      },
      {
        label: "Bun.hash('the quick brown fox')",
        run: () => {
          if (typeof Bun === 'undefined') throw new Error('Bun global not present');
          return String(Bun.hash('the quick brown fox'));
        },
      },
      {
        label: "new Bun.CryptoHasher('sha256')",
        run: () => {
          if (typeof Bun === 'undefined' || !Bun.CryptoHasher) {
            throw new Error('Bun.CryptoHasher not present');
          }
          const h = new Bun.CryptoHasher('sha256');
          h.update('hello from skal');
          return h.digest('hex').slice(0, 32) + '…';
        },
      },
      {
        label: 'bun:sqlite — in-memory query',
        run: async () => {
          const mod = await _importMod('bun:' + 'sqlite');
          const Database = _pick(mod, 'Database') || mod.default;
          if (typeof Database !== 'function') {
            throw new Error('bun:sqlite imported, but no Database constructor');
          }
          const db = new Database(':memory:');
          db.run('CREATE TABLE t (id INTEGER, name TEXT)');
          db.run("INSERT INTO t VALUES (1, 'skal')");
          const row = db.query('SELECT name FROM t WHERE id = ?').get(1);
          db.close();
          return `select → ${JSON.stringify(row)}`;
        },
      },
    ],
  },
  {
    title: 'Node compatibility — node: builtins',
    probes: [
      {
        label: 'process — platform / arch / version',
        run: () => {
          if (typeof process === 'undefined') {
            throw new Error('process global not present');
          }
          return `${process.platform} ${process.arch} · ` +
            `${process.version || '(no version)'}`;
        },
      },
      {
        label: "node:crypto — createHash('sha256')",
        run: async () => {
          const createHash = _pick(await _importMod('node:' + 'crypto'), 'createHash');
          if (!createHash) throw new Error('node:crypto has no createHash');
          return createHash('sha256').update('hello from skal')
            .digest('hex').slice(0, 32) + '…';
        },
      },
      {
        label: 'node:crypto — randomBytes(16)',
        run: async () => {
          const randomBytes = _pick(await _importMod('node:' + 'crypto'), 'randomBytes');
          if (!randomBytes) throw new Error('node:crypto has no randomBytes');
          return randomBytes(16).toString('hex');
        },
      },
      {
        label: 'node:os — platform / arch / cpus',
        run: async () => {
          const os = await _importMod('node:' + 'os');
          const platform = _pick(os, 'platform');
          const arch = _pick(os, 'arch');
          const cpus = _pick(os, 'cpus');
          if (!platform) throw new Error('node:os has no platform()');
          return `${platform()} ${arch()} · ${cpus().length} cpus`;
        },
      },
      {
        label: 'node:path — join + normalize',
        run: async () => {
          const join = _pick(await _importMod('node:' + 'path'), 'join');
          if (!join) throw new Error('node:path has no join');
          return join('/a/b', '..', 'c', './d.txt');
        },
      },
      {
        label: 'Buffer — from / toString',
        run: () => {
          if (typeof Buffer === 'undefined') {
            throw new Error('Buffer global not present');
          }
          return `hex = ${Buffer.from('skal', 'utf8').toString('hex')}`;
        },
      },
      {
        label: 'node:fs — temp write + read',
        run: async () => {
          const fs = await _importMod('node:' + 'fs');
          const os = await _importMod('node:' + 'os');
          const path = await _importMod('node:' + 'path');
          const writeFileSync = _pick(fs, 'writeFileSync');
          const readFileSync = _pick(fs, 'readFileSync');
          const unlinkSync = _pick(fs, 'unlinkSync');
          const tmpdir = _pick(os, 'tmpdir');
          const join = _pick(path, 'join');
          if (!writeFileSync || !readFileSync || !tmpdir || !join) {
            throw new Error('node:fs / os / path missing an expected member');
          }
          const file = join(tmpdir(), `skal-probe-${Date.now()}.txt`);
          writeFileSync(file, 'skal fs probe');
          const back = readFileSync(file, 'utf8');
          try { if (unlinkSync) unlinkSync(file); } catch (_) { /* best effort */ }
          return `wrote + read back "${back}"`;
        },
      },
    ],
  },
  {
    title: 'Standard JS & Web APIs',
    probes: [
      {
        label: 'JSON stringify + parse — 1000-object array',
        run: () => {
          const obj = Array.from({ length: 1000 },
            (_, i) => ({ id: i, name: 'item' + i, ok: i % 2 === 0 }));
          const s = JSON.stringify(obj);
          const back = JSON.parse(s);
          return `${s.length} bytes · ${back.length} items round-tripped`;
        },
      },
      {
        label: 'TextEncoder / TextDecoder round-trip',
        run: () => {
          const bytes = new TextEncoder().encode('skal 🚀 unicode ✓');
          return `${bytes.length} bytes → "${new TextDecoder().decode(bytes)}"`;
        },
      },
      {
        label: 'structuredClone — nested object',
        run: () => {
          if (typeof structuredClone === 'undefined') {
            throw new Error('structuredClone not present');
          }
          const c = structuredClone({ a: 1, nested: { b: [1, 2, 3] } });
          return `cloned → nested.b = ${JSON.stringify(c.nested.b)}`;
        },
      },
      {
        label: 'setTimeout — 20 ms timer (see duration)',
        run: async () => {
          if (typeof setTimeout === 'undefined') {
            throw new Error('setTimeout not present');
          }
          await new Promise((res) => setTimeout(res, 20));
          return 'timer fired — measured duration ≈ requested 20 ms';
        },
      },
      {
        label: 'tight compute loop — 5,000,000 iterations',
        run: () => {
          let sum = 0;
          for (let i = 0; i < 5_000_000; i++) sum += i % 7;
          return `sum = ${sum}`;
        },
      },
    ],
  },
];

// A probe that hangs — e.g. a never-settling import() — must not stall
// the rest of the harness, so each runs under a timeout. The cap is far
// above any real probe (the slowest, a 5M-iteration loop, is tens of ms
// even interpreted).
const _PROBE_TIMEOUT_MS = 3000;

function _runProbe(p) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out after ${_PROBE_TIMEOUT_MS} ms`)),
      _PROBE_TIMEOUT_MS);
  });
  // Promise.resolve().then(...) folds a synchronous throw in run() into
  // a rejection, so the race handles sync and async probes alike.
  return Promise.race([
    Promise.resolve().then(() => p.run()),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

function JsTab() {
  // label → { ms, response, ok }
  const [results, setResults] = createSignal({});
  const [running, setRunning] = createSignal(false);

  const now = () =>
    (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

  async function runAll() {
    if (running()) return;
    setRunning(true);
    setResults({});
    for (const group of JS_PROBE_GROUPS) {
      for (const p of group.probes) {
        const t0 = now();
        let response;
        let ok = true;
        try {
          response = String(await _runProbe(p));
        } catch (e) {
          response = (e && e.message) ? e.message : String(e);
          ok = false;
        }
        const ms = now() - t0;
        setResults((prev) => ({ ...prev, [p.label]: { ms, response, ok } }));
      }
    }
    setRunning(false);
  }

  // The root <Tabs> is an IndexedStack — every tab mounts at startup, so
  // this runs once on app launch and the log is ready when the tab opens.
  onMount(() => { runAll(); });

  return (
    <ScrollView background={BG} padding={16} gap={14} scrollbar>
      <Text label="JS runtime — probes & timings" fontSize={24} fontWeight={800} color={INK} />
      <Text
        label="Each function runs in the embedded bun + JSC runtime; its duration and response are logged. Bun / bun:sqlite probes report an error (not a crash) if the runtime doesn't expose them."
        fontSize={13}
        color={SUBTLE}
      />
      <Button label={running() ? 'Running…' : 'Re-run all probes'} onClick={runAll} />
      <For each={JS_PROBE_GROUPS}>
        {(group) => (
          <Section title={group.title}>
            <For each={group.probes}>
              {(p) => {
                const r = () => results()[p.label];
                const resp = () => {
                  const v = r();
                  if (!v) return 'not run yet';
                  return v.response.length > 110
                    ? v.response.slice(0, 110) + '…'
                    : v.response;
                };
                return (
                  <Column gap={2}>
                    <Text label={p.label} fontSize={13} fontWeight={700} color={INK} />
                    <Text
                      label={r() ? `${r().ms.toFixed(3)} ms` : '—'}
                      fontSize={11}
                      fontWeight={700}
                      color={ACCENT}
                    />
                    <Text
                      label={resp()}
                      fontSize={12}
                      maxLines={3}
                      color={r() ? (r().ok ? SUBTLE : RED) : SUBTLE}
                    />
                  </Column>
                );
              }}
            </For>
          </Section>
        )}
      </For>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════════════════════
// Store tab — the reactive, log-structured, granular persistence layer.
// One module-scope store; createSkalStore kicks off async init (opens
// the backend, rebuilds the keydir, loads eager elements) at app start.
// ════════════════════════════════════════════════════════════════════

const demoStore = createSkalStore({
  counter: { kind: 'scalar',     persist: true,  default: 0 },
  note:    { kind: 'scalar',     persist: true,  default: '' },
  scratch: { kind: 'scalar',     persist: false, default: '' },
  items:   { kind: 'collection', persist: true,  lazy: false, window: 50 },
  archive: { kind: 'collection', persist: true,  lazy: true },
});

function StoreTab() {
  const items = demoStore.collection('items');
  const archive = demoStore.collection('archive');
  let bulkSeq = 1;

  // statsTick() subscribes the line to every flush / compact.
  const statsText = () => {
    demoStore.statsTick();
    const s = demoStore.engineStats();
    const f = demoStore.flushInfo();
    return `${s.records} records · ${s.segments} segments · `
      + `${s.deadBytes} dead bytes · seq ${s.seq} · `
      + `${f.count} flushes (last ${f.lastMs.toFixed(1)} ms) · `
      + `${demoStore.pending()} pending`;
  };

  return (
    <ScrollView background={BG} padding={16} gap={14} scrollbar>
      <Text label="Reactive store — log-structured · granular · persistent" fontSize={23} fontWeight={800} color={INK} />
      <Text
        label={`Backend: ${demoStore.backendKind()}`}
        fontSize={14}
        fontWeight={800}
        color={(demoStore.backendKind() === 'mmap' || demoStore.backendKind() === 'fs')
          ? GREEN : ORANGE}
      />
      <Text label={`how: ${demoStore.backendDiag()}`} fontSize={11} color={SUBTLE} maxLines={4} />
      {demoStore.initError()
        ? <Text label={`init error: ${demoStore.initError()}`} fontSize={11} color={RED} maxLines={4} />
        : null}
      <Text
        label={(demoStore.backendKind() === 'mmap' || demoStore.backendKind() === 'fs')
          ? 'Persisted to disk — change values, quit, and re-run to verify they survive a restart.'
          : 'In-memory fallback — data resets on restart. The "how" line above says why no disk backend was used.'}
        fontSize={12}
        color={SUBTLE}
      />

      {/* ── Scalars ──────────────────────────────────────────────── */}
      <Section title="Scalars — persisted vs memory-only">
        <Row gap={10}>
          <Button label="counter + 1" onClick={() => demoStore.set('counter', demoStore.get('counter') + 1)} />
          <Text label={`counter = ${demoStore.get('counter')}`} fontSize={16} fontWeight={800} color={ACCENT} />
        </Row>
        <Text label="note — persist:true (survives restart)" fontSize={11} color={SUBTLE} />
        <TextInput value={demoStore.get('note')} placeholder="persisted text…" onChange={(v) => demoStore.set('note', v)} />
        <Text label="scratch — persist:false (memory only, gone on restart)" fontSize={11} color={SUBTLE} />
        <TextInput value={demoStore.get('scratch')} placeholder="memory-only text…" onChange={(v) => demoStore.set('scratch', v)} />
      </Section>

      {/* ── Collection ───────────────────────────────────────────── */}
      <Section title="Collection — items (windowed · delta-logged)">
        <Row gap={8}>
          <Button label="Add 1" onClick={() => items.add({ text: 'item ' + Date.now() })} />
          <Button label="Add 1000" onClick={() => {
            const recs = [];
            for (let i = 0; i < 1000; i++) recs.push({ text: 'bulk #' + (bulkSeq++) });
            items.addMany(recs);
          }} />
        </Row>
        <Row gap={8}>
          <Button label="Edit first" onClick={() => {
            const l = items.list();
            if (l.length) items.update(l[0]._id, { text: 'edited @ ' + Date.now() });
          }} />
          <Button label="Remove first" onClick={() => {
            const l = items.list();
            if (l.length) items.remove(l[0]._id);
          }} />
          <Button label="Clear" onClick={() => items.clear()} />
        </Row>
        <Text label={`${items.count()} total — only the ${items.window().size}-row window lives in RAM; an edit writes one ~tiny delta frame`} fontSize={12} fontWeight={700} color={ACCENT} />
        <Row gap={8}>
          <Button label="◀ Prev" onClick={() => {
            const w = items.window();
            items.setWindow(w.start - w.size);
          }} />
          <Button label="Next ▶" onClick={() => {
            const w = items.window();
            if (w.start + w.size < w.total) items.setWindow(w.start + w.size);
          }} />
          <Text label={(() => {
            const w = items.window();
            return w.total === 0
              ? 'window: empty'
              : `window: rows ${w.start + 1}–${w.start + w.shown} of ${w.total}`;
          })()} fontSize={12} color={SUBTLE} />
        </Row>
        <Box height={240} cornerRadius={10} background={CHIP}>
          <ListView scrollbar>
            <For each={items.list()}>
              {(rec) => (
                <Box padding={9} background={CARD} cornerRadius={6} borderWidth={1} borderColor={BORDER}>
                  <Text label={`#${rec._id} — ${rec.text}`} fontSize={12} color={INK} />
                </Box>
              )}
            </For>
          </ListView>
        </Box>
      </Section>

      {/* ── Lazy collection ──────────────────────────────────────── */}
      <Section title="Lazy collection — archive (loaded on demand)">
        <Row gap={8}>
          <Button label={archive.loaded() ? 'Loaded ✓' : 'Load archive'} onClick={() => archive.load()} />
          <Button label="Add to archive" onClick={() => archive.add({ text: 'archived ' + Date.now() })} />
        </Row>
        <Text
          label={archive.loaded()
            ? `${archive.count()} archived records (read from disk on access)`
            : 'not loaded — a lazy element reads nothing from disk until asked'}
          fontSize={12}
          color={SUBTLE}
        />
      </Section>

      {/* ── Engine ───────────────────────────────────────────────── */}
      <Section title="Engine — segmented append log">
        <Text label={statsText()} fontSize={11} color={SUBTLE} maxLines={3} />
        <Row gap={8}>
          <Button label="Flush now" onClick={() => demoStore.flushNow()} />
          <Button label="Compact" onClick={() => demoStore.compact()} />
        </Row>
        <Text
          label="Writes are debounced + batched; compaction reclaims dead frames one segment at a time."
          fontSize={11}
          color={SUBTLE}
        />
      </Section>
    </ScrollView>
  );
}

export default function App() {
  const [appTab, setAppTab] = createSignal(0);
  return (
    <Tabs activeTab={appTab()} onChange={setAppTab} height="fill">
      <Tab title="UI" icon="grid">
        <UITab />
      </Tab>
      <Tab title="List" icon="list">
        <ListTab />
      </Tab>
      <Tab title="Libs" icon="explore">
        <LibsTab />
      </Tab>
      <Tab title="JS" icon="code">
        <JsTab />
      </Tab>
      <Tab title="Store" icon="storage">
        <StoreTab />
      </Tab>
    </Tabs>
  );
}
