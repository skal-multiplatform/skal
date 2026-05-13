// Widget tree renderer.
//
// One SkalNode widget per JS-created node. SkalNode wraps a
// MemoizingListenableBuilder that subscribes to the node's `cold`
// notifier — the builder runs only when the notifier fires, otherwise
// the cached subtree is returned unchanged. Hot props (opacity,
// transform) live INSIDE the cached subtree under their own
// ListenableBuilder on the node's `hot` notifier — so a 60 fps
// opacity tween triggers exactly one Transform/Opacity rebuild and
// zero work in the surrounding tree.
//
// Why the cache matters: Flutter's Element diff compares
// `oldWidget == newWidget` by identity. If a parent rebuilds but its
// child Widget instances are the SAME references as before (returned
// from a cache), Flutter short-circuits the diff — no child
// State.build() runs. Without the cache, a single prop change
// cascades a build() call through every descendant. With it, the
// cascade stops one level deep regardless of subtree size.
//
// Performance invariants:
//
//   1. The cached widget must NOT close over any per-frame value
//      other than what's published via [node.cold] or [node.hot].
//      Otherwise the cache would be silently stale.
//
//   2. Hot-prop ListenableBuilders are always present (even when
//      their values are at default) — making them conditional would
//      require reading the values in the outer build, which would
//      subscribe the outer build to them — defeating the purpose.
//      Per-node memory cost: tiny.
//
//   3. _childWidgets emits ValueKey(childId) on every child. Without
//      it, Flutter's diff memoizes by call-site index only; inserting
//      a child at the head shifts every subsequent slot and tears
//      them all down.

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'bridge.dart';
import 'memoizing_listenable_builder.dart';
import 'node_state.dart';
import 'registry.dart';
import 'wire.dart';

/// Mounts the bridge's node tree. Drives `bridge.pumpOps()` once per
/// frame via a Ticker — vsync-aligned via
/// `SchedulerBinding.handleBeginFrame`.
class SkalRoot extends StatefulWidget {
  final SkalBridge bridge;
  const SkalRoot({super.key, required this.bridge});

  @override
  State<SkalRoot> createState() => _SkalRootState();
}

class _SkalRootState extends State<SkalRoot>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;

  @override
  void initState() {
    super.initState();
    // Ticker fires from SchedulerBinding.handleBeginFrame, before the
    // build phase. So pumpOps mutates state and fires notifyListeners
    // BEFORE Flutter walks the dirty element list — touched nodes are
    // already marked dirty by the time the build phase starts, so
    // they get rebuilt in the same frame instead of the next.
    _ticker = createTicker(_onTick)..start();
  }

  void _onTick(Duration _) {
    widget.bridge.pumpOps();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SkalNode(
      nodeId: kRootNodeId,
      bridge: widget.bridge,
      key: const ValueKey<int>(kRootNodeId),
    );
  }
}

/// One per JS-created node. Subscribes to the node's `cold` notifier
/// via [MemoizingListenableBuilder] — the builder runs only when the
/// notifier fires, otherwise the cached subtree is returned unchanged
/// and Flutter's Element diff short-circuits the cascade by widget
/// identity.
class SkalNode extends StatelessWidget {
  final int nodeId;
  final SkalBridge bridge;
  const SkalNode({super.key, required this.nodeId, required this.bridge});

  @override
  Widget build(BuildContext context) {
    final node = bridge.nodes[nodeId];
    if (node == null) return const SizedBox.shrink();
    return MemoizingListenableBuilder(
      listenable: node.cold,
      builder: (_) => _buildForType(node, bridge),
    );
  }
}

Widget _buildForType(NodeState node, SkalBridge bridge) {
  switch (node.type) {
    case wtBox:                  return _buildBox(node, bridge);
    case wtColumn:               return _buildColumn(node, bridge);
    case wtScrollView:           return _buildScrollView(node, bridge);
    case wtListView:             return _buildListView(node, bridge);
    case wtReorderableListView:  return _buildReorderableListView(node, bridge);
    case wtRow:                  return _buildRow(node, bridge);
    case wtText:                 return _buildText(node);
    case wtButton:               return _buildButton(node, bridge);
    case wtCustom:               return _buildCustom(node, bridge);
    default:                     return const SizedBox.shrink();
  }
}

/// Dispatch to a registered widget builder for a wtCustom node. The
/// node's `customWidgetName` was set by the drain when it processed
/// the opCreateCustomNode op (which carried the name hash that the
/// drain resolved via the name dictionary).
///
/// If no builder is registered for the name — typical causes: the dev
/// forgot to call the codegen's `registerAll()`, or a typo in JSX vs
/// registration — we render a visible debug placeholder so the gap is
/// obvious rather than silent. In release builds we render an empty
/// SizedBox to keep the gap from polluting production UI.
Widget _buildCustom(NodeState n, SkalBridge bridge) {
  final name = n.customWidgetName;
  if (name == null) {
    assert(() {
      debugPrint('[skal] wtCustom node has no customWidgetName — '
          'opCreateCustomNode was not followed by an opDeclareName for '
          'its hash?');
      return true;
    }());
    return const SizedBox.shrink();
  }
  final builder = SkalRegistry.widgetBuilderFor(name);
  if (builder == null) {
    assert(() {
      debugPrint('[skal] no widget builder registered for <$name>. '
          'Did you forget SkalRegistry.registerWidget("$name", …) in main()?');
      return true;
    }());
    // Visible placeholder in debug only — release-mode renders empty
    // so a missing adapter doesn't leak diagnostic text to end users.
    bool inDebug = false;
    assert(() { inDebug = true; return true; }());
    if (inDebug) {
      return Container(
        padding: const EdgeInsets.all(8),
        color: const Color(0x33FF0000),
        child: Text(
          'no adapter: <$name>',
          style: const TextStyle(color: Color(0xFFFFFFFF), fontSize: 11),
        ),
      );
    }
    return const SizedBox.shrink();
  }
  return builder(n, bridge);
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers — translate prop values into Flutter primitives.
// ─────────────────────────────────────────────────────────────────────────

/// ARGB int (0xAARRGGBB) → Flutter [Color]. Wire format matches Dart's
/// `Color(0xAARRGGBB)` constructor exactly: high byte = alpha.
Color _argb(int v) => Color(v);

/// Apply a width prop (one of the layout sentinels NO_VALUE /
/// FILL_MAX / WRAP_CONTENT, or a literal dp value).
Widget _applyWidth(int v, Widget child) {
  if (v == kNoValue) return child;
  if (v == kFillMax) {
    return SizedBox(width: double.infinity, child: child);
  }
  if (v == kWrapContent) return child;
  return SizedBox(width: v.toDouble(), child: child);
}

Widget _applyHeight(int v, Widget child) {
  if (v == kNoValue) return child;
  if (v == kFillMax) {
    return SizedBox(height: double.infinity, child: child);
  }
  if (v == kWrapContent) return child;
  return SizedBox(height: v.toDouble(), child: child);
}

/// ALIGN_* wire enum → Flutter MainAxisAlignment for Column/Row.
MainAxisAlignment _mainAxisFor(int alignment) {
  switch (alignment) {
    case alignCenter: return MainAxisAlignment.center;
    case alignEnd: return MainAxisAlignment.end;
    case alignSpaceBetween: return MainAxisAlignment.spaceBetween;
    case alignSpaceAround: return MainAxisAlignment.spaceAround;
    case alignSpaceEvenly: return MainAxisAlignment.spaceEvenly;
    default: return MainAxisAlignment.start;
  }
}

FontWeight _fontWeightFor(int w) {
  switch (w) {
    case 100: return FontWeight.w100;
    case 200: return FontWeight.w200;
    case 300: return FontWeight.w300;
    case 400: return FontWeight.w400;
    case 500: return FontWeight.w500;
    case 600: return FontWeight.w600;
    case 700: return FontWeight.w700;
    case 800: return FontWeight.w800;
    case 900: return FontWeight.w900;
    default:  return FontWeight.w400;
  }
}

TextAlign _textAlignFor(int v) {
  switch (v) {
    case 1: return TextAlign.center;
    case 2: return TextAlign.end;
    case 3: return TextAlign.justify;
    default: return TextAlign.start;
  }
}

TextOverflow _textOverflowFor(int v) {
  switch (v) {
    case 1: return TextOverflow.ellipsis;
    case 2: return TextOverflow.visible;
    default: return TextOverflow.clip;
  }
}

String? _fontFamilyFor(int v) {
  switch (v) {
    case 1: return 'serif';
    case 2: return 'monospace';
    case 3: return null; // sans-serif = Flutter default
    default: return null;
  }
}

/// EdgeInsets from PROP_PADDING + per-side overrides. Returns null if
/// no padding props are set.
EdgeInsets? _paddingFor(NodeState n, int defaultAll) {
  final all = n.getPropU32(propPadding, defaultAll);
  final t = n.getPropU32(propPaddingTop, -1);
  final r = n.getPropU32(propPaddingRight, -1);
  final b = n.getPropU32(propPaddingBottom, -1);
  final l = n.getPropU32(propPaddingLeft, -1);
  if (t < 0 && r < 0 && b < 0 && l < 0 && all <= 0) return null;
  return EdgeInsets.only(
    left:   (l >= 0 ? l : all).toDouble(),
    top:    (t >= 0 ? t : all).toDouble(),
    right:  (r >= 0 ? r : all).toDouble(),
    bottom: (b >= 0 ? b : all).toDouble(),
  );
}

/// Apply the cold-prop visual chain: clip, border, background, padding.
/// Order is load-bearing: clip → border → bg → padding. bg paints
/// AFTER the corner radius clip so it follows the rounded shape;
/// padding wraps INSIDE the bg so bg extends to the node's outer
/// bounds rather than being inset.
Widget _applyColdVisual(NodeState n, Widget child, {int defaultPadding = 0}) {
  Widget out = child;

  final pad = _paddingFor(n, defaultPadding);
  if (pad != null) out = Padding(padding: pad, child: out);

  final bg = n.getPropU32(propBgColor, 0);
  final corner = n.getPropU32(propCornerRadius, 0);
  final borderW = n.getPropU32(propBorderWidth, 0);
  final borderC = n.getPropU32(propBorderColor, 0xFF000000);

  if (bg != 0 || corner > 0 || borderW > 0) {
    // DecoratedBox instead of Container — Container is a convenience
    // widget that composes ConstrainedBox + Padding + DecoratedBox +
    // Transform + Align internally; we apply sizing / padding via
    // separate wrappers (_applyWidth, _applyHeight, Padding) so most
    // of Container's inner widgets would be no-ops in our tree. Five
    // fewer widget objects per styled node, real frame-budget win for
    // the tweet feed.
    out = DecoratedBox(
      decoration: BoxDecoration(
        color: bg != 0 ? _argb(bg) : null,
        borderRadius: corner > 0 ? BorderRadius.circular(corner.toDouble()) : null,
        border: borderW > 0
            ? Border.all(color: _argb(borderC), width: borderW.toDouble())
            : null,
      ),
      child: out,
    );
  }

  return out;
}

/// Wrap with the hot-prop ListenableBuilder. Listens on the node's
/// `hot` ChangeNotifier — fires once per drain if ANY hot prop
/// changed. ListenableBuilder is the right primitive for this in
/// Flutter 3.10+ (AnimatedBuilder is a misnomer when there's no
/// animation).
class _HotLayer extends StatelessWidget {
  final NodeState node;
  final Widget child;
  const _HotLayer({required this.node, required this.child});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: node.hot,
      builder: (_, c) {
        Widget w = c!;
        final op = node.opacity;
        final tx = node.translationX;
        final ty = node.translationY;
        final sx = node.scaleX;
        final sy = node.scaleY;
        final rz = node.rotationZ;
        if (tx != 0 || ty != 0 || sx != 1 || sy != 1 || rz != 0) {
          final m = Matrix4.identity()
            ..translateByDouble(tx, ty, 0.0, 1.0)
            ..rotateZ(rz)
            ..scaleByDouble(sx, sy, 1.0, 1.0);
          w = Transform(transform: m, child: w);
        }
        if (op < 1.0) w = Opacity(opacity: op.clamp(0.0, 1.0), child: w);
        return w;
      },
      child: child,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Per-widget builders. Each called ONCE per cache invalidation; the
// returned widget is cached by _SkalNodeState until cold.notify() fires.
// ─────────────────────────────────────────────────────────────────────────

/// Produce the list of child widgets — parents (Column/Row/Box) embed
/// these into their `children:` slot. Each child carries a
/// ValueKey(id) so Flutter's Element diff reconciles by id, not by
/// position; inserting / removing / reordering doesn't tear down
/// siblings.
List<Widget> _childWidgets(NodeState node, SkalBridge bridge) {
  final out = <Widget>[];
  for (final id in node.childIds) {
    out.add(SkalNode(
      nodeId: id,
      bridge: bridge,
      key: ValueKey<int>(id),
    ));
  }
  return out;
}

Widget _buildBox(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);

  final children = _childWidgets(n, bridge);
  Widget inner = children.isEmpty
      ? const SizedBox.shrink()
      : (children.length == 1
          ? children.first
          : Stack(children: children));

  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _HotLayer(node: n, child: inner);
}

Widget _buildColumn(NodeState n, SkalBridge bridge) {
  // Defaults: fillMaxWidth + padding(16) + gap(8). Apps override via
  // the corresponding props on the JSX `<column>`.
  final width = n.getPropU32(propWidth, kFillMax);
  final height = n.getPropU32(propHeight, kNoValue);
  final alignment = n.getPropU32(propAlignment, -1);
  final gap = n.getPropU32(propGap, 8);

  final children = _childWidgets(n, bridge);
  final spaced = _intersperse(children, SizedBox(height: gap.toDouble()));

  Widget inner = Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    mainAxisSize: height == kNoValue ? MainAxisSize.min : MainAxisSize.max,
    mainAxisAlignment: _mainAxisFor(alignment),
    children: spaced,
  );

  inner = _applyColdVisual(n, inner, defaultPadding: 16);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _HotLayer(node: n, child: inner);
}

/// Lazy-rendered list — backed by `ListView.builder`. Only the visible
/// window of children plus a small overscan buffer is built. Mount cost
/// is constant regardless of how many nodes are in the children list;
/// the bridge's NodeState graph still holds all 5000 entries, but
/// Flutter only constructs Element trees for the ~10 currently visible.
///
/// Children-list backing is `ListChildList` (see NodeState) — O(1)
/// append, O(N − pos) insert/remove elsewhere. For drag-and-drop or
/// mid-list mutation, use `<reorderableListView>` instead.
///
/// Note: ListView.builder can NOT be wrapped in another scroller of
/// the same axis. The JS app should make this the OUTERMOST vertical
/// scroller (or use `<scrollView>` if it needs eager rendering).
Widget _buildListView(NodeState n, SkalBridge bridge) {
  // Note: PROP_ALIGNMENT is intentionally ignored in lazy mode —
  // ListView.builder positions children by extent, not by MainAxis
  // arrangement. If we ever need alignment in a lazy list, the right
  // shape is a SliverList with a leading/trailing widget.
  final gap = n.getPropU32(propGap, 8);
  final count = n.childCount;

  // Outer Padding to match the default 16dp content padding column has,
  // since DecoratedBox-via-_applyColdVisual would inset bg inside any
  // padding we apply. ListView's own padding param works fine because
  // it doesn't fight the scroll viewport's content extent.
  final pad = _paddingFor(n, 16);

  Widget inner = ListView.builder(
    padding: pad,
    // For interspersed-gap rendering we double the slot count and
    // alternate: even = real child, odd = gap. Cheaper than building
    // a Column-per-row with gap inside.
    itemCount: count == 0 ? 0 : (count * 2 - 1),
    itemBuilder: (_, i) {
      if (i.isOdd) return SizedBox(height: gap.toDouble());
      // O(1) on list-backed ListChildList for the visible window.
      final childId = n.childAt(i ~/ 2);
      return SkalNode(
        nodeId: childId,
        bridge: bridge,
        key: ValueKey<int>(childId),
      );
    },
  );

  // Apply background / border separately (NOT via _applyColdVisual,
  // since that wraps in Padding which would interfere with the inner
  // ListView already taking the available space).
  final bg = n.getPropU32(propBgColor, 0);
  final corner = n.getPropU32(propCornerRadius, 0);
  if (bg != 0 || corner > 0) {
    inner = DecoratedBox(
      decoration: BoxDecoration(
        color: bg != 0 ? _argb(bg) : null,
        borderRadius:
            corner > 0 ? BorderRadius.circular(corner.toDouble()) : null,
      ),
      child: inner,
    );
  }

  return _HotLayer(node: n, child: inner);
}

/// Drag-and-drop reorderable list — backed by `ReorderableListView.builder`.
///
/// Same shape as [_buildListView], but:
///   • Children-list backing is `TreapChildList`, so any-position
///     mutation is O(log N). The dev signed up for this by picking
///     the widget type; cheap-list users (`<listView>`) don't pay
///     the treap tax.
///   • Each child is wrapped with a key Flutter uses to track the
///     drag gesture.
///   • An `onReorder` callback is required by Flutter — we wire it as
///     a no-op pending a proper JS reorder-event protocol. The list
///     still renders correctly; drag gestures complete but don't
///     persist into the bridge state. Wiring this end-to-end means
///     adding a new event kind (EV_REORDER) and a JS handler — see
///     the `TODO(reorder-events)` marker on the onReorder callback.
Widget _buildReorderableListView(NodeState n, SkalBridge bridge) {
  final gap = n.getPropU32(propGap, 8);
  final count = n.childCount;
  final pad = _paddingFor(n, 16);

  Widget inner = ReorderableListView.builder(
    padding: pad,
    // No gap interleaving here — ReorderableListView wants real items
    // only (every slot needs a stable Key for drag tracking). Apply
    // bottom-margin per child instead.
    itemCount: count,
    itemBuilder: (_, i) {
      // O(log N) per visible item under TreapChildList.
      final childId = n.childAt(i);
      final child = SkalNode(
        nodeId: childId,
        bridge: bridge,
        key: ValueKey<int>(childId),
      );
      // Last child gets no trailing gap.
      if (gap == 0 || i == count - 1) return child;
      return Padding(
        key: ValueKey<int>(childId),
        padding: EdgeInsets.only(bottom: gap.toDouble()),
        child: child,
      );
    },
    onReorder: (oldIndex, newIndex) {
      // TODO(reorder-events): emit an EV_REORDER on the event ring
      // (handlerId, oldIndex, newIndex) so the JS app can update its
      // source array. For now Flutter swallows the gesture and the
      // next pumpOps() re-builds the list from the unchanged bridge
      // state — visually the item snaps back, which is the right
      // safe default until the event protocol is in place.
    },
  );

  final bg = n.getPropU32(propBgColor, 0);
  final corner = n.getPropU32(propCornerRadius, 0);
  if (bg != 0 || corner > 0) {
    inner = DecoratedBox(
      decoration: BoxDecoration(
        color: bg != 0 ? _argb(bg) : null,
        borderRadius:
            corner > 0 ? BorderRadius.circular(corner.toDouble()) : null,
      ),
      child: inner,
    );
  }

  return _HotLayer(node: n, child: inner);
}

Widget _buildScrollView(NodeState n, SkalBridge bridge) {
  final alignment = n.getPropU32(propAlignment, -1);
  final gap = n.getPropU32(propGap, 8);

  final children = _childWidgets(n, bridge);
  final spaced = _intersperse(children, SizedBox(height: gap.toDouble()));

  Widget inner = SingleChildScrollView(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: _mainAxisFor(alignment),
      children: spaced,
    ),
  );

  inner = _applyColdVisual(n, inner, defaultPadding: 16);
  return _HotLayer(node: n, child: inner);
}

Widget _buildRow(NodeState n, SkalBridge bridge) {
  final alignment = n.getPropU32(propAlignment, -1);
  final gap = n.getPropU32(propGap, 8);
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);

  final children = _childWidgets(n, bridge);
  final spaced = _intersperse(children, SizedBox(width: gap.toDouble()));

  // Horizontally scrollable by default so wide rows don't clip when
  // the row exceeds the viewport width (e.g. a wide button bar).
  Widget inner = SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisAlignment: _mainAxisFor(alignment),
      mainAxisSize: MainAxisSize.min,
      children: spaced,
    ),
  );

  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _HotLayer(node: n, child: inner);
}

Widget _buildText(NodeState n) {
  final text = n.text;
  final fontSize = n.getPropU32(propFontSize, 14);
  final fontWeight = _fontWeightFor(n.getPropU32(propFontWeight, 400));
  final fgRaw = n.getPropU32(propFgColor, 0xFF000000);
  final align = _textAlignFor(n.getPropU32(propTextAlign, 0));
  final maxLinesV = n.getPropU32(propMaxLines, 0);
  final overflow = _textOverflowFor(n.getPropU32(propTextOverflow, 0));
  final family = _fontFamilyFor(n.getPropU32(propFontFamily, 2)); // mono default
  final lineHeight = n.getPropU32(propLineHeight, 0);

  final widget = Text(
    text,
    style: TextStyle(
      fontSize: fontSize.toDouble(),
      fontWeight: fontWeight,
      color: _argb(fgRaw),
      fontFamily: family,
      height: lineHeight > 0 ? lineHeight / fontSize : null,
    ),
    textAlign: align,
    maxLines: maxLinesV > 0 ? maxLinesV : null,
    overflow: overflow,
  );

  return _HotLayer(node: n, child: widget);
}

Widget _buildButton(NodeState n, SkalBridge bridge) {
  final enabled = n.getPropU32(propEnabled, 1) != 0;
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final bg = n.getPropU32(propBgColor, 0);
  final fg = n.getPropU32(propFgColor, 0);
  final fontSize = n.getPropU32(propFontSize, 14);
  final cornerRadius = n.getPropU32(propCornerRadius, -1);
  final pad = n.getPropU32(propPadding, -1);

  // 3:1 horizontal:vertical when an explicit `padding` is set
  // (matches Material3's default proportions, just scaled down).
  // Otherwise use Material3's default 24h × 8v.
  final contentPad = pad >= 0
      ? EdgeInsets.symmetric(horizontal: (pad * 3).toDouble(), vertical: pad.toDouble())
      : const EdgeInsets.symmetric(horizontal: 24, vertical: 8);

  final style = ElevatedButton.styleFrom(
    backgroundColor: bg != 0 ? _argb(bg) : null,
    foregroundColor: fg != 0 ? _argb(fg) : null,
    padding: contentPad,
    shape: cornerRadius >= 0
        ? _roundedCornerShape(cornerRadius.toDouble())
        : null,
  );

  Widget widget = ElevatedButton(
    // Read n.onClickHandlerId at INVOCATION time so the latest
    // handler binding wins (the cache invalidates on cold.notify
    // anyway, but reading inside the closure is also a no-cost
    // hedge against stale captures).
    onPressed: enabled
        ? () => bridge.dispatchEvent(n.onClickHandlerId)
        : null,
    style: style,
    child: Text(n.text, style: TextStyle(fontSize: fontSize.toDouble())),
  );

  widget = _applyHeight(height, _applyWidth(width, widget));
  return _HotLayer(node: n, child: widget);
}

// `RoundedRectangleBorder` constructor wrapper to read more naturally
// next to the other style helpers.
OutlinedBorder _roundedCornerShape(double radius) =>
    RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius));

// Intersperse a separator widget between children to achieve a fixed
// gap. Flutter's Column/Row don't have a `gap:` parameter, so we
// inject SizedBoxes between siblings to get one. Skips when gap is 0.
List<Widget> _intersperse(List<Widget> children, Widget separator) {
  if (children.length <= 1) return children;
  final out = <Widget>[];
  for (var i = 0; i < children.length; i++) {
    if (i > 0) out.add(separator);
    out.add(children[i]);
  }
  return out;
}
