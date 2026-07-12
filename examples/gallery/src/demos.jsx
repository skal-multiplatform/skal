// demos.jsx — the component gallery catalog.
//
// One entry per Skal component: the JSX shown in the docs (`code`) and
// the live view the screenshot pipeline captures (`view`). Keep the two
// in sync — the docs page and the Maestro flow are both generated from
// this file (scripts/gen-gallery.js), so this is the single source of
// truth for the component reference.

import { createSignal, For } from 'solid-js';
import {
  Box, Column, Row, Text, Button, ScrollView, ListView, ReorderableListView,
  Image, Stack, Switch, Slider, Checkbox, ActivityIndicator, ProgressBar,
  LazyGrid, Wrap, RichText, TextInput, Tabs, Tab, AnimatedList, CrossFade,
  ListTile, PageView, Dismissible, CustomScrollView, SliverAppBar, SliverList,
  Canvas, DragItem, DropZone, Radio, Chip, SegmentedButton, ExpansionTile,
  Dropdown, Stepper, Step, BottomSheet, BackdropFilter, InteractiveViewer,
} from 'skal';

const INK = '#FF1C1C1E';
const SUBTLE = '#FF8E8E93';
const ACCENT = '#FF0A84FF';
const GREEN = '#FF30D158';
const ORANGE = '#FFFF9F0A';
const RED = '#FFFF453A';
const PURPLE = '#FFBF5AF2';
const CARD = '#FFFFFFFF';
const CHIP = '#FFF2F2F7';

const Swatch = (p) => (
  <Box width={p.w ?? 64} height={p.h ?? 48} background={p.c} cornerRadius={10}>
    {p.label ? <Text label={p.label} fontSize={12} color="#FFFFFFFF" /> : null}
  </Box>
);

export const DEMOS = [
  // ── content ─────────────────────────────────────────────────────────
  {
    name: 'Text', widget: 'Text', group: 'Content',
    blurb: 'Styled text — size, weight, family, color, alignment, maxLines, overflow.',
    code: `<Text label="The quick brown fox" fontSize={24} fontWeight={800} color="#FF1C1C1E" />
<Text label="jumps over the lazy dog." fontSize={15} color="#FF8E8E93" />
<Text label="Truncates with an ellipsis when it runs out of space to work with"
      maxLines={1} textOverflow={1} fontSize={14} color="#FF0A84FF" />`,
    view: () => (
      <Column gap={12}>
        <Text label="The quick brown fox" fontSize={24} fontWeight={800} color={INK} />
        <Text label="jumps over the lazy dog." fontSize={15} color={SUBTLE} />
        <Text label="Truncates with an ellipsis when it runs out of space to work with" maxLines={1} textOverflow={1} fontSize={14} color={ACCENT} />
      </Column>
    ),
  },
  {
    name: 'RichText', widget: 'Text.rich', group: 'Content',
    blurb: 'Inline spans — each Text child becomes a styled TextSpan.',
    code: `<RichText>
  <Text label="Rich text " fontSize={17} color="#FF1C1C1E" />
  <Text label="mixes " fontSize={17} color="#FF0A84FF" fontWeight={800} />
  <Text label="size, " fontSize={23} color="#FFFF453A" fontWeight={700} />
  <Text label="weight " fontSize={17} color="#FF30D158" fontWeight={800} />
  <Text label="and colour inline." fontSize={17} color="#FF1C1C1E" />
</RichText>`,
    view: () => (
      <RichText>
        <Text label="Rich text " fontSize={17} color={INK} />
        <Text label="mixes " fontSize={17} color={ACCENT} fontWeight={800} />
        <Text label="size, " fontSize={23} color={RED} fontWeight={700} />
        <Text label="weight " fontSize={17} color={GREEN} fontWeight={800} />
        <Text label="and colour inline." fontSize={17} color={INK} />
      </RichText>
    ),
  },
  {
    name: 'Image', widget: 'Image', group: 'Content',
    blurb: 'Network, file://, or asset:// sources; BoxFit via contentScale.',
    code: `<Image src="https://picsum.photos/seed/skal/640/360"
       width="fill" height={180} contentScale={1} cornerRadius={14} />`,
    view: () => (
      <Image src="https://picsum.photos/seed/skal/640/360" width="fill" height={180} contentScale={1} cornerRadius={14} />
    ),
  },
  {
    name: 'Canvas', widget: 'CustomPaint', group: 'Content',
    blurb: 'A chainable 2-D drawing context — rects, circles, paths, text. Reads signals; redraws when they change.',
    code: `<Canvas width={320} height={180} draw={(c) => {
  [60, 110, 80, 140, 95].forEach((v, i) =>
    c.fillStyle(i === 3 ? '#FF0A84FF' : '#FFBF5AF2')
     .fillRect(24 + i * 58, 170 - v, 40, v));
  c.fillStyle('#FF1C1C1E').fontSize(13).fillText('rendered on a signal', 24, 24);
}} />`,
    view: () => (
      <Canvas
        width={320}
        height={180}
        draw={(c) => {
          [60, 110, 80, 140, 95].forEach((v, i) =>
            c.fillStyle(i === 3 ? ACCENT : PURPLE).fillRect(24 + i * 58, 170 - v, 40, v));
          c.fillStyle(INK).fontSize(13).fillText('rendered on a signal', 24, 24);
        }}
      />
    ),
  },
  {
    name: 'ActivityIndicator', widget: 'CircularProgressIndicator', group: 'Content',
    blurb: 'Indeterminate spinner; color and size are props.',
    code: `<ActivityIndicator color="#FF0A84FF" width={36} />`,
    view: () => (
      <Row gap={20}>
        <ActivityIndicator color={ACCENT} width={36} />
        <ActivityIndicator color={PURPLE} width={36} />
        <ActivityIndicator color={GREEN} width={36} />
      </Row>
    ),
  },
  {
    name: 'ProgressBar', widget: 'LinearProgressIndicator', group: 'Content',
    blurb: 'Determinate with progress 0..1, indeterminate without.',
    code: `<ProgressBar progress={0.65} color="#FF0A84FF" />
<ProgressBar color="#FFBF5AF2" />   {/* indeterminate */}`,
    view: () => (
      <Column gap={18} width="fill">
        <ProgressBar progress={0.65} color={ACCENT} />
        <ProgressBar progress={0.3} color={GREEN} />
        <ProgressBar color={PURPLE} />
      </Column>
    ),
  },

  // ── layout ──────────────────────────────────────────────────────────
  {
    name: 'Box', widget: 'Container', group: 'Layout',
    blurb: 'The decorated box — padding, background, corners, borders, shadows, tap/hover/drag handlers.',
    code: `<Box padding={18} background="#FFFFFFFF" cornerRadius={16}
     borderWidth={1} borderColor="#FFE5E5EA" shadow={8}
     onTap={() => setLiked(!liked())}>
  <Text label="Tap me" fontSize={15} color="#FF1C1C1E" />
</Box>`,
    view: () => (
      <Row gap={14}>
        <Box padding={18} background={CARD} cornerRadius={16} borderWidth={1} borderColor="#FFE5E5EA" shadow={8}>
          <Text label="Tap me" fontSize={15} color={INK} />
        </Box>
        <Box padding={18} background={ACCENT} cornerRadius={16}>
          <Text label="Filled" fontSize={15} color="#FFFFFFFF" />
        </Box>
        <Box padding={18} background="#00000000" cornerRadius={16} borderWidth={2} borderColor={ACCENT}>
          <Text label="Outlined" fontSize={15} color={ACCENT} />
        </Box>
      </Row>
    ),
  },
  {
    name: 'Column', widget: 'Column', group: 'Layout',
    blurb: 'Vertical flex; gap, padding, alignment; children flex with weight.',
    code: `<Column gap={10}>
  <Box height={44} background="#FF0A84FF" cornerRadius={10} />
  <Box height={44} background="#FF30D158" cornerRadius={10} />
  <Box height={44} background="#FFFF9F0A" cornerRadius={10} />
</Column>`,
    view: () => (
      <Column gap={10} width="fill">
        <Box height={44} width="fill" background={ACCENT} cornerRadius={10} />
        <Box height={44} width="fill" background={GREEN} cornerRadius={10} />
        <Box height={44} width="fill" background={ORANGE} cornerRadius={10} />
      </Column>
    ),
  },
  {
    name: 'Row', widget: 'Row', group: 'Layout',
    blurb: 'Horizontal flex; weight distributes leftover space.',
    code: `<Row gap={10}>
  <Box weight={1} height={64} background="#FF0A84FF" cornerRadius={10} />
  <Box weight={2} height={64} background="#FF30D158" cornerRadius={10} />
  <Box weight={1} height={64} background="#FFFF9F0A" cornerRadius={10} />
</Row>`,
    view: () => (
      <Row gap={10} width="fill">
        <Box weight={1} height={64} background={ACCENT} cornerRadius={10} />
        <Box weight={2} height={64} background={GREEN} cornerRadius={10} />
        <Box weight={1} height={64} background={ORANGE} cornerRadius={10} />
      </Row>
    ),
  },
  {
    name: 'Stack', widget: 'Stack', group: 'Layout',
    blurb: 'Layered children; top/right/bottom/left props position them absolutely.',
    code: `<Stack width="fill" height={160}>
  <Box width="fill" height={160} background="#FF0A84FF" cornerRadius={16} />
  <Box top={12} right={12} padding={8} background="#FFFFFFFF" cornerRadius={10}>
    <Text label="badge" fontSize={12} color="#FF0A84FF" />
  </Box>
  <Box bottom={12} left={12} padding={10} background="#66000000" cornerRadius={10}>
    <Text label="caption over the fill" fontSize={13} color="#FFFFFFFF" />
  </Box>
</Stack>`,
    view: () => (
      <Stack width="fill" height={160}>
        <Box width="fill" height={160} background={ACCENT} cornerRadius={16} />
        <Box top={12} right={12} padding={8} background={CARD} cornerRadius={10}>
          <Text label="badge" fontSize={12} color={ACCENT} />
        </Box>
        <Box bottom={12} left={12} padding={10} background="#66000000" cornerRadius={10}>
          <Text label="caption over the fill" fontSize={13} color="#FFFFFFFF" />
        </Box>
      </Stack>
    ),
  },
  {
    name: 'Wrap', widget: 'Wrap', group: 'Layout',
    blurb: 'Flow layout — children wrap to the next line; gap sets both spacings.',
    code: `<Wrap gap={8}>
  <For each={['solid', 'flutter', 'bun', 'jsc', 'zero-copy', 'bridge', 'native']}>
    {(t) => <Box padding={10} background="#FFF2F2F7" cornerRadius={999}>
      <Text label={t} fontSize={13} color="#FF1C1C1E" /></Box>}
  </For>
</Wrap>`,
    view: () => (
      <Wrap gap={8}>
        <For each={['solid', 'flutter', 'bun', 'jsc', 'zero-copy', 'bridge', 'native']}>
          {(t) => (
            <Box padding={10} background={CHIP} cornerRadius={999}>
              <Text label={t} fontSize={13} color={INK} />
            </Box>
          )}
        </For>
      </Wrap>
    ),
  },
  {
    name: 'ScrollView', widget: 'SingleChildScrollView', group: 'Layout',
    blurb: 'Eager scrolling for short content; axis 0 = vertical, 1 = horizontal. Use ListView for long lists.',
    code: `<ScrollView axis={1} gap={10} height={90}>
  <For each={colors}>
    {(c) => <Box width={90} height={90} background={c} cornerRadius={14} />}
  </For>
</ScrollView>`,
    view: () => (
      <ScrollView axis={1} gap={10} height={90}>
        <For each={[ACCENT, GREEN, ORANGE, PURPLE, RED, '#FF00C7BE', '#FFFFD60A']}>
          {(c) => <Box width={90} height={90} background={c} cornerRadius={14} />}
        </For>
      </ScrollView>
    ),
  },

  // ── input ───────────────────────────────────────────────────────────
  {
    name: 'Button', widget: 'ElevatedButton', group: 'Input',
    blurb: 'label + onClick; disable with enabled={false}.',
    code: `<Button label="Continue" onClick={() => submit()} />
<Button label="Disabled" enabled={false} />`,
    view: () => {
      const [n, setN] = createSignal(0);
      return (
        <Column gap={12}>
          <Row gap={12}>
            <Button label={`Tapped ${n()} times`} onClick={() => setN(n() + 1)} />
            <Button label="Disabled" enabled={false} />
          </Row>
        </Column>
      );
    },
  },
  {
    name: 'TextInput', widget: 'TextField', group: 'Input',
    blurb: 'Controlled text field — onChange per keystroke, onSubmit on Enter, secureEntry for passwords.',
    code: `<TextInput value={name()} placeholder="Your name…"
           onChange={setName} onSubmit={(v) => save(v)} />`,
    view: () => {
      const [name, setName] = createSignal('Skål 🍻');
      return (
        <Column gap={12} width="fill">
          <TextInput value={name()} placeholder="Your name…" onChange={setName} />
          <TextInput value="" placeholder="Empty with a placeholder" />
          <Text label={`value: ${name()}`} fontSize={13} color={SUBTLE} />
        </Column>
      );
    },
  },
  {
    name: 'Switch', widget: 'Switch', group: 'Input',
    blurb: 'Boolean toggle; the app owns the state.',
    code: `<Switch checked={on()} onChange={setOn} />`,
    view: () => {
      const [a, setA] = createSignal(true);
      const [b, setB] = createSignal(false);
      return (
        <Row gap={18}>
          <Switch checked={a()} onChange={setA} />
          <Switch checked={b()} onChange={setB} />
        </Row>
      );
    },
  },
  {
    name: 'Checkbox', widget: 'Checkbox', group: 'Input',
    blurb: 'Checked/unchecked; onChange(bool).',
    code: `<Checkbox checked={done()} onChange={setDone} />`,
    view: () => {
      const [a, setA] = createSignal(true);
      const [b, setB] = createSignal(false);
      return (
        <Row gap={18}>
          <Checkbox checked={a()} onChange={setA} />
          <Checkbox checked={b()} onChange={setB} />
        </Row>
      );
    },
  },
  {
    name: 'Radio', widget: 'Radio', group: 'Input',
    blurb: 'One option in a group the app owns — onChange fires with true.',
    code: `<For each={options}>
  {(opt, i) => <Row gap={8}>
    <Radio checked={sel() === i()} onChange={() => setSel(i())} />
    <Text label={opt} fontSize={14} />
  </Row>}
</For>`,
    view: () => {
      const [sel, setSel] = createSignal(0);
      return (
        <Column gap={10}>
          <For each={['Espresso', 'Filter', 'Cold brew']}>
            {(opt, i) => (
              <Row gap={8}>
                <Radio checked={sel() === i()} onChange={() => setSel(i())} />
                <Text label={opt} fontSize={14} color={INK} />
              </Row>
            )}
          </For>
        </Column>
      );
    },
  },
  {
    name: 'Chip', widget: 'FilterChip', group: 'Input',
    blurb: 'Toggleable filter chip — label, checked, onChange(bool).',
    code: `<Chip label="Solid" checked={f().solid} onChange={(v) => toggle('solid', v)} />`,
    view: () => {
      const [a, setA] = createSignal(true);
      const [b, setB] = createSignal(false);
      const [c, setC] = createSignal(true);
      return (
        <Row gap={8}>
          <Chip label="Solid" checked={a()} onChange={setA} />
          <Chip label="Flutter" checked={b()} onChange={setB} />
          <Chip label="bun" checked={c()} onChange={setC} />
        </Row>
      );
    },
  },
  {
    name: 'SegmentedButton', widget: 'SegmentedButton', group: 'Input',
    blurb: 'One-of-N selector; children are the segment labels.',
    code: `<SegmentedButton activeTab={seg()} onChange={setSeg}>
  <Text label="Day" fontSize={13} />
  <Text label="Week" fontSize={13} />
  <Text label="Month" fontSize={13} />
</SegmentedButton>`,
    view: () => {
      const [seg, setSeg] = createSignal(1);
      return (
        <SegmentedButton activeTab={seg()} onChange={setSeg}>
          <Text label="Day" fontSize={13} />
          <Text label="Week" fontSize={13} />
          <Text label="Month" fontSize={13} />
        </SegmentedButton>
      );
    },
  },
  {
    name: 'Dropdown', widget: 'DropdownButton', group: 'Input',
    blurb: 'Select from a menu; children are the options.',
    code: `<Dropdown activeTab={dd()} onChange={setDd}>
  <Text label="Low" fontSize={14} />
  <Text label="Medium" fontSize={14} />
  <Text label="High" fontSize={14} />
</Dropdown>`,
    view: () => {
      const [dd, setDd] = createSignal(1);
      return (
        <Dropdown activeTab={dd()} onChange={setDd}>
          <Text label="Low" fontSize={14} />
          <Text label="Medium" fontSize={14} />
          <Text label="High" fontSize={14} />
        </Dropdown>
      );
    },
  },
  {
    name: 'Slider', widget: 'Slider', group: 'Input',
    blurb: 'Continuous value between min and max.',
    code: `<Slider value={vol()} min={0} max={100} onChange={setVol} />`,
    view: () => {
      const [v, setV] = createSignal(62);
      return (
        <Column gap={8} width="fill">
          <Slider value={v()} min={0} max={100} onChange={setV} />
          <Text label={`value: ${Math.round(v())}`} fontSize={13} color={SUBTLE} />
        </Column>
      );
    },
  },
  {
    name: 'Stepper', widget: 'Stepper', group: 'Input',
    blurb: 'Multi-step flows; each Step has a title and a body.',
    code: `<Stepper activeTab={step()} onChange={setStep}>
  <Step title="Account"><Text label="Name, email, password." fontSize={13} /></Step>
  <Step title="Profile"><Text label="Photo and a short bio." fontSize={13} /></Step>
  <Step title="Done"><Text label="Review and finish." fontSize={13} /></Step>
</Stepper>`,
    view: () => {
      const [step, setStep] = createSignal(1);
      return (
        <Stepper activeTab={step()} onChange={setStep}>
          <Step title="Account"><Text label="Name, email, password." fontSize={13} color={SUBTLE} /></Step>
          <Step title="Profile"><Text label="Photo and a short bio." fontSize={13} color={SUBTLE} /></Step>
          <Step title="Done"><Text label="Review and finish." fontSize={13} color={SUBTLE} /></Step>
        </Stepper>
      );
    },
  },

  // ── lists ───────────────────────────────────────────────────────────
  {
    name: 'ListView', widget: 'ListView.builder', group: 'Lists',
    blurb: 'Lazy, virtualized list — thousands of rows stay smooth. axis 1 for horizontal.',
    code: `<ListView gap={8} height={260}>
  <For each={rows()}>
    {(r) => <Box padding={14} background="#FFFFFFFF" cornerRadius={12}>
      <Text label={r} fontSize={14} color="#FF1C1C1E" /></Box>}
  </For>
</ListView>`,
    view: () => (
      <ListView gap={8} height={260}>
        <For each={Array.from({ length: 40 }, (_, i) => `Row ${i + 1} — virtualized`)}>
          {(r) => (
            <Box padding={14} background={CARD} cornerRadius={12}>
              <Text label={r} fontSize={14} color={INK} />
            </Box>
          )}
        </For>
      </ListView>
    ),
  },
  {
    name: 'ListTile', widget: 'ListTile', group: 'Lists',
    blurb: 'title, subtitle, leading/trailing icons, onTap — the settings-row workhorse.',
    code: `<ListTile title="Notifications" subtitle="Sounds, banners, badges"
          leadingIcon="notifications" trailingIcon="chevron_right"
          onTap={() => open('notifications')} />`,
    view: () => (
      <Column gap={2} width="fill" background={CARD} cornerRadius={14}>
        <ListTile title="Notifications" subtitle="Sounds, banners, badges" leadingIcon="notifications" trailingIcon="chevron_right" />
        <ListTile title="Privacy" subtitle="Location, camera, contacts" leadingIcon="lock" trailingIcon="chevron_right" />
        <ListTile title="Storage" subtitle="2.1 GB used" leadingIcon="storage" trailingIcon="chevron_right" />
      </Column>
    ),
  },
  {
    name: 'LazyGrid', widget: 'GridView.builder', group: 'Lists',
    blurb: 'Virtualized grid; crossAxisCount columns, aspectRatio per cell.',
    code: `<LazyGrid crossAxisCount={3} aspectRatio={1} gap={10} height={240}>
  <For each={items}>
    {(c) => <Box background={c} cornerRadius={14} />}
  </For>
</LazyGrid>`,
    view: () => (
      <LazyGrid crossAxisCount={3} aspectRatio={1} gap={10} height={240}>
        <For each={[ACCENT, GREEN, ORANGE, PURPLE, RED, '#FF00C7BE', '#FFFFD60A', '#FFAF52DE', '#FF64D2FF']}>
          {(c) => <Box background={c} cornerRadius={14} />}
        </For>
      </LazyGrid>
    ),
  },
  {
    name: 'ReorderableListView', widget: 'ReorderableListView.builder', group: 'Lists',
    blurb: 'Drag rows to reorder; onReorder(from, to) updates your source array.',
    code: `<ReorderableListView height={230} gap={8} onReorder={(from, to) => move(from, to)}>
  <For each={rows()}>
    {(r) => <Box padding={14} background="#FFFFFFFF" cornerRadius={12}>
      <Text label={r} fontSize={14} color="#FF1C1C1E" /></Box>}
  </For>
</ReorderableListView>`,
    view: () => {
      const [rows] = createSignal(['Drag me up', 'Or drag me down', 'Long-press + drag', 'Order is yours']);
      return (
        <ReorderableListView height={230} gap={8}>
          <For each={rows()}>
            {(r) => (
              <Box padding={14} background={CARD} cornerRadius={12}>
                <Text label={r} fontSize={14} color={INK} />
              </Box>
            )}
          </For>
        </ReorderableListView>
      );
    },
  },
  {
    name: 'PageView', widget: 'PageView', group: 'Lists',
    blurb: 'Swipeable pages; activeTab is the page index.',
    code: `<PageView activeTab={page()} onChange={setPage} height={200}>
  <Box background="#FF0A84FF" cornerRadius={16} />
  <Box background="#FF30D158" cornerRadius={16} />
  <Box background="#FFFF9F0A" cornerRadius={16} />
</PageView>`,
    view: () => {
      const [page, setPage] = createSignal(0);
      return (
        <Column gap={10} width="fill">
          <PageView activeTab={page()} onChange={setPage} height={200}>
            <Box background={ACCENT} cornerRadius={16} padding={16}>
              <Text label="Page 1 — swipe →" fontSize={15} color="#FFFFFFFF" />
            </Box>
            <Box background={GREEN} cornerRadius={16} padding={16}>
              <Text label="Page 2" fontSize={15} color="#FFFFFFFF" />
            </Box>
            <Box background={ORANGE} cornerRadius={16} padding={16}>
              <Text label="Page 3" fontSize={15} color="#FFFFFFFF" />
            </Box>
          </PageView>
          <Text label={`page ${page() + 1} of 3`} fontSize={13} color={SUBTLE} />
        </Column>
      );
    },
  },
  {
    name: 'AnimatedList', widget: 'AnimatedList', group: 'Lists',
    blurb: 'Items animate in and out as your array changes.',
    code: `<AnimatedList height={220}>
  <For each={items()}>
    {(t) => <Box padding={12} background="#FFFFFFFF" cornerRadius={12}>
      <Text label={t} fontSize={14} color="#FF1C1C1E" /></Box>}
  </For>
</AnimatedList>`,
    view: () => {
      const [items, setItems] = createSignal(['Added with a slide', 'Removed with a fade', 'Driven by your array']);
      return (
        <Column gap={10} width="fill">
          <AnimatedList height={180}>
            <For each={items()}>
              {(t) => (
                <Box padding={12} background={CARD} cornerRadius={12}>
                  <Text label={t} fontSize={14} color={INK} />
                </Box>
              )}
            </For>
          </AnimatedList>
          <Button label="Add item" onClick={() => setItems([...items(), `Item ${items().length + 1}`])} />
        </Column>
      );
    },
  },
  {
    name: 'Dismissible', widget: 'Dismissible', group: 'Lists',
    blurb: 'Swipe a row away; onDismiss removes it from your data.',
    code: `<Dismissible onDismiss={() => remove(item.id)}>
  <Box padding={14} background="#FFFFFFFF" cornerRadius={12}>
    <Text label="Swipe me away" fontSize={14} color="#FF1C1C1E" />
  </Box>
</Dismissible>`,
    view: () => (
      <Column gap={8} width="fill">
        <Dismissible>
          <Box padding={14} width="fill" background={CARD} cornerRadius={12}>
            <Text label="← Swipe me away" fontSize={14} color={INK} />
          </Box>
        </Dismissible>
        <Dismissible>
          <Box padding={14} width="fill" background={CARD} cornerRadius={12}>
            <Text label="← Me too" fontSize={14} color={INK} />
          </Box>
        </Dismissible>
      </Column>
    ),
  },

  // ── navigation & structure ──────────────────────────────────────────
  {
    name: 'Tabs', widget: 'NavigationBar + IndexedStack', group: 'Navigation',
    blurb: 'Bottom tab navigation; every tab stays mounted (state survives switching).',
    code: `<Tabs activeTab={tab()} onChange={setTab} height="fill">
  <Tab title="Home" icon="grid"><Home /></Tab>
  <Tab title="Search" icon="explore"><Search /></Tab>
  <Tab title="Profile" icon="storage"><Profile /></Tab>
</Tabs>`,
    view: () => {
      const [tab, setTab] = createSignal(0);
      const Page = (p) => (
        <Column padding={16} gap={8}>
          <Text label={p.title} fontSize={18} fontWeight={700} color={INK} />
          <Text label="Every tab keeps its state." fontSize={13} color={SUBTLE} />
        </Column>
      );
      return (
        <Box width="fill" height={340} background={CARD} cornerRadius={16}>
          <Tabs activeTab={tab()} onChange={setTab} height="fill">
            <Tab title="Home" icon="grid"><Page title="Home" /></Tab>
            <Tab title="Search" icon="explore"><Page title="Search" /></Tab>
            <Tab title="Profile" icon="storage"><Page title="Profile" /></Tab>
          </Tabs>
        </Box>
      );
    },
  },
  {
    name: 'ExpansionTile', widget: 'ExpansionTile', group: 'Navigation',
    blurb: 'Collapsible section; the host animates open/close.',
    code: `<ExpansionTile title="Advanced settings">
  <Box padding={14}>
    <Text label="Hidden until expanded." fontSize={13} />
  </Box>
</ExpansionTile>`,
    view: () => (
      <Column width="fill" background={CARD} cornerRadius={14}>
        <ExpansionTile title="Advanced settings">
          <Box padding={14}>
            <Text label="Hidden until expanded." fontSize={13} color={SUBTLE} />
          </Box>
        </ExpansionTile>
        <ExpansionTile title="About">
          <Box padding={14}>
            <Text label="Skal gallery, v0.1.0." fontSize={13} color={SUBTLE} />
          </Box>
        </ExpansionTile>
      </Column>
    ),
  },
  {
    name: 'SliverAppBar', widget: 'CustomScrollView + SliverAppBar', group: 'Navigation',
    blurb: 'Collapsing header inside a sliver scroll — pinned, floating, or both.',
    code: `<CustomScrollView height={320}>
  <SliverAppBar title="Collapsing" height={120} sliverMode="pinned" />
  <SliverList>
    <For each={rows}>{(r) => <ListTile title={r} />}</For>
  </SliverList>
</CustomScrollView>`,
    view: () => (
      <Box width="fill" height={320} background={CARD} cornerRadius={16}>
        <CustomScrollView height={320}>
          <SliverAppBar title="Collapsing" height={110} sliverMode="pinned" />
          <SliverList>
            <For each={Array.from({ length: 12 }, (_, i) => `Row ${i + 1} — scroll up`)}>
              {(r) => <ListTile title={r} />}
            </For>
          </SliverList>
        </CustomScrollView>
      </Box>
    ),
  },
  {
    name: 'BottomSheet', widget: 'DraggableScrollableSheet', group: 'Navigation',
    blurb: 'Drag-resizable sheet anchored to the bottom of a Stack.',
    code: `<Stack width="fill" height={340}>
  <Box width="fill" height={340} background="#FF0A84FF" cornerRadius={16} />
  <BottomSheet initialSize={0.45} minSize={0.2} maxSize={0.9}>
    <Column padding={16} gap={8} background="#FFFFFFFF">
      <Text label="Drag me up" fontSize={15} fontWeight={700} />
    </Column>
  </BottomSheet>
</Stack>`,
    view: () => (
      <Stack width="fill" height={340}>
        <Box width="fill" height={340} background={ACCENT} cornerRadius={16} padding={16}>
          <Text label="Content behind the sheet" fontSize={14} color="#FFFFFFFF" />
        </Box>
        <BottomSheet initialSize={0.45} minSize={0.2} maxSize={0.9}>
          <Column padding={16} gap={8} background={CARD}>
            <Box width={44} height={5} background="#FFD1D1D6" cornerRadius={3} />
            <Text label="Drag me up" fontSize={15} fontWeight={700} color={INK} />
            <Text label="A DraggableScrollableSheet underneath." fontSize={13} color={SUBTLE} />
          </Column>
        </BottomSheet>
      </Stack>
    ),
  },

  // ── effects & gestures ──────────────────────────────────────────────
  {
    name: 'BackdropFilter', widget: 'BackdropFilter', group: 'Effects',
    blurb: 'Frosted-glass blur over whatever is behind it in a Stack.',
    code: `<Stack width="fill" height={200}>
  {/* colorful content… */}
  <Box top={50} left={40} right={40} height={100}>
    <BackdropFilter blurRadius={14}>
      <Text label="frosted" fontSize={16} />
    </BackdropFilter>
  </Box>
</Stack>`,
    view: () => (
      <Stack width={350} height={200}>
        <Row gap={0}>
          <Box width={117} height={200} background={ACCENT} />
          <Box width={117} height={200} background={PURPLE} />
          <Box width={116} height={200} background={ORANGE} />
        </Row>
        <Box top={50} left={40} right={40} height={100} cornerRadius={16}>
          <BackdropFilter blurRadius={14}>
            <Column alignment="center" width={270} height={100}>
              <Text label="frosted" fontSize={16} fontWeight={700} color="#FFFFFFFF" />
            </Column>
          </BackdropFilter>
        </Box>
      </Stack>
    ),
  },
  {
    name: 'InteractiveViewer', widget: 'InteractiveViewer', group: 'Effects',
    blurb: 'Pinch-zoom and pan around a child.',
    code: `<InteractiveViewer minScale={0.5} maxScale={4}>
  <Image src="…" width="fill" height={220} />
</InteractiveViewer>`,
    view: () => (
      <Box width="fill" height={220} background={CARD} cornerRadius={16}>
        <InteractiveViewer minScale={0.5} maxScale={4}>
          <LazyGrid crossAxisCount={4} aspectRatio={1} gap={6} height={220}>
            <For each={[ACCENT, GREEN, ORANGE, PURPLE, RED, '#FF00C7BE', '#FFFFD60A', '#FFAF52DE', '#FF64D2FF', ACCENT, GREEN, ORANGE]}>
              {(c) => <Box background={c} cornerRadius={8} />}
            </For>
          </LazyGrid>
        </InteractiveViewer>
      </Box>
    ),
  },
  {
    name: 'CrossFade', widget: 'AnimatedSwitcher', group: 'Effects',
    blurb: 'Cross-fades between children when the content swaps.',
    code: `<CrossFade>
  {day() ? <SunCard /> : <MoonCard />}
</CrossFade>`,
    view: () => {
      const [day, setDay] = createSignal(true);
      return (
        <Column gap={12}>
          <CrossFade>
            <Box padding={20} background={day() ? ORANGE : '#FF3A3A3C'} cornerRadius={16}>
              <Text label={day() ? '☀️ Day mode' : '🌙 Night mode'} fontSize={16} color="#FFFFFFFF" />
            </Box>
          </CrossFade>
          <Button label="Toggle" onClick={() => setDay(!day())} />
        </Column>
      );
    },
  },
  {
    name: 'DragItem & DropZone', widget: 'Draggable + DragTarget', group: 'Effects',
    blurb: 'Native drag-and-drop; the drop zone receives the item id.',
    code: `<DragItem dragData="card-1">
  <Box padding={14} background="#FFFFFFFF" cornerRadius={12}>
    <Text label="Drag me" fontSize={14} />
  </Box>
</DragItem>
<DropZone onDrop={(id) => setDropped(id)}>
  <Box padding={24} borderWidth={2} borderColor="#FF0A84FF" cornerRadius={12}>
    <Text label={dropped() ?? 'Drop here'} fontSize={14} />
  </Box>
</DropZone>`,
    view: () => {
      const [dropped, setDropped] = createSignal(null);
      return (
        <Column gap={16} width="fill">
          <Row gap={10}>
            <DragItem dragData="blue">
              <Box padding={14} background={ACCENT} cornerRadius={12}>
                <Text label="Drag me" fontSize={14} color="#FFFFFFFF" />
              </Box>
            </DragItem>
            <DragItem dragData="green">
              <Box padding={14} background={GREEN} cornerRadius={12}>
                <Text label="Or me" fontSize={14} color="#FFFFFFFF" />
              </Box>
            </DragItem>
          </Row>
          <DropZone onDrop={(id) => setDropped(id)}>
            <Box padding={24} width="fill" background={CHIP} borderWidth={2} borderColor={ACCENT} cornerRadius={12}>
              <Text label={dropped() ? `Dropped: ${dropped()}` : 'Drop here'} fontSize={14} color={INK} />
            </Box>
          </DropZone>
        </Column>
      );
    },
  },
];
