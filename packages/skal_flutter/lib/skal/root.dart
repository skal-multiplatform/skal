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

import 'dart:async' show Completer, Timer;
import 'dart:convert' show jsonDecode;
// FileImage requires dart:io's File on native — not available on
// Flutter Web. The conditional re-export below picks the right
// implementation per target; `fileImageFromPath` returns null on web
// (browsers can't open arbitrary local paths anyway).
import '_file_image_io.dart'
    if (dart.library.js_interop) '_file_image_web.dart';
// <HtmlEmbed> — picks Flutter Web's HtmlElementView on web, a sized
// placeholder on native (the intrinsic is inherently web-only).
import '_html_embed_io.dart'
    if (dart.library.js_interop) '_html_embed_web.dart';
import 'dart:ui' show ImageFilter;

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart' show kDebugMode, kIsWeb;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/rendering.dart' show RenderProxyBox;
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import 'bridge.dart';
import 'hot_reload_client.dart';
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

  static bool _errorEchoInstalled = false;

  @override
  void initState() {
    super.initState();
    // Compact one-line echo of every FlutterError. The full multi-line
    // report still goes to the default handler, but on iOS the unified
    // log drops/truncates that spew — a first-frame layout exception
    // rendered the app blank with NOTHING in `log show` (2026-07-23).
    // One short `[skal]` line survives every platform's logging.
    if (kDebugMode && !_errorEchoInstalled) {
      _errorEchoInstalled = true;
      final prev = FlutterError.onError;
      FlutterError.onError = (details) {
        debugPrint(
            '[skal] FlutterError: '
            '${details.exceptionAsString().split('\n').first}');
        prev?.call(details);
      };
    }
    // Ticker fires from SchedulerBinding.handleBeginFrame, before the
    // build phase. So pumpOps mutates state and fires notifyListeners
    // BEFORE Flutter walks the dirty element list — touched nodes are
    // already marked dirty by the time the build phase starts, so
    // they get rebuilt in the same frame instead of the next.
    _ticker = createTicker(_onTick)..start();
    // Automatic JS hot reload (native dev): connect to the dev server and
    // re-evaluate pushed bundles in place. No-op unless launched with
    // `--dart-define=SKAL_HOT=1` (the dev:hot scripts), and on web.
    startHotReloadClient(widget.bridge);
  }

  void _onTick(Duration _) {
    widget.bridge.pumpOps();
  }

  @override
  void reassemble() {
    super.reassemble();
    // JS hot reload (manual). Flutter's hot reload (`r` in `flutter run`)
    // re-syncs changed assets into the running app and then calls
    // reassemble() — so we re-read the vite-rebuilt skal-app.js and
    // re-evaluate it in the live VM. The eval string runs the OUTGOING
    // generation's teardown (beginReload — dispose + host tree reset, see
    // hot.js) first, then the fresh bundle re-mounts in place. Native + debug
    // only: web reloads via Vite/the browser, and release ships bytecode with
    // no reload trigger.
    //
    // Workflow: run `vite build --watch` (the app's `dev` script) so
    // skal-app.js stays fresh, then press `r` to apply JS edits.
    if (kIsWeb || !kDebugMode) return;
    // Drop any cached copy so we re-read the bytes Flutter just synced, then
    // hand it to the shared reload path (which no-ops if the JS is unchanged,
    // e.g. a pure-Dart hot reload).
    rootBundle.evict('assets/skal-app.js');
    rootBundle.loadString('assets/skal-app.js', cache: false).then((src) {
      widget.bridge.hotReload(src);
    }).catchError((Object e) {
      debugPrint('[skal] JS hot reload: could not read skal-app.js: $e');
    });
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // _SkalBrightness carries the live design brightness as an
    // InheritedWidget. SkalRoot rebuilds on every setDesign (main.dart's
    // designChanged ListenableBuilder cascades into it), so this token
    // changes then — and the <text> nodes that depend on it rebuild to
    // re-pick their brightness-derived default color.
    //
    // Material vs Cupertino mode is deliberately NOT carried here: it is
    // an init-time flag, not a reactive input. The control builders read
    // it via bridge.isCupertino as a cached build-time branch. Switching
    // mode mid-app is unsupported by design — set it once at startup.
    return _SkalBrightness(
      brightness: widget.bridge.designBrightness,
      child: SkalNode(
        nodeId: kRootNodeId,
        bridge: widget.bridge,
        key: const ValueKey<int>(kRootNodeId),
      ),
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
      builder: (context) {
        final built = _buildForType(node, bridge, context);
        // Accessibility + E2E test handles — a `semanticLabel` (screen-reader
        // text) and/or a `testID` (the Semantics `identifier` that Maestro /
        // integration_test match on) on ANY node wrap it in a single
        // `Semantics`. Done here, once, rather than in every builder, inside
        // the memoized builder so it costs nothing until the cold notifier
        // fires.
        final label = node.getPropStr(propSemanticLabel);
        final testId = node.getPropStr(propTestId);
        final hasLabel = label != null && label.isNotEmpty;
        final hasTestId = testId != null && testId.isNotEmpty;
        if (!hasLabel && !hasTestId) return built;
        // No `container: true`: for a leaf (e.g. <text testID>) the identifier
        // rides on the child's own semantics node, and for a wrapper
        // (<box testID>) it annotates the region without collapsing the
        // subtree's child nodes — so descendant testIDs / labels stay
        // individually findable and screen-reader traversal is preserved.
        // `testID` surfaces as the Android resource-id Maestro matches via
        // `id:`. (E2E asserts by `id:`, since Skal text lands in the a11y
        // label, not Maestro's `text` field — see docs/TESTING.md.)
        return Semantics(
          label: hasLabel ? label : null,
          identifier: hasTestId ? testId : null,
          child: built,
        );
      },
    );
  }
}

Widget _buildForType(NodeState node, SkalBridge bridge, BuildContext context) {
  // <text> is the one builder that reads the design brightness directly
  // (_buildText picks a light/dark default foreground color). Register a
  // dependency on _SkalBrightness so a setDesign() brightness toggle
  // rebuilds exactly those nodes — Flutter's InheritedWidget mechanism,
  // the same one `Theme` uses. Every other builder either ignores
  // brightness or gets it for free via the real `Theme`/`CupertinoTheme`.
  //
  // Material vs Cupertino mode is NOT a dependency: it is an init flag,
  // resolved via bridge.isCupertino as a cached build-time branch.
  if (node.type == wtText) {
    context.dependOnInheritedWidgetOfExactType<_SkalBrightness>();
  }
  switch (node.type) {
    case wtBox:                  return _buildBox(node, bridge);
    case wtColumn:               return _buildColumn(node, bridge);
    case wtScrollView:           return _buildScrollView(node, bridge);
    case wtListView:             return _buildListView(node, bridge);
    case wtReorderableListView:  return _buildReorderableListView(node, bridge);
    case wtRow:                  return _buildRow(node, bridge);
    case wtText:                 return _buildText(node, bridge);
    case wtButton:               return _buildButton(node, bridge);
    case wtImage:                return _buildImage(node, bridge);
    case wtStack:                return _buildStack(node, bridge);
    case wtSwitch:               return _buildSwitch(node, bridge);
    case wtSlider:               return _buildSlider(node, bridge);
    case wtCheckbox:             return _buildCheckbox(node, bridge);
    case wtActivityIndicator:    return _buildActivityIndicator(node, bridge);
    case wtProgressBar:          return _buildProgressBar(node);
    case wtLazyGrid:             return _buildLazyGrid(node, bridge);
    case wtWrap:                 return _buildWrap(node, bridge);
    case wtSafeArea:             return _buildSafeArea(node, bridge);
    case wtRichText:             return _buildRichText(node, bridge);
    case wtTextInput:            return _buildTextInput(node, bridge);
    case wtNavigator:            return _buildNavigator(node, bridge);
    case wtScreen:               return _buildScreen(node, bridge);
    case wtTabs:                 return _buildTabs(node, bridge);
    case wtTab:                  return _buildTab(node, bridge);
    case wtHero:                 return _buildHero(node, bridge);
    case wtAnimatedList:         return _buildAnimatedList(node, bridge);
    case wtCrossFade:            return _buildCrossFade(node, bridge);
    case wtListTile:             return _buildListTile(node, bridge);
    case wtPageView:             return _buildPageView(node, bridge);
    case wtDismissible:          return _buildDismissible(node, bridge);
    case wtCustomScrollView:     return _buildCustomScrollView(node, bridge);
    case wtSliverAppBar:         return _buildSliverAppBar(node, bridge);
    case wtSliverList:           return _buildSliverList(node, bridge);
    case wtSliverGrid:           return _buildSliverGrid(node, bridge);
    case wtCanvas:               return _buildCanvas(node);
    case wtDragItem:             return _buildDragItem(node, bridge);
    case wtDropZone:             return _buildDropZone(node, bridge);
    case wtRadio:                return _buildRadio(node, bridge);
    case wtChip:                 return _buildChip(node, bridge);
    case wtSegmentedButton:      return _buildSegmentedButton(node, bridge);
    case wtExpansionTile:        return _buildExpansionTile(node, bridge);
    case wtDropdown:             return _buildDropdown(node, bridge);
    case wtStepper:              return _buildStepper(node, bridge);
    case wtStep:                 return _buildStep(node, bridge);
    case wtDrawer:               return _buildDrawer(node, bridge);
    case wtBottomSheet:          return _buildBottomSheet(node, bridge);
    case wtBackdropFilter:       return _buildBackdropFilter(node, bridge);
    case wtInteractiveViewer:    return _buildInteractiveViewer(node, bridge);
    case wtHtmlEmbed:            return _buildHtmlEmbed(node, bridge);
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

/// True when the design brightness is dark.
bool _isDark(SkalBridge bridge) => bridge.designBrightness == 1;

/// Brightness dependency token. [SkalRoot] rebuilds this whenever JS
/// calls `setDesign` (the `MaterialApp` in main.dart already rebuilds
/// then, and that cascades into `SkalRoot`). `<text>` nodes register a
/// dependency on it in [_buildForType] via
/// `dependOnInheritedWidgetOfExactType`, so a brightness toggle rebuilds
/// exactly them — the same way `Theme` propagates.
///
/// Only brightness lives here. Material ↔ Cupertino mode is an init-time
/// flag: the control builders read it via `bridge.isCupertino` as a
/// build-time branch cached by `MemoizingListenableBuilder`. Switching
/// mode mid-app is unsupported by design — no widget ever moves between
/// Material and Cupertino at runtime, so that reactivity is pure waste.
class _SkalBrightness extends InheritedWidget {
  const _SkalBrightness({
    required this.brightness,
    required super.child,
  });

  final int brightness;

  @override
  bool updateShouldNotify(_SkalBrightness oldWidget) =>
      oldWidget.brightness != brightness;
}

/// Apply a width prop (one of the layout sentinels NO_VALUE /
/// FILL_MAX / WRAP_CONTENT, or a literal dp value).
Widget _applyWidth(int v, Widget child) {
  if (v == kNoValue) return child;
  if (v == kFillMax) {
    return SkalFill(width: double.infinity, child: child);
  }
  if (v == kWrapContent) return child;
  return SizedBox(width: v.toDouble(), child: child);
}

Widget _applyHeight(int v, Widget child) {
  if (v == kNoValue) return child;
  if (v == kFillMax) {
    return SkalFill(height: double.infinity, child: child);
  }
  if (v == kWrapContent) return child;
  return SizedBox(height: v.toDouble(), child: child);
}

/// Bounded-aware sizing — the widget behind every `width="fill"` /
/// `height="fill"`, both for the intrinsics above and for codegen
/// adapters' `_skalApplyBaseProps` (which passes finite dp values
/// through the same widget).
///
/// Semantics per axis:
///   • finite value          → exact dp, clamped to the incoming
///                             constraints (SizedBox behavior)
///   • double.infinity       → fill the axis IF the incoming max is
///                             bounded; otherwise leave the axis loose
///                             (wrap content)
///   • null                  → pass constraints through untouched
///
/// The third row is the reason this class exists. A raw
/// `SizedBox(width: double.infinity)` inside an unbounded axis — any
/// `<Column>` (which DEFAULTS to fill width) nested in a `<Row>`, or a
/// fill-height child inside a `<Column>` — throws "BoxConstraints
/// forces an infinite width/height", and one throwing node aborts the
/// entire layout flush: the whole app renders blank, silently on
/// platforms where the console spew never surfaces (observed on the
/// iOS Simulator, 2026-07-23). Degrading fill→wrap under unbounded
/// constraints matches the dev's intent ("as much as the parent
/// allows" — an unbounded parent allows anything, so let content
/// decide) and makes the failure class unrepresentable.
class SkalFill extends SingleChildRenderObjectWidget {
  const SkalFill({super.key, this.width, this.height, super.child});

  /// Finite = exact dp; infinity = fill-if-bounded; null = untouched.
  final double? width;
  final double? height;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      RenderSkalFill(width: width, height: height);

  @override
  void updateRenderObject(
      BuildContext context, covariant RenderSkalFill renderObject) {
    renderObject
      ..width = width
      ..height = height;
  }
}

class RenderSkalFill extends RenderProxyBox {
  RenderSkalFill({double? width, double? height})
      : _width = width,
        _height = height;

  double? _width;
  set width(double? v) {
    if (v != _width) {
      _width = v;
      markNeedsLayout();
    }
  }

  double? _height;
  set height(double? v) {
    if (v != _height) {
      _height = v;
      markNeedsLayout();
    }
  }

  BoxConstraints _innerConstraints(BoxConstraints c) {
    double minW = c.minWidth, maxW = c.maxWidth;
    double minH = c.minHeight, maxH = c.maxHeight;
    final w = _width;
    if (w != null) {
      if (w.isFinite) {
        minW = maxW = w.clamp(c.minWidth, c.maxWidth);
      } else if (c.maxWidth.isFinite) {
        minW = maxW = c.maxWidth;
      }
      // else: fill under unbounded width — leave loose, content decides.
    }
    final h = _height;
    if (h != null) {
      if (h.isFinite) {
        minH = maxH = h.clamp(c.minHeight, c.maxHeight);
      } else if (c.maxHeight.isFinite) {
        minH = maxH = c.maxHeight;
      }
    }
    return BoxConstraints(
      minWidth: minW, maxWidth: maxW, minHeight: minH, maxHeight: maxH);
  }

  @override
  void performLayout() {
    final inner = _innerConstraints(constraints);
    if (child != null) {
      child!.layout(inner, parentUsesSize: true);
      size = constraints.constrain(child!.size);
    } else {
      size = inner.smallest;
    }
  }

  @override
  Size computeDryLayout(covariant BoxConstraints constraints) {
    final inner = _innerConstraints(constraints);
    if (child != null) return constraints.constrain(child!.getDryLayout(inner));
    return inner.smallest;
  }

  // Exact finite dims answer intrinsics directly (SizedBox parity);
  // fill can't be resolved without incoming constraints, so it defers
  // to the child like a plain proxy.
  @override
  double computeMinIntrinsicWidth(double height) =>
      (_width?.isFinite ?? false)
          ? _width!
          : super.computeMinIntrinsicWidth(height);

  @override
  double computeMaxIntrinsicWidth(double height) =>
      (_width?.isFinite ?? false)
          ? _width!
          : super.computeMaxIntrinsicWidth(height);

  @override
  double computeMinIntrinsicHeight(double width) =>
      (_height?.isFinite ?? false)
          ? _height!
          : super.computeMinIntrinsicHeight(width);

  @override
  double computeMaxIntrinsicHeight(double width) =>
      (_height?.isFinite ?? false)
          ? _height!
          : super.computeMaxIntrinsicHeight(width);
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

/// `propAxis` wire enum → Flutter [Axis]. 0 = vertical, 1 = horizontal.
Axis _axisFor(int v) => v == 1 ? Axis.horizontal : Axis.vertical;

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
  final pad = _paddingFor(n, defaultPadding);

  final bg = n.getPropU32(propBgColor, 0);
  final corner = n.getPropU32(propCornerRadius, 0);
  final borderW = n.getPropU32(propBorderWidth, 0);
  final borderC = n.getPropU32(propBorderColor, 0xFF000000);
  final hasDecoration = bg != 0 || corner > 0 || borderW > 0;

  BoxDecoration? decoration() => hasDecoration
      ? BoxDecoration(
          color: bg != 0 ? _argb(bg) : null,
          borderRadius:
              corner > 0 ? BorderRadius.circular(corner.toDouble()) : null,
          border: borderW > 0
              ? Border.all(color: _argb(borderC), width: borderW.toDouble())
              : null,
        )
      : null;

  // ANIMATION.md §4 — cold-prop tweens. When the node carries an
  // `animate` spec, an `AnimatedContainer` tweens the decoration
  // (color / border / radius) + padding host-side on any change;
  // without one we keep the lean DecoratedBox + Padding chain. The
  // child sits behind a RepaintBoundary so the per-frame container
  // re-composite never re-runs the child's paint().
  final animMs = n.getPropU32(propAnimDuration, 0);
  if (animMs > 0 && (hasDecoration || pad != null)) {
    return AnimatedContainer(
      duration: Duration(milliseconds: animMs),
      curve: _curveFor(n.getPropU32(propAnimCurve, 0)),
      padding: pad,
      decoration: decoration(),
      child: RepaintBoundary(child: child),
    );
  }

  Widget out = child;
  if (pad != null) out = Padding(padding: pad, child: out);
  if (hasDecoration) {
    // DecoratedBox instead of Container — Container is a convenience
    // widget that composes ConstrainedBox + Padding + DecoratedBox +
    // Transform + Align internally; we apply sizing / padding via
    // separate wrappers (_applyWidth, _applyHeight, Padding) so most
    // of Container's inner widgets would be no-ops in our tree. Five
    // fewer widget objects per styled node, real frame-budget win for
    // the tweet feed.
    out = DecoratedBox(decoration: decoration()!, child: out);
  }
  return out;
}

/// Wrap [child] in a `MouseRegion` when an `onHover` handler is bound —
/// dispatches `onHover(true)` on pointer-enter, `onHover(false)` on
/// exit (a desktop / web affordance). A `MouseRegion` is a pointer
/// listener, not a gesture recognizer, so it composes freely alongside
/// [_applyGestures] without entering the arena. No handler → [child] is
/// returned untouched, so the common case pays for no extra widget.
Widget _applyHover(NodeState n, SkalBridge bridge, Widget child) {
  final hover = n.onHoverHandlerId;
  if (hover == 0) return child;
  return MouseRegion(
    onEnter: (_) =>
        bridge.dispatchEventBool(hover, true, eventKind: evHover),
    onExit: (_) =>
        bridge.dispatchEventBool(hover, false, eventKind: evHover),
    child: child,
  );
}

/// Wrap [child] in a [_SkalFocus] host when an `onKey` handler is
/// bound — every `KeyDownEvent` while the node is focused fires `onKey`
/// with a normalized combo string ("meta+s", "escape", "arrow up").
/// No handler → [child] is returned untouched.
Widget _applyFocus(NodeState n, SkalBridge bridge, Widget child) {
  final key = n.onKeyHandlerId;
  if (key == 0) return child;
  return _SkalFocus(bridge: bridge, handlerId: key, child: child);
}

/// Logical keys that are themselves modifiers — a `KeyDownEvent` for
/// one of these is filtered out of `onKey` so a bare ⌘ / Shift press
/// doesn't dispatch a junk combo (`"meta+meta left"`). The modifier
/// still rides the NEXT real key, picked up from `HardwareKeyboard`.
// Not `const` — `LogicalKeyboardKey` overrides `==`, so it can't be a
// const-set element; a top-level `final` set is built once on first use.
final Set<LogicalKeyboardKey> _modifierKeys = <LogicalKeyboardKey>{
  LogicalKeyboardKey.shiftLeft,
  LogicalKeyboardKey.shiftRight,
  LogicalKeyboardKey.controlLeft,
  LogicalKeyboardKey.controlRight,
  LogicalKeyboardKey.altLeft,
  LogicalKeyboardKey.altRight,
  LogicalKeyboardKey.metaLeft,
  LogicalKeyboardKey.metaRight,
};

/// Stateful `Focus` host for `<box onKey>`. Owns a `FocusNode` so it
/// can re-request focus on a pointer-down — making the node behave like
/// any clickable desktop control. A bare `Focus` is NOT click-focusable
/// (it only takes focus via `autofocus`, once, or Tab traversal), so an
/// `onKey` node would silently stop receiving keys the moment focus
/// moved elsewhere. The owned node also survives cold rebuilds with its
/// focus state intact.
///
/// Click-to-focus rides a `Listener` (`onPointerDown`), not a
/// `GestureDetector` — a `Listener` never enters the gesture arena, so
/// it can't steal an `onTap` the same node might also carry. `autofocus`
/// is kept so the primitive also works with no click; with several
/// `onKey` nodes in one focus scope only the first wins the autofocus.
class _SkalFocus extends StatefulWidget {
  const _SkalFocus({
    required this.bridge,
    required this.handlerId,
    required this.child,
  });

  final SkalBridge bridge;
  final int handlerId;
  final Widget child;

  @override
  State<_SkalFocus> createState() => _SkalFocusState();
}

class _SkalFocusState extends State<_SkalFocus> {
  final FocusNode _node = FocusNode(debugLabel: 'skal onKey');

  @override
  void dispose() {
    _node.dispose();
    super.dispose();
  }

  KeyEventResult _onKeyEvent(FocusNode _, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    // A bare modifier press is its own KeyDownEvent — skip it so `onKey`
    // doesn't emit a junk "meta+meta left" combo. The modifier still
    // rides the NEXT real key via `hk` below.
    if (_modifierKeys.contains(event.logicalKey)) {
      return KeyEventResult.ignored;
    }
    final hk = HardwareKeyboard.instance;
    final parts = <String>[];
    if (hk.isControlPressed) parts.add('ctrl');
    if (hk.isShiftPressed) parts.add('shift');
    if (hk.isAltPressed) parts.add('alt');
    if (hk.isMetaPressed) parts.add('meta');
    final label = event.logicalKey.keyLabel;
    parts.add(label.isEmpty ? 'unknown' : label.toLowerCase());
    widget.bridge
        .dispatchEventStr(widget.handlerId, parts.join('+'), eventKind: evKey);
    // `ignored` — onKey observes the key, it doesn't consume it.
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Focus(
      focusNode: _node,
      autofocus: true,
      onKeyEvent: _onKeyEvent,
      child: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: (_) => _node.requestFocus(),
        child: widget.child,
      ),
    );
  }
}

/// Wrap [child] in a [GestureDetector] when the node has any gesture
/// handler bound — taps (`onTap` / `onLongPress` / `onDoubleTap`),
/// pan/drag (`onPan*`), pinch-scale (`onScale*`), or the `draggable`
/// fast-path. Returns [child] untouched when none are bound — the
/// common case pays for no extra widget.
///
/// `behavior: opaque` so the whole node area is tappable even when it
/// paints nothing (a transparent `<box onTap=…>` still receives taps).
///
/// Recognizer arbitration: a node binds ONE motion family — scale OR
/// pan/drag — never both (a pinch and a pan on the same node would be
/// ambiguous, and `GestureDetector` even asserts against the combo).
/// When both are bound, scale wins and the pan handlers are dropped.
///
/// `draggable` is the performance-first path: instead of shipping a
/// `(dx, dy)` event every drag frame, the host mutates the node's
/// own translation hot props and fires `hot.notify()`. The box
/// follows the finger with ZERO per-frame bridge traffic — the same
/// "host owns the motion" contract as `animate`. JS only hears
/// `onPanStart` / `onPanEnd` (when bound); `onPanUpdate` is skipped.
Widget _applyGestures(NodeState n, SkalBridge bridge, Widget child) {
  final tap = n.onClickHandlerId;
  final longPress = n.onLongPressHandlerId;
  final doubleTap = n.onDoubleTapHandlerId;
  final panStart = n.onPanStartHandlerId;
  final panUpdate = n.onPanUpdateHandlerId;
  final panEnd = n.onPanEndHandlerId;
  final scaleStart = n.onScaleStartHandlerId;
  final scaleUpdate = n.onScaleUpdateHandlerId;
  final scaleEnd = n.onScaleEndHandlerId;
  final draggable = n.getPropU32(propDraggable, 0);

  final hasScale = scaleStart != 0 || scaleUpdate != 0 || scaleEnd != 0;
  final hasPan =
      panStart != 0 || panUpdate != 0 || panEnd != 0 || draggable != 0;

  if (tap == 0 && longPress == 0 && doubleTap == 0 && !hasScale && !hasPan) {
    return child;
  }

  // Tap-family callbacks. Each dispatches under its own event kind so
  // the wire event is correctly labelled (the JS drain routes by
  // handlerId, but a mislabelled kind would trap any future consumer).
  final onTap = tap != 0 ? () => bridge.dispatchEvent(tap) : null;
  final onLongPress = longPress != 0
      ? () => bridge.dispatchEvent(longPress, eventKind: evLongPress)
      : null;
  final onDoubleTap = doubleTap != 0
      ? () => bridge.dispatchEvent(doubleTap, eventKind: evDoubleTap)
      : null;

  // Scale takes the recognizer slot when bound (pan handlers dropped).
  if (hasScale) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      onLongPress: onLongPress,
      onDoubleTap: onDoubleTap,
      onScaleStart: scaleStart != 0
          ? (_) => bridge.dispatchEvent(scaleStart, eventKind: evScaleStart)
          : null,
      // Cumulative scale factor + rotation (radians) — one vec2 event
      // per pointer-move frame, no reply-heap traffic.
      onScaleUpdate: scaleUpdate != 0
          ? (d) => bridge.dispatchEventVec2(
              scaleUpdate, d.scale, d.rotation,
              eventKind: evScaleUpdate)
          : null,
      onScaleEnd: scaleEnd != 0
          ? (_) => bridge.dispatchEvent(scaleEnd, eventKind: evScaleEnd)
          : null,
      child: child,
    );
  }

  if (!hasPan) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      onLongPress: onLongPress,
      onDoubleTap: onDoubleTap,
      child: child,
    );
  }

  // Pan / drag — driven by a MULTI-drag recognizer, deliberately NOT
  // by GestureDetector's onPan* (a PanGestureRecognizer).
  //
  // A PanGestureRecognizer needs 2× touch-slop of movement before it
  // claims the gesture arena. An ancestor ScrollView's drag recognizer
  // claims at 1× slop — so it ALWAYS wins the race, and a dragged box
  // inside any scroll view would just twitch a few pixels before the
  // scroll stole the gesture. The MultiDrag recognizers claim at 1×
  // slop too: they tie the scroll and then win on hit-test depth (the
  // box is deeper in the tree than the Scrollable). This is the exact
  // recognizer family Flutter's own `Draggable` uses to work inside a
  // `ListView`. `draggable` 2 / 3 additionally lock to one axis.
  final release = n.getPropU32(propRelease, 0);

  Widget out;
  if (draggable != 0 && release != 0) {
    // Release physics — the box keeps moving (glide / spring-back)
    // after the pointer lifts. `_MomentumDraggable` owns its own
    // recognizer plus the post-release simulation controllers.
    out = _MomentumDraggable(
      node: n,
      bridge: bridge,
      draggable: draggable,
      release: release,
      panStart: panStart,
      panEnd: panEnd,
      child: child,
    );
  } else {
    Drag? handleDragStart(Offset position) {
      if (panStart != 0) {
        bridge.dispatchEventVec2(panStart, position.dx, position.dy,
            eventKind: evPanStart);
      }
      return _SkalDrag(
        node: n,
        bridge: bridge,
        draggable: draggable,
        panUpdate: panUpdate,
        panEnd: panEnd,
      );
    }

    final (dragType, dragFactory) = _dragRecognizer(draggable, handleDragStart);
    out = RawGestureDetector(
      behavior: HitTestBehavior.opaque,
      gestures: <Type, GestureRecognizerFactory>{dragType: dragFactory},
      child: child,
    );
  }
  // Taps live in their own GestureDetector — a tap recognizer and a
  // drag recognizer coexist fine in the arena (tap wins with no move,
  // drag wins on movement). The drag detector is the inner/deeper one
  // so its recognizer enters the arena first.
  if (tap != 0 || longPress != 0 || doubleTap != 0) {
    out = GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      onLongPress: onLongPress,
      onDoubleTap: onDoubleTap,
      child: out,
    );
  }
  return out;
}

/// Builds the MultiDrag recognizer for a `draggable` axis (2 →
/// horizontal-only, 3 → vertical-only, else free / plain pan). Returns
/// the recognizer's runtime [Type] — the `RawGestureDetector` map key —
/// paired with its factory. Shared by [_applyGestures] and
/// [_MomentumDraggable] so both pick the recognizer the same way.
(Type, GestureRecognizerFactory) _dragRecognizer(
    int draggable, GestureMultiDragStartCallback onStart) {
  if (draggable == 2) {
    return (
      HorizontalMultiDragGestureRecognizer,
      GestureRecognizerFactoryWithHandlers<HorizontalMultiDragGestureRecognizer>(
        HorizontalMultiDragGestureRecognizer.new,
        (r) => r.onStart = onStart,
      ),
    );
  }
  if (draggable == 3) {
    return (
      VerticalMultiDragGestureRecognizer,
      GestureRecognizerFactoryWithHandlers<VerticalMultiDragGestureRecognizer>(
        VerticalMultiDragGestureRecognizer.new,
        (r) => r.onStart = onStart,
      ),
    );
  }
  return (
    ImmediateMultiDragGestureRecognizer,
    GestureRecognizerFactoryWithHandlers<ImmediateMultiDragGestureRecognizer>(
      ImmediateMultiDragGestureRecognizer.new,
      (r) => r.onStart = onStart,
    ),
  );
}

/// The [Drag] sink for a Skal pan / drag gesture — one is created per
/// active pointer by the MultiDrag recognizer in [_applyGestures].
///
/// Two modes, picked by [draggable]:
///   • `draggable != 0` — host-driven move: each update mutates the
///     node's own translation hot props and re-composites. ZERO
///     per-frame bridge traffic; `onPanEnd` reports the final offset.
///   • `draggable == 0` — plain pan: each update ships an `onPanUpdate`
///     `(dx, dy)` event; `onPanEnd` ships the fling velocity (dp/s).
class _SkalDrag extends Drag {
  _SkalDrag({
    required this.node,
    required this.bridge,
    required this.draggable,
    required this.panUpdate,
    required this.panEnd,
    this.onMomentumEnd,
  });

  final NodeState node;
  final SkalBridge bridge;
  final int draggable;
  final int panUpdate;
  final int panEnd;

  /// When set (a `draggable` node with `release` physics), the drag's
  /// `end` hands the fling velocity here instead of dispatching
  /// `onPanEnd` — the release simulation owns the rest of the motion
  /// and fires `onPanEnd` itself once it settles. See [_MomentumDraggable].
  final void Function(double vx, double vy)? onMomentumEnd;

  @override
  void update(DragUpdateDetails details) {
    var dx = details.delta.dx;
    var dy = details.delta.dy;
    if (draggable == 2) dy = 0.0; // horizontal-only
    if (draggable == 3) dx = 0.0; // vertical-only
    if (draggable != 0) {
      // Host owns the motion — mutate translation, re-composite. No
      // op, no event.
      node.translationX += dx;
      node.translationY += dy;
      node.hot.notify();
    } else if (panUpdate != 0) {
      bridge.dispatchEventVec2(panUpdate, dx, dy, eventKind: evPanUpdate);
    }
  }

  @override
  void end(DragEndDetails details) {
    final v = details.velocity.pixelsPerSecond;
    if (onMomentumEnd != null) {
      // Release physics owns the settle — hand off the fling velocity.
      onMomentumEnd!(v.dx, v.dy);
      return;
    }
    if (panEnd != 0) {
      if (draggable != 0) {
        // Host-driven drag → report the final resting offset so JS
        // can persist the node's position.
        bridge.dispatchEventVec2(
            panEnd, node.translationX, node.translationY,
            eventKind: evPanEnd);
      } else {
        bridge.dispatchEventVec2(panEnd, v.dx, v.dy, eventKind: evPanEnd);
      }
    }
  }
}

/// Drag coefficient for `release: 'glide'` — a [FrictionSimulation]'s
/// `drag` ∈ (0,1); lower = more friction / shorter coast. 0.135 is the
/// value iOS uses for scroll deceleration, and gives a thrown box a
/// natural ~0.5–1 s glide to rest.
const double _kReleaseFrictionDrag = 0.135;

/// Spring for `release: 'springBack'` — pulls a released box home to
/// its origin; the fling velocity rides in as the spring's initial
/// velocity, so a hard throw springs back hard.
final SpringDescription _kReleaseSpring =
    SpringDescription.withDampingRatio(mass: 1, stiffness: 200, ratio: 0.7);

/// A `draggable` box with `release` physics — the host machinery for
/// post-release motion. During the drag it host-moves the node exactly
/// like the bare draggable path (a [_SkalDrag] mutating `translation`);
/// on release the gesture's fling velocity seeds a [Simulation] that
/// runs on two unbounded controllers (one per axis) until the box
/// settles, then `onPanEnd` fires with the resting offset.
///
/// Release modes (`propRelease`):
///   • 1 glide      — [FrictionSimulation]: coast and decelerate.
///   • 2 springBack — [SpringSimulation] home to the origin.
///
/// All host-side: ZERO per-frame bridge traffic during both the drag
/// and the settle — only the single `onPanEnd` crosses the bridge.
class _MomentumDraggable extends StatefulWidget {
  final NodeState node;
  final SkalBridge bridge;
  final int draggable;
  final int release;
  final int panStart;
  final int panEnd;
  final Widget child;
  const _MomentumDraggable({
    required this.node,
    required this.bridge,
    required this.draggable,
    required this.release,
    required this.panStart,
    required this.panEnd,
    required this.child,
  });

  @override
  State<_MomentumDraggable> createState() => _MomentumDraggableState();
}

class _MomentumDraggableState extends State<_MomentumDraggable>
    with TickerProviderStateMixin {
  late final AnimationController _ctrlX;
  late final AnimationController _ctrlY;
  // True between release and the box coming fully to rest.
  bool _settling = false;

  @override
  void initState() {
    super.initState();
    _ctrlX = AnimationController.unbounded(vsync: this)
      ..addListener(_tickX)
      ..addStatusListener(_onAxisStatus);
    _ctrlY = AnimationController.unbounded(vsync: this)
      ..addListener(_tickY)
      ..addStatusListener(_onAxisStatus);
  }

  @override
  void dispose() {
    _ctrlX.dispose();
    _ctrlY.dispose();
    super.dispose();
  }

  void _tickX() {
    widget.node.translationX = _ctrlX.value;
    widget.node.hot.notify();
  }

  void _tickY() {
    widget.node.translationY = _ctrlY.value;
    widget.node.hot.notify();
  }

  /// Pointer down — cancel any release simulation still running (the
  /// user re-grabbed the box mid-flight) and start a fresh host drag.
  Drag? _handleDragStart(Offset position) {
    _settling = false;
    _ctrlX.stop();
    _ctrlY.stop();
    if (widget.panStart != 0) {
      widget.bridge.dispatchEventVec2(
          widget.panStart, position.dx, position.dy, eventKind: evPanStart);
    }
    return _SkalDrag(
      node: widget.node,
      bridge: widget.bridge,
      draggable: widget.draggable,
      panUpdate: 0, // draggable host-moves; onPanUpdate is never dispatched
      panEnd: widget.panEnd,
      onMomentumEnd: _onReleased,
    );
  }

  /// The pointer lifted — seed the release simulation with the fling
  /// velocity the gesture measured and run it on both axes.
  void _onReleased(double vx, double vy) {
    final n = widget.node;
    // Honour the draggable axis lock — a horizontal- / vertical-only
    // box must not glide or spring off-axis even on a diagonal fling.
    if (widget.draggable == 2) vy = 0.0; // horizontal-only
    if (widget.draggable == 3) vx = 0.0; // vertical-only
    if (widget.release == 2) {
      // springBack — each axis springs home to the origin.
      _ctrlX.animateWith(
          SpringSimulation(_kReleaseSpring, n.translationX, 0.0, vx));
      _ctrlY.animateWith(
          SpringSimulation(_kReleaseSpring, n.translationY, 0.0, vy));
    } else {
      // glide — friction keeps the box's heading and decelerates it.
      _ctrlX.animateWith(
          FrictionSimulation(_kReleaseFrictionDrag, n.translationX, vx));
      _ctrlY.animateWith(
          FrictionSimulation(_kReleaseFrictionDrag, n.translationY, vy));
    }
    _settling = true;
  }

  /// An axis controller changed status. Once the release is settling
  /// AND both axes have come to rest, the motion is done — report the
  /// final resting offset to JS.
  void _onAxisStatus(AnimationStatus _) {
    if (!_settling || _ctrlX.isAnimating || _ctrlY.isAnimating) return;
    _settling = false;
    if (widget.panEnd != 0) {
      widget.bridge.dispatchEventVec2(
          widget.panEnd, widget.node.translationX, widget.node.translationY,
          eventKind: evPanEnd);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (type, factory) =
        _dragRecognizer(widget.draggable, _handleDragStart);
    return RawGestureDetector(
      behavior: HitTestBehavior.opaque,
      gestures: <Type, GestureRecognizerFactory>{type: factory},
      child: widget.child,
    );
  }
}

/// Hot-prop layer dispatcher. Returns the cheap stateless
/// [_StaticHotLayer] for the common (non-animated) node, or the
/// stateful [_AnimatedHotLayer] when the node has an `animate` spec
/// (`propAnimDuration > 0`). Picking per-node means a 5000-row list
/// pays for an `AnimationController` only on the rows that animate.
Widget _hotLayer({required NodeState node, required Widget child}) {
  // `spring` (real SpringSimulation physics) takes precedence over the
  // curve-based `animate` — a node opting into physics gets physics.
  if (node.getPropU32(propSpring, 0) > 0) {
    return _SpringHotLayer(node: node, child: child);
  }
  if (node.getPropU32(propAnimDuration, 0) > 0) {
    return _AnimatedHotLayer(node: node, child: child);
  }
  return _StaticHotLayer(node: node, child: child);
}

/// `propSpring` enum → a real [SpringDescription]. The presets pick a
/// mass / stiffness / damping-ratio: ratio 1.0 is critically damped
/// (no overshoot), below 1.0 underdamped (overshoots + wobbles), above
/// 1.0 overdamped (slow, no overshoot). ANIMATION.md §13.
SpringDescription _springDescFor(int v) {
  switch (v) {
    case 1: // gentle — a soft, overshoot-free settle
      return SpringDescription.withDampingRatio(
          mass: 1, stiffness: 120, ratio: 1.0);
    case 2: // bouncy — underdamped: overshoots the target and wobbles in
      return SpringDescription.withDampingRatio(
          mass: 1, stiffness: 180, ratio: 0.55);
    case 3: // stiff — fast and crisp, a hair of overshoot
      return SpringDescription.withDampingRatio(
          mass: 1, stiffness: 500, ratio: 0.9);
    default:
      return SpringDescription.withDampingRatio(
          mass: 1, stiffness: 150, ratio: 0.8);
  }
}

/// True when [n] carries a gesture that *moves the node itself* — a
/// pan / scale handler or the `draggable` fast-path. Such a node needs
/// a STRUCTURALLY STABLE hot layer (see [_StaticHotLayer]): its own
/// gesture mutates `translation` / `scale`, and if the `Transform`
/// were conditionally inserted only once the value goes non-identity,
/// that insertion would re-parent — and so destroy — the live gesture
/// recognizer mid-drag. Tap-family handlers don't self-transform, so
/// they don't force the stable layer.
bool _selfTransformingGesture(NodeState n) =>
    n.onPanStartHandlerId != 0 ||
    n.onPanUpdateHandlerId != 0 ||
    n.onPanEndHandlerId != 0 ||
    n.onScaleStartHandlerId != 0 ||
    n.onScaleUpdateHandlerId != 0 ||
    n.onScaleEndHandlerId != 0 ||
    n.getPropU32(propDraggable, 0) != 0;

/// The non-animated hot layer — a [ListenableBuilder] on the node's
/// `hot` notifier that snaps `Transform` / `Opacity` to the latest
/// values. One rebuild per drain, zero work in the surrounding tree.
///
/// Tree-structure stability: for most nodes the `Transform` / `Opacity`
/// wrappers are added only when actually needed (the common static node
/// pays for neither). But for a node whose OWN gesture drives its
/// transform — a draggable / pan / scale node — the wrappers are
/// ALWAYS present (identity when idle). Inserting a `Transform` the
/// moment translation first goes non-zero would re-parent the gesture
/// detector below it and dispose the in-flight recognizer, killing the
/// drag after one frame. Keeping the structure fixed avoids that.
class _StaticHotLayer extends StatelessWidget {
  final NodeState node;
  final Widget child;
  const _StaticHotLayer({required this.node, required this.child});

  @override
  Widget build(BuildContext context) {
    final stable = _selfTransformingGesture(node);
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
        if (stable || tx != 0 || ty != 0 || sx != 1 || sy != 1 || rz != 0) {
          final m = Matrix4.identity()
            ..translateByDouble(tx, ty, 0.0, 1.0)
            ..rotateZ(rz)
            ..scaleByDouble(sx, sy, 1.0, 1.0);
          // alignment: center so scale + rotation pivot on the node's
          // middle (a pulse / spin reads right); translation in the
          // matrix is still absolute.
          w = Transform(transform: m, alignment: Alignment.center, child: w);
        }
        if (stable || op < 1.0) {
          w = Opacity(opacity: op.clamp(0.0, 1.0), child: w);
        }
        return w;
      },
      child: child,
    );
  }
}

/// `propAnimCurve` wire enum → Flutter [Curve].
Curve _curveFor(int v) {
  switch (v) {
    case 1: return Curves.easeIn;
    case 2: return Curves.easeOut;
    case 3: return Curves.easeInOut;
    case 4: return Curves.bounceOut;
    case 5: return Curves.elasticOut;
    case 6: return Curves.fastOutSlowIn;
    default: return Curves.linear;
  }
}

double _lerp(double a, double b, double t) => a + (b - a) * t;

/// `propAnimSpring` enum → a spring-like [Curve]. ANIMATION.md §10.
/// Skal expresses physics motion as curves on the existing bounded
/// controller rather than a `SpringSimulation` + unbounded controller —
/// the curve form is allocation-identical to a normal tween and
/// covers the UI cases (settle, bounce) without gesture velocity.
Curve _springCurveFor(int v) {
  switch (v) {
    case 1: return Curves.easeOutCubic;  // gentle — soft settle
    case 2: return Curves.elasticOut;    // bouncy — overshoot + wobble
    case 3: return Curves.easeOutExpo;   // stiff  — fast, crisp stop
    default: return Curves.easeInOut;
  }
}

/// Resolve a node's animation curve — a non-zero `propAnimSpring`
/// (physics preset) overrides the plain `propAnimCurve` enum.
Curve _resolveCurve(NodeState n) {
  final spring = n.getPropU32(propAnimSpring, 0);
  if (spring != 0) return _springCurveFor(spring);
  return _curveFor(n.getPropU32(propAnimCurve, 0));
}

/// The animated hot layer — FLUTTER_JS_COMPONENTS.md §10.3, Phase 1.
///
/// When the node carries an `animate` spec, a hot-prop change tweens
/// instead of snapping. The tween runs entirely Dart-side on a single
/// `AnimationController` — zero per-frame bridge traffic. This one
/// widget subsumes `AnimatedOpacity` / `AnimatedScale` /
/// `AnimatedSlide` and the `Fade|Scale|Slide|Rotation Transition`
/// family.
class _AnimatedHotLayer extends StatefulWidget {
  final NodeState node;
  final Widget child;
  const _AnimatedHotLayer({required this.node, required this.child});

  @override
  State<_AnimatedHotLayer> createState() => _AnimatedHotLayerState();
}

class _AnimatedHotLayerState extends State<_AnimatedHotLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  Curve _curve = Curves.linear;
  // Pending `animate.delay` timer — held so a re-entrant _onHot can
  // cancel it instead of stacking a second forward().
  Timer? _delayTimer;

  // True while a looping (repeat / loop) animation is running — so a
  // runtime toggle of `animate.repeat` can start / stop it.
  bool _wasRepeating = false;

  // Currently-rendered values.
  double _op = 1, _tx = 0, _ty = 0, _sx = 1, _sy = 1, _rz = 0;
  // Tween endpoints (from → to).
  double _fOp = 1, _fTx = 0, _fTy = 0, _fSx = 1, _fSy = 1, _fRz = 0;
  double _tOp = 1, _tTx = 0, _tTy = 0, _tSx = 1, _tSy = 1, _tRz = 0;

  @override
  void initState() {
    super.initState();
    final n = widget.node;
    _op = _fOp = _tOp = n.opacity;
    _tx = _fTx = _tTx = n.translationX;
    _ty = _fTy = _tTy = n.translationY;
    _sx = _fSx = _tSx = n.scaleX;
    _sy = _fSy = _tSy = n.scaleY;
    _rz = _fRz = _tRz = n.rotationZ;
    _ctrl = AnimationController(vsync: this)..addListener(_onTick);
    n.hot.addListener(_onHot);
    // ANIMATION.md §5 — a looping animation (repeat / loop) starts on
    // mount; its endpoints are the prop identity defaults ↔ the set
    // values, so a static `scaleX={1.15} repeat` pulses even though no
    // hot-prop change ever arrives.
    if (n.getPropU32(propAnimRepeat, 0) != 0) {
      _wasRepeating = true;
      _startRepeat();
    }
  }

  @override
  void dispose() {
    widget.node.hot.removeListener(_onHot);
    _delayTimer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  /// A hot-prop write landed — capture new targets and start the
  /// tween from whatever is on screen right now.
  void _onHot() {
    final n = widget.node;
    if (n.getPropU32(propAnimRepeat, 0) != 0) {
      // A looping animation owns its own cycle — re-target and keep
      // running rather than firing a one-shot tween.
      _startRepeat();
      return;
    }
    final nOp = n.opacity,
        nTx = n.translationX,
        nTy = n.translationY,
        nSx = n.scaleX,
        nSy = n.scaleY,
        nRz = n.rotationZ;
    if (nOp == _tOp &&
        nTx == _tTx &&
        nTy == _tTy &&
        nSx == _tSx &&
        nSy == _tSy &&
        nRz == _tRz) {
      return; // nothing actually changed
    }
    _fOp = _op;
    _fTx = _tx;
    _fTy = _ty;
    _fSx = _sx;
    _fSy = _sy;
    _fRz = _rz;
    _tOp = nOp;
    _tTx = nTx;
    _tTy = nTy;
    _tSx = nSx;
    _tSy = nSy;
    _tRz = nRz;
    final durMs = n.getPropU32(propAnimDuration, 0);
    final delayMs = n.getPropU32(propAnimDelay, 0);
    _curve = _resolveCurve(n);
    _ctrl
      ..duration = Duration(milliseconds: durMs <= 0 ? 1 : durMs)
      ..reset();
    // Supersede any delay still pending from a previous _onHot.
    _delayTimer?.cancel();
    if (delayMs > 0) {
      _delayTimer = Timer(Duration(milliseconds: delayMs), () {
        if (mounted) _ctrl.forward();
      });
    } else {
      _ctrl.forward();
    }
  }

  /// Begin (or restart) a looping animation — ANIMATION.md §5.
  /// Oscillates each hot prop between its identity default and the
  /// node's set value; `reverse` ping-pongs, `loop` caps the cycles.
  void _startRepeat() {
    final n = widget.node;
    _fOp = 1;
    _fTx = 0;
    _fTy = 0;
    _fSx = 1;
    _fSy = 1;
    _fRz = 0;
    _tOp = n.opacity;
    _tTx = n.translationX;
    _tTy = n.translationY;
    _tSx = n.scaleX;
    _tSy = n.scaleY;
    _tRz = n.rotationZ;
    final durMs = n.getPropU32(propAnimDuration, 0);
    final loop = n.getPropU32(propAnimLoop, 0);
    _curve = _resolveCurve(n);
    _delayTimer?.cancel();
    _ctrl
      ..duration = Duration(milliseconds: durMs <= 0 ? 1 : durMs)
      ..reset()
      ..repeat(
        reverse: n.getPropU32(propAnimReverse, 0) != 0,
        count: loop > 0 ? loop : null,
      );
  }

  @override
  void didUpdateWidget(_AnimatedHotLayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    // `animate.repeat` toggled at runtime (a cold-prop change rebuilds
    // this layer) — start or stop the loop accordingly.
    final repeating = widget.node.getPropU32(propAnimRepeat, 0) != 0;
    if (repeating && !_wasRepeating) {
      _wasRepeating = true;
      _startRepeat();
    } else if (!repeating && _wasRepeating) {
      _wasRepeating = false;
      _ctrl.stop();
    }
  }

  void _onTick() {
    final t = _curve.transform(_ctrl.value);
    setState(() {
      _op = _lerp(_fOp, _tOp, t);
      _tx = _lerp(_fTx, _tTx, t);
      _ty = _lerp(_fTy, _tTy, t);
      _sx = _lerp(_fSx, _tSx, t);
      _sy = _lerp(_fSy, _tSy, t);
      _rz = _lerp(_fRz, _tRz, t);
    });
  }

  @override
  Widget build(BuildContext context) {
    // RepaintBoundary gives the (memoized) child its own retained
    // layer: the animating Transform / Opacity above just RE-COMPOSITE
    // that layer each frame — the child's `paint()` (its recorded draw
    // commands) is NOT re-run. Without it, an animating Opacity /
    // Transform repaints the whole child subtree every frame — the
    // exact pitfall Flutter's perf docs flag as "avoid Opacity in
    // animations". The node opted into `animate`, so the one permanent
    // boundary layer is the right trade.
    Widget w = RepaintBoundary(child: widget.child);
    // Keep the wrapper structure fixed for a node whose own gesture
    // drives its transform — see [_StaticHotLayer]'s docstring. Without
    // this, the first non-identity frame would insert a `Transform` and
    // re-parent (destroy) the live gesture recognizer below it.
    final stable = _selfTransformingGesture(widget.node);
    if (stable || _tx != 0 || _ty != 0 || _sx != 1 || _sy != 1 || _rz != 0) {
      final m = Matrix4.identity()
        ..translateByDouble(_tx, _ty, 0.0, 1.0)
        ..rotateZ(_rz)
        ..scaleByDouble(_sx, _sy, 1.0, 1.0);
      w = Transform(transform: m, alignment: Alignment.center, child: w);
    }
    if (stable || _op < 1.0) {
      w = Opacity(opacity: _op.clamp(0.0, 1.0), child: w);
    }
    return w;
  }
}

/// The physics hot layer — `<box spring>`. Drives the node's hot props
/// (opacity / transform) with a real [SpringSimulation] instead of a
/// curve. Its edge over `animate.spring`'s curves: when a hot prop is
/// RETARGETED mid-flight, the spring continues from the value AND
/// velocity it currently has — motion stays continuous, no dead-stop
/// restart that a curve would force.
///
/// One unbounded [AnimationController] runs the spring host-side; its
/// value is the 0→1 progress (overshooting past 1 during the bounce)
/// and every hot prop lerps by it. Zero per-frame bridge traffic — the
/// same contract as `_AnimatedHotLayer`. ANIMATION.md §13.
class _SpringHotLayer extends StatefulWidget {
  final NodeState node;
  final Widget child;
  const _SpringHotLayer({required this.node, required this.child});

  @override
  State<_SpringHotLayer> createState() => _SpringHotLayerState();
}

class _SpringHotLayerState extends State<_SpringHotLayer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  // Currently-rendered values.
  double _op = 1, _tx = 0, _ty = 0, _sx = 1, _sy = 1, _rz = 0;
  // Spring endpoints (from → to); the controller's value lerps between.
  double _fOp = 1, _fTx = 0, _fTy = 0, _fSx = 1, _fSy = 1, _fRz = 0;
  double _tOp = 1, _tTx = 0, _tTy = 0, _tSx = 1, _tSy = 1, _tRz = 0;

  @override
  void initState() {
    super.initState();
    final n = widget.node;
    _op = _fOp = _tOp = n.opacity;
    _tx = _fTx = _tTx = n.translationX;
    _ty = _fTy = _tTy = n.translationY;
    _sx = _fSx = _tSx = n.scaleX;
    _sy = _fSy = _tSy = n.scaleY;
    _rz = _fRz = _tRz = n.rotationZ;
    // Unbounded — a spring overshoots past 1.0 during the bounce.
    // Starts settled at 1.0 (displayed == target), so no animation runs
    // until a hot-prop write actually retargets it.
    _ctrl = AnimationController.unbounded(value: 1.0, vsync: this)
      ..addListener(_onTick);
    n.hot.addListener(_onHot);
  }

  @override
  void dispose() {
    widget.node.hot.removeListener(_onHot);
    _ctrl.dispose();
    super.dispose();
  }

  /// A hot-prop write landed — rebase the spring on whatever is on
  /// screen right now, carrying the controller's current velocity so
  /// an interrupted spring keeps its momentum instead of restarting
  /// from a dead stop.
  void _onHot() {
    final n = widget.node;
    final nOp = n.opacity,
        nTx = n.translationX,
        nTy = n.translationY,
        nSx = n.scaleX,
        nSy = n.scaleY,
        nRz = n.rotationZ;
    if (nOp == _tOp &&
        nTx == _tTx &&
        nTy == _tTy &&
        nSx == _tSx &&
        nSy == _tSy &&
        nRz == _tRz) {
      return; // nothing actually changed
    }
    _fOp = _op;
    _fTx = _tx;
    _fTy = _ty;
    _fSx = _sx;
    _fSy = _sy;
    _fRz = _rz;
    _tOp = nOp;
    _tTx = nTx;
    _tTy = nTy;
    _tSx = nSx;
    _tSy = nSy;
    _tRz = nRz;
    // Carry the in-flight progress velocity into the new spring — this
    // is what makes a retargeted spring continuous. `velocity` already
    // reads 0 when the controller is idle.
    final spring = _springDescFor(n.getPropU32(propSpring, 0));
    _ctrl.animateWith(SpringSimulation(spring, 0.0, 1.0, _ctrl.velocity));
  }

  void _onTick() {
    final t = _ctrl.value;
    setState(() {
      _op = _lerp(_fOp, _tOp, t);
      _tx = _lerp(_fTx, _tTx, t);
      _ty = _lerp(_fTy, _tTy, t);
      _sx = _lerp(_fSx, _tSx, t);
      _sy = _lerp(_fSy, _tSy, t);
      _rz = _lerp(_fRz, _tRz, t);
    });
  }

  @override
  Widget build(BuildContext context) {
    // RepaintBoundary: the spring re-composites this retained layer
    // each frame without re-running the child's paint — see the same
    // note on `_AnimatedHotLayer`. The Transform / Opacity wrappers are
    // unconditional: a spring node is animating its transform by
    // definition, and a fixed structure is what keeps any gesture
    // recognizer below from being re-parented mid-spring.
    Widget w = RepaintBoundary(child: widget.child);
    final m = Matrix4.identity()
      ..translateByDouble(_tx, _ty, 0.0, 1.0)
      ..rotateZ(_rz)
      ..scaleByDouble(_sx, _sy, 1.0, 1.0);
    w = Transform(transform: m, alignment: Alignment.center, child: w);
    // Opacity at 1.0 is free — RenderOpacity skips its layer at alpha 255.
    w = Opacity(opacity: _op.clamp(0.0, 1.0), child: w);
    return w;
  }
}

/// Stateful host for `<textInput>` — owns the `TextEditingController`
/// and `FocusNode` so they survive the cold rebuilds the memoizing
/// layer drives. The text is CONTROLLED when the JSX sets `value`:
/// external changes are pushed into the controller (caret parked at
/// the end). That push is a no-op when the change is just JS echoing
/// a keystroke back, so typing never jumps. Omitting `value` leaves
/// the field uncontrolled — the user's text is never overwritten.
class _SkalTextField extends StatefulWidget {
  final NodeState node;
  final SkalBridge bridge;
  const _SkalTextField({required this.node, required this.bridge});

  @override
  State<_SkalTextField> createState() => _SkalTextFieldState();
}

class _SkalTextFieldState extends State<_SkalTextField> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _controller =
        TextEditingController(text: widget.node.getPropStr(propValue) ?? '');
    _focusNode = FocusNode();
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  /// Controlled sync — push an externally-set `value` into the
  /// controller. Done here (not in build) so the controller — a
  /// Listenable — is never mutated mid-build. The memoizing layer
  /// rebuilds this widget on every cold drain, so this fires whenever
  /// `value` could have changed. A null `value` prop means the field
  /// is uncontrolled: the user's text is left alone. The caret is
  /// parked at the end; that push is a no-op when the change is just
  /// JS echoing a keystroke back, so typing never jumps.
  @override
  void didUpdateWidget(_SkalTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    final ext = widget.node.getPropStr(propValue);
    if (ext != null && ext != _controller.text) {
      _controller.value = TextEditingValue(
        text: ext,
        selection: TextSelection.collapsed(offset: ext.length),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.node;

    final placeholder = n.getPropStr(propPlaceholder);
    final obscure = n.getPropU32(propSecureEntry, 0) != 0;
    final enabled = n.getPropU32(propEnabled, 1) != 0;
    final keyboard = _keyboardTypeFor(n.getPropU32(propKeyboardType, 0));
    final fontSize = n.getPropU32(propFontSize, 14);
    final multiline = keyboard == TextInputType.multiline && !obscure;
    final changeHandler = n.onChangeHandlerId;
    final submitHandler = n.onSubmitHandlerId;
    final bridge = widget.bridge;

    final void Function(String)? onChanged = changeHandler != 0
        ? (v) => bridge.dispatchEventStr(changeHandler, v)
        : null;
    final void Function(String)? onSubmitted = submitHandler != 0
        ? (v) => bridge.dispatchEventStr(submitHandler, v, eventKind: evSubmit)
        : null;

    if (bridge.isCupertino) {
      return CupertinoTextField(
        controller: _controller,
        focusNode: _focusNode,
        enabled: enabled,
        obscureText: obscure,
        keyboardType: keyboard,
        maxLines: multiline ? null : 1,
        style: TextStyle(fontSize: fontSize.toDouble()),
        placeholder: placeholder,
        onChanged: onChanged,
        onSubmitted: onSubmitted,
      );
    }
    return TextField(
      controller: _controller,
      focusNode: _focusNode,
      enabled: enabled,
      obscureText: obscure,
      keyboardType: keyboard,
      maxLines: multiline ? null : 1,
      style: TextStyle(fontSize: fontSize.toDouble()),
      decoration: InputDecoration(
        hintText: placeholder,
        isDense: true,
        border: const OutlineInputBorder(),
      ),
      onChanged: onChanged,
      onSubmitted: onSubmitted,
    );
  }
}

/// Stateful host for `<slider>` — the perf fix for controlled-slider
/// drag latency (FLUTTER_JS_COMPONENTS.md performance note).
///
/// A controlled slider that round-trips every drag delta to JS and
/// back would make the thumb lag the finger by a frame and flood the
/// bridge. Instead: while a drag is in progress this widget owns the
/// displayed value locally (`_dragValue`) so the thumb is perfectly
/// smooth; JS still receives every `onChange`, so app logic and state
/// stay in sync. On drag end the local value is dropped and the
/// slider is fully controlled by the `value` prop again — at release
/// the finger is ~stationary, so that handoff is seamless.
class _SkalSlider extends StatefulWidget {
  final NodeState node;
  final SkalBridge bridge;
  const _SkalSlider({required this.node, required this.bridge});

  @override
  State<_SkalSlider> createState() => _SkalSliderState();
}

class _SkalSliderState extends State<_SkalSlider> {
  // Non-null only mid-drag — the live finger position. Takes
  // precedence over the (one-frame-late) prop echo while dragging.
  double? _dragValue;

  @override
  Widget build(BuildContext context) {
    final n = widget.node;
    final bridge = widget.bridge;
    final min = n.getPropF32(propSliderMin, 0.0);
    final rawMax = n.getPropF32(propSliderMax, 1.0);
    // Slider asserts a strictly positive range — guard a bad max.
    final max = rawMax > min ? rawMax : min + 1.0;
    final propValue =
        n.getPropF32(propSliderValue, min).clamp(min, max).toDouble();
    final value = (_dragValue ?? propValue).clamp(min, max).toDouble();
    final enabled = n.getPropU32(propEnabled, 1) != 0;
    final handler = n.onChangeHandlerId;
    final interactive = enabled && handler != 0;

    void onChanged(double v) {
      setState(() => _dragValue = v); // smooth local tracking
      bridge.dispatchEventDouble(handler, v); // JS still hears it
    }

    void onChangeEnd(double v) {
      bridge.dispatchEventDouble(handler, v);
      setState(() => _dragValue = null); // hand control back to `value`
    }

    if (bridge.isCupertino) {
      return CupertinoSlider(
        value: value,
        min: min,
        max: max,
        onChanged: interactive ? onChanged : null,
        onChangeEnd: interactive ? onChangeEnd : null,
      );
    }
    return Slider(
      value: value,
      min: min,
      max: max,
      onChanged: interactive ? onChanged : null,
      onChangeEnd: interactive ? onChangeEnd : null,
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
  inner = _applyGestures(n, bridge, inner);
  inner = _applyHover(n, bridge, inner);
  inner = _applyFocus(n, bridge, inner);
  return _hotLayer(node: n, child: inner);
}

/// Overlapping-children container — `<stack>` → Flutter `Stack`.
///
/// Each child whose node carries any of top/right/bottom/left is
/// wrapped in a [Positioned]; children with none are left as plain
/// stack children (laid out at the top-start corner). The bridge
/// re-dirties this node when a child's positioning prop changes (see
/// `opSetPropU32` in bridge.dart), so the wrap stays current.
Widget _buildStack(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);

  final out = <Widget>[];
  for (final id in n.childIds) {
    Widget child = SkalNode(
      nodeId: id,
      bridge: bridge,
      key: ValueKey<int>(id),
    );
    final childNode = bridge.nodes[id];
    if (childNode != null) {
      final top = childNode.getPropU32(propTop, kNoValue);
      final right = childNode.getPropU32(propRight, kNoValue);
      final bottom = childNode.getPropU32(propBottom, kNoValue);
      final left = childNode.getPropU32(propLeft, kNoValue);
      if (top != kNoValue ||
          right != kNoValue ||
          bottom != kNoValue ||
          left != kNoValue) {
        child = Positioned(
          key: ValueKey<int>(id),
          top: top != kNoValue ? top.toDouble() : null,
          right: right != kNoValue ? right.toDouble() : null,
          bottom: bottom != kNoValue ? bottom.toDouble() : null,
          left: left != kNoValue ? left.toDouble() : null,
          child: child,
        );
      }
    }
    out.add(child);
  }

  Widget inner =
      out.isEmpty ? const SizedBox.shrink() : Stack(children: out);

  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  inner = _applyGestures(n, bridge, inner);
  inner = _applyHover(n, bridge, inner);
  inner = _applyFocus(n, bridge, inner);
  return _hotLayer(node: n, child: inner);
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
  return _hotLayer(node: n, child: inner);
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
  final axis = _axisFor(n.getPropU32(propAxis, 0));
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  // Builder mode (`count` + `renderItem` on the JSX side): rows are
  // pulled on demand through evRowRequest and live in the sparse
  // `builderRows` map — `childCount` stays 0. Children mode otherwise.
  final builderCount = n.props[propItemCount];
  final isBuilder = builderCount != null && n.onRowRequestHandlerId != 0;
  final count = isBuilder ? builderCount : n.childCount;

  // Outer Padding to match the default 16dp content padding column has,
  // since DecoratedBox-via-_applyColdVisual would inset bg inside any
  // padding we apply. ListView's own padding param works fine because
  // it doesn't fight the scroll viewport's content extent.
  final pad = _paddingFor(n, 16);

  // With pull-to-refresh on, force always-scrollable physics so the
  // RefreshIndicator can be pulled even when the rows don't fill the
  // viewport (a plain ListView won't overscroll a short list).
  final ScrollPhysics? physics = n.onRefreshHandlerId != 0
      ? const AlwaysScrollableScrollPhysics()
      : null;
  ListView buildList(ScrollController? c) => ListView.builder(
        controller: c,
        scrollDirection: axis,
        padding: pad,
        physics: physics,
        // For interspersed-gap rendering we double the slot count and
        // alternate: even = real child, odd = gap. Cheaper than building
        // a Column-per-row with gap inside. The gap box runs along the
        // scroll axis.
        itemCount: count == 0 ? 0 : (count * 2 - 1),
        itemBuilder: (_, i) {
          if (i.isOdd) {
            return axis == Axis.horizontal
                ? SizedBox(width: gap.toDouble())
                : SizedBox(height: gap.toDouble());
          }
          final row = i ~/ 2;
          if (isBuilder) return _buildBuilderRow(n, bridge, row, axis);
          // O(1) on list-backed ListChildList for the visible window.
          final childId = n.childAt(row);
          return SkalNode(
            nodeId: childId,
            bridge: bridge,
            key: ValueKey<int>(childId),
          );
        },
      );

  Widget inner = n.getPropU32(propScrollbar, 0) != 0
      ? _SkalScrollbar(builder: buildList)
      : buildList(null);

  // Pull-to-refresh — wrap the ListView itself so the RefreshIndicator
  // finds a Scrollable directly under it.
  inner = _withRefresh(n, bridge, inner);

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

  // A horizontal list needs a bounded cross-axis (height); a vertical
  // one is usually parent-bounded — both honor an explicit width/height
  // when set, and `kNoValue` leaves the scroller unconstrained.
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// One slot of a builder-mode `<listView>`: the materialized row when
/// JS has delivered it, else an extent-correct placeholder plus a row
/// request. Placeholders reuse the row's last measured extent when
/// scrolling back through evicted territory (no jumping); never-seen
/// rows use a constant estimate that Flutter's scroll correction absorbs.
Widget _buildBuilderRow(NodeState n, SkalBridge bridge, int row, Axis axis) {
  final childId = n.builderRows?[row];
  if (childId == null) {
    _noteMissingRow(n, bridge, row);
    final extent = n.rowExtents?[row] ?? _kRowExtentEstimate;
    return axis == Axis.horizontal
        ? SizedBox(width: extent)
        : SizedBox(height: extent);
  }
  return _RowExtentProbe(
    list: n,
    index: row,
    axis: axis,
    child: SkalNode(
      nodeId: childId,
      bridge: bridge,
      key: ValueKey<int>(childId),
    ),
  );
}

/// A builder-callback slot for a codegen'd widget — Roadmap B2.
///
/// A wrapped package's `Widget Function(BuildContext, int)` param
/// (itemBuilder, separatorBuilder) can't be encoded as a prop: the
/// return type isn't `void`, so the event machinery has nothing to
/// send back. But "host asks JS to build a subtree for index i" is
/// exactly what builder-mode `<ListView>` already does, and the
/// protocol behind it — `builderRows`, `evRowRequest`, `opListSetRow` —
/// is keyed by (node, index) with nothing list-specific in it. This
/// widget is that protocol made public, so a generated adapter can
/// hand it to any indexed builder param.
///
/// **Async by construction, and that is the perf gate.** JS builds the
/// subtree on its own schedule; until it lands this renders
/// [placeholder]. A builder that fires per frame (flutter_map's
/// `tileBuilder` during a pan) would therefore show a pop-in cascade —
/// which is why B2 is opt-in per param in `skal_codegen.yaml` and never
/// applied automatically. The alternative, a synchronous JS round-trip
/// inside a Flutter build, would put JS execution on the frame's
/// critical path; see S4.
class SkalBuilderChild extends StatelessWidget {
  const SkalBuilderChild({
    super.key,
    required this.host,
    required this.index,
    required this.bridge,
    this.placeholder,
  });

  /// The generated adapter's own node — the builder rows hang off it.
  final NodeState host;

  /// Index the host widget asked for.
  final int index;

  final SkalBridge bridge;

  /// Shown until JS delivers the subtree. Defaults to a zero-size box:
  /// a generic builder has no axis, so there is no honest extent to
  /// estimate (unlike a list row, which reuses its measured height).
  final Widget? placeholder;

  /// Nodes already warned about a missing JS row-builder binding, so
  /// the diagnostic fires once per host instead of once per frame.
  static final Set<int> _warnedHosts = <int>{};

  @override
  Widget build(BuildContext context) {
    final childId = host.builderRows?[index];
    if (childId == null) {
      // Dart expects rows but JS never bound EV_ROW_REQUEST: the JS
      // side doesn't know this prop is a builder. The two known causes
      // are both build-tooling, and both used to fail as silent blank
      // rows — a vendored pre-B2 vite-plugin-skal-codegen.js that
      // never injects __SKAL_BUILDER_PROPS__, or a bundle built before
      // the prop was marked `builder: true`. Say so, once.
      if (host.onRowRequestHandlerId == 0 && kDebugMode) {
        if (_warnedHosts.add(identityHashCode(host))) {
          debugPrint(
            '[skal] builder widget "${host.customWidgetName}" is waiting '
            'for rows, but the JS side never installed a row builder — '
            'its function prop was bound as an event handler. Usually a '
            'stale vendored vite-plugin-skal-codegen.js (missing the '
            '__SKAL_BUILDER_PROPS__ injection) or a bundle built before '
            'the `builder: true` override. Update the plugin from '
            'scripts/templates/default/ and rebuild the JS bundle.',
          );
        }
      }
      _noteMissingRow(host, bridge, index);
      return placeholder ?? const SizedBox.shrink();
    }
    return SkalNode(
      nodeId: childId,
      bridge: bridge,
      key: ValueKey<int>(childId),
    );
  }
}

/// Placeholder extent for a never-measured row. Only matters for the
/// brief window before the real row lays out; Flutter corrects the
/// scroll geometry as measured extents land.
const double _kRowExtentEstimate = 48.0;

/// Record a missing builder row and schedule (at most one per frame per
/// list) an evRowRequest carrying the EXPLICIT set of missing indices
/// this frame's layout touched — never a (min,max) span, so two distant
/// misses (a kept-alive far row + the viewport) don't make JS
/// materialize the hundreds of thousands of rows between them. The set
/// is frame-scoped: a still-missing row is simply re-requested on the
/// next rebuild, so nothing gets permanently stuck.
void _noteMissingRow(NodeState n, SkalBridge bridge, int row) {
  (n.pendingRows ??= <int>{}).add(row);
  if (n.rowRequestScheduled) return;
  n.rowRequestScheduled = true;
  SchedulerBinding.instance.addPostFrameCallback((_) {
    n.rowRequestScheduled = false;
    final pending = n.pendingRows;
    n.pendingRows = null;
    // Bail if the list was removed between scheduling and now — removal
    // zeroes the handler id (see `_removeSubtree`).
    if (pending == null || pending.isEmpty || n.onRowRequestHandlerId == 0) {
      return;
    }
    bridge.dispatchEventTuple(
      n.onRowRequestHandlerId,
      pending.toList(growable: false),
      eventKind: evRowRequest,
    );
  });
}

/// Measures a materialized builder row's laid-out main-axis extent into
/// the list's `rowExtents` cache so a revisited row's placeholder is
/// extent-perfect. A RenderProxyBox — zero visual effect.
class _RowExtentProbe extends SingleChildRenderObjectWidget {
  const _RowExtentProbe({
    required this.list,
    required this.index,
    required this.axis,
    required Widget child,
  }) : super(child: child);

  final NodeState list;
  final int index;
  final Axis axis;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      _RenderRowExtentProbe(list, index, axis);

  @override
  void updateRenderObject(
      BuildContext context, _RenderRowExtentProbe renderObject) {
    renderObject
      ..list = list
      ..index = index
      ..axis = axis;
  }
}

class _RenderRowExtentProbe extends RenderProxyBox {
  _RenderRowExtentProbe(this.list, this.index, this.axis);

  NodeState list;
  int index;
  Axis axis;

  @override
  void performLayout() {
    super.performLayout();
    final extent = axis == Axis.horizontal ? size.width : size.height;
    (list.rowExtents ??= <int, double>{})[index] = extent;
  }
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
///   • A completed drag fires the node's `onReorder` handler with a
///     `(from, to)` tuple over the `evReorder` event. The JS app owns
///     the list — it reorders its source array, and the next `<For>`
///     diff re-emits the children in the new order. With no
///     `onReorder` handler bound the drag snaps back (safe default).
Widget _buildReorderableListView(NodeState n, SkalBridge bridge) {
  final gap = n.getPropU32(propGap, 8);
  final axis = _axisFor(n.getPropU32(propAxis, 0));
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final count = n.childCount;
  final pad = _paddingFor(n, 16);

  Widget inner = ReorderableListView.builder(
    scrollDirection: axis,
    padding: pad,
    // No gap interleaving here — ReorderableListView wants real items
    // only (every slot needs a stable Key for drag tracking). Apply
    // a trailing margin per child instead, along the scroll axis.
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
        padding: axis == Axis.horizontal
            ? EdgeInsets.only(right: gap.toDouble())
            : EdgeInsets.only(bottom: gap.toDouble()),
        child: child,
      );
    },
    onReorder: (oldIndex, newIndex) {
      // Flutter reports newIndex as the slot the dragged item would
      // occupy with itself still present — for a downward move that's
      // one past the real target. Normalize so the JS handler gets
      // clean "move item from `from` to `to`" semantics.
      final to = newIndex > oldIndex ? newIndex - 1 : newIndex;
      // The JS app owns the list — it reorders its source array and
      // the next <For> diff re-emits the children in the new order.
      // No `onReorder` handler bound → dispatchEventTuple is a no-op,
      // and the item snaps back (the old safe default).
      bridge.dispatchEventTuple(
        n.onReorderHandlerId,
        [oldIndex, to],
        eventKind: evReorder,
      );
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

  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// Wraps a scroll widget in an always-visible, draggable `Scrollbar`
/// (the `scrollbar` prop on `<scrollView>` / `<listView>`). Stateful so
/// the owned `ScrollController` — and thus the scroll offset — survives
/// the parent's cold rebuilds. `thumbVisibility: true` requires a
/// controller, which is why this can't be a plain wrapping function.
class _SkalScrollbar extends StatefulWidget {
  const _SkalScrollbar({required this.builder});

  /// Builds the scroll widget — MUST attach the given controller to it.
  final Widget Function(ScrollController) builder;

  @override
  State<_SkalScrollbar> createState() => _SkalScrollbarState();
}

class _SkalScrollbarState extends State<_SkalScrollbar> {
  final ScrollController _controller = ScrollController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scrollbar(
      controller: _controller,
      thumbVisibility: true,
      child: widget.builder(_controller),
    );
  }
}

Widget _buildScrollView(NodeState n, SkalBridge bridge) {
  final alignment = n.getPropU32(propAlignment, -1);
  final gap = n.getPropU32(propGap, 8);
  final axis = _axisFor(n.getPropU32(propAxis, 0));
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);

  final children = _childWidgets(n, bridge);
  final spaced = _intersperse(
    children,
    axis == Axis.horizontal
        ? SizedBox(width: gap.toDouble())
        : SizedBox(height: gap.toDouble()),
  );

  // The inner flex runs along the scroll axis — Row when horizontal,
  // Column when vertical.
  final Widget flex = axis == Axis.horizontal
      ? Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: _mainAxisFor(alignment),
          children: spaced,
        )
      : Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: _mainAxisFor(alignment),
          children: spaced,
        );

  // See _buildListView — pull-to-refresh needs an always-scrollable
  // viewport so a short page can still be overscrolled.
  final ScrollPhysics? physics = n.onRefreshHandlerId != 0
      ? const AlwaysScrollableScrollPhysics()
      : null;
  Widget inner;
  if (n.getPropU32(propScrollbar, 0) != 0) {
    inner = _SkalScrollbar(
      builder: (c) => SingleChildScrollView(
        controller: c,
        scrollDirection: axis,
        physics: physics,
        child: flex,
      ),
    );
  } else {
    inner = SingleChildScrollView(
      scrollDirection: axis,
      physics: physics,
      child: flex,
    );
  }
  inner = _withRefresh(n, bridge, inner);

  inner = _applyColdVisual(n, inner, defaultPadding: 16);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// Wrap [scrollable] in a `RefreshIndicator` when the node has an
/// `onRefresh` handler bound. The indicator's spinner stays up until
/// JS signals completion (`opCompleteRefresh` resolves the Completer)
/// — so the spinner tracks the app's real async refresh, not a guessed
/// duration. No handler → [scrollable] is returned untouched. See §1.5.
Widget _withRefresh(NodeState n, SkalBridge bridge, Widget scrollable) {
  if (n.onRefreshHandlerId == 0) return scrollable;
  return RefreshIndicator(
    onRefresh: () {
      final c = Completer<void>();
      n.refreshCompleter = c;
      bridge.dispatchEvent(n.onRefreshHandlerId, eventKind: evRefresh);
      return c.future;
    },
    child: scrollable,
  );
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
  return _hotLayer(node: n, child: inner);
}

Widget _buildText(NodeState n, SkalBridge bridge) {
  final text = n.text;
  final fontSize = n.getPropU32(propFontSize, 14);
  final fontWeight = _fontWeightFor(n.getPropU32(propFontWeight, 400));
  // Theme-aware default — white-ish on dark, black on light — so
  // unstyled text stays legible when the design brightness flips.
  final fgRaw = n.getPropU32(
      propFgColor, _isDark(bridge) ? 0xFFECECEC : 0xFF000000);
  final align = _textAlignFor(n.getPropU32(propTextAlign, 0));
  final maxLinesV = n.getPropU32(propMaxLines, 0);
  final overflow = _textOverflowFor(n.getPropU32(propTextOverflow, 0));
  final family = _fontFamilyFor(n.getPropU32(propFontFamily, 2)); // mono default
  final lineHeight = n.getPropU32(propLineHeight, 0);

  final style = TextStyle(
    fontSize: fontSize.toDouble(),
    fontWeight: fontWeight,
    color: _argb(fgRaw),
    fontFamily: family,
    height: lineHeight > 0 ? lineHeight / fontSize : null,
  );

  // ANIMATION.md §4 — an animated `<text>` tweens its style (size,
  // weight, colour) host-side via `AnimatedDefaultTextStyle`.
  final animMs = n.getPropU32(propAnimDuration, 0);
  final Widget widget;
  if (animMs > 0) {
    widget = AnimatedDefaultTextStyle(
      duration: Duration(milliseconds: animMs),
      curve: _curveFor(n.getPropU32(propAnimCurve, 0)),
      style: style,
      textAlign: align,
      maxLines: maxLinesV > 0 ? maxLinesV : null,
      overflow: overflow,
      child: Text(text),
    );
  } else {
    widget = Text(
      text,
      style: style,
      textAlign: align,
      maxLines: maxLinesV > 0 ? maxLinesV : null,
      overflow: overflow,
    );
  }

  return _hotLayer(node: n, child: widget);
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

  // Read n.onClickHandlerId at INVOCATION time so the latest handler
  // binding wins (the cache invalidates on cold.notify anyway, but
  // reading inside the closure is a no-cost hedge against staleness).
  void Function()? onPressed = enabled
      ? () => bridge.dispatchEvent(n.onClickHandlerId)
      : null;

  Widget widget;
  if (bridge.isCupertino) {
    widget = CupertinoButton(
      onPressed: onPressed,
      color: bg != 0 ? _argb(bg) : null,
      padding: contentPad,
      borderRadius: BorderRadius.circular(
          cornerRadius >= 0 ? cornerRadius.toDouble() : 8.0),
      child: Text(
        n.text,
        style: TextStyle(
          fontSize: fontSize.toDouble(),
          color: fg != 0 ? _argb(fg) : null,
        ),
      ),
    );
  } else {
    widget = ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: bg != 0 ? _argb(bg) : null,
        foregroundColor: fg != 0 ? _argb(fg) : null,
        padding: contentPad,
        shape: cornerRadius >= 0
            ? _roundedCornerShape(cornerRadius.toDouble())
            : null,
      ),
      child: Text(n.text, style: TextStyle(fontSize: fontSize.toDouble())),
    );
  }

  widget = _applyHeight(height, _applyWidth(width, widget));
  return _hotLayer(node: n, child: widget);
}

/// Image leaf — `<image src=… contentScale=… cornerRadius=… />`.
///
/// A pure display leaf (no children). `src` is dispatched to a
/// concrete [ImageProvider] by URI scheme (see [imageProviderFromSrc]);
/// `contentScale` maps to [BoxFit]; a non-zero `cornerRadius` clips
/// the image with a [ClipRRect] so the rounding actually crops the
/// pixels rather than just drawing a rounded box behind them.
Widget _buildImage(NodeState n, SkalBridge bridge) {
  final src = n.getPropStr(propImageSrc) ?? '';
  final fit = _boxFitFor(n.getPropU32(propContentScale, 0));
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final corner = n.getPropU32(propCornerRadius, 0);

  final provider = imageProviderFromSrc(src);
  // Sizing comes from the _applyWidth / _applyHeight wrappers below —
  // letting Image own width/height too would double-apply.
  Widget inner = provider == null
      ? const SizedBox.shrink()
      : Image(image: provider, fit: fit);

  if (corner > 0) {
    inner = ClipRRect(
      borderRadius: BorderRadius.circular(corner.toDouble()),
      child: inner,
    );
  }
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// Dispatch an image `src` string to a concrete [ImageProvider]:
///
///   http:// | https://   → [NetworkImage]
///   file://              → [FileImage] (native) / null (web)
///   asset://name         → [AssetImage] (scheme stripped)
///   /absolute/path       → [FileImage] (native) / null (web)
///   bare string          → [AssetImage]
///
/// Returns null for an empty `src` or an inaccessible path (the builder
/// renders nothing). Used by Skal's built-in `<image>` intrinsic AND
/// by skal_codegen-emitted adapters for any pub.dev widget with an
/// `ImageProvider` prop — centralizing the dispatch means apps target
/// either native or Flutter Web from the same JSX `<MyWidget image="…">`
/// call.
ImageProvider? imageProviderFromSrc(String src) {
  if (src.isEmpty) return null;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return NetworkImage(src);
  }
  if (src.startsWith('file://')) {
    return fileImageFromPath(Uri.parse(src).toFilePath());
  }
  if (src.startsWith('asset://')) {
    return AssetImage(src.substring('asset://'.length));
  }
  if (src.startsWith('/')) {
    return fileImageFromPath(src);
  }
  return AssetImage(src);
}

/// `contentScale` wire enum → Flutter [BoxFit].
BoxFit _boxFitFor(int v) {
  switch (v) {
    case 1: return BoxFit.cover;
    case 2: return BoxFit.fill;
    case 3: return BoxFit.fitWidth;
    case 4: return BoxFit.fitHeight;
    case 5: return BoxFit.none;
    case 6: return BoxFit.scaleDown;
    default: return BoxFit.contain;
  }
}

// ── Wave-2 controls ───────────────────────────────────────────────
//
// The interactive controls are CONTROLLED: the value prop is the
// single source of truth (JS owns it). The widget's onChanged just
// dispatches the user's intent over the bridge; JS updates its signal
// and writes the prop back, which rebuilds the control. A control
// with no `onChange` handler bound renders disabled (it can never
// change, so an editable affordance would be a lie).
//
// `slider` is the exception: a controlled slider that round-trips
// every drag delta would make the thumb lag the finger by a frame, so
// it owns the value locally WHILE dragging (see [_SkalSlider]) and is
// controlled the rest of the time.

/// `<switch checked={…} onChange={…} />` → `Switch` /
/// `CupertinoSwitch` depending on the active design system.
Widget _buildSwitch(NodeState n, SkalBridge bridge) {
  final value = n.getPropU32(propChecked, 0) != 0;
  final enabled = n.getPropU32(propEnabled, 1) != 0;
  final handler = n.onChangeHandlerId;
  final void Function(bool)? onChanged = (enabled && handler != 0)
      ? (v) => bridge.dispatchEventBool(handler, v)
      : null;
  final Widget widget = bridge.isCupertino
      ? CupertinoSwitch(value: value, onChanged: onChanged)
      : Switch(value: value, onChanged: onChanged);
  return _hotLayer(node: n, child: widget);
}

/// `<checkbox checked={…} onChange={…} />` → `Checkbox` /
/// `CupertinoCheckbox` depending on the active design system.
Widget _buildCheckbox(NodeState n, SkalBridge bridge) {
  final value = n.getPropU32(propChecked, 0) != 0;
  final enabled = n.getPropU32(propEnabled, 1) != 0;
  final handler = n.onChangeHandlerId;
  final void Function(bool?)? onChanged = (enabled && handler != 0)
      ? (v) => bridge.dispatchEventBool(handler, v ?? false)
      : null;
  final Widget widget = bridge.isCupertino
      ? CupertinoCheckbox(value: value, onChanged: onChanged)
      : Checkbox(value: value, onChanged: onChanged);
  return _hotLayer(node: n, child: widget);
}

/// `<radio checked={…} onChange={…} />` → Flutter `Radio`. A lone
/// radio button: `checked` is its selected state, a tap dispatches
/// `onChange(true)`. The JS app owns the group — its handler clears
/// the other radios' `checked`. (Skal's controlled-component model:
/// the radio never self-toggles; JS is the source of truth.)
Widget _buildRadio(NodeState n, SkalBridge bridge) {
  final value = n.getPropU32(propChecked, 0) != 0;
  final handler = n.onChangeHandlerId;
  // RadioGroup is the current API — `groupValue` / `onChanged` moved
  // off `Radio` itself (deprecated after Flutter 3.32). A lone Skal
  // `<radio>` is one Radio wrapped in its own RadioGroup. RadioGroup's
  // `onChanged` is non-nullable, so it's always present; it only
  // dispatches when an `onChange` handler is actually bound.
  return _hotLayer(
    node: n,
    child: RadioGroup<int>(
      groupValue: value ? 1 : 0,
      onChanged: (_) {
        if (handler != 0) bridge.dispatchEventBool(handler, true);
      },
      child: const Radio<int>(value: 1),
    ),
  );
}

/// `<chip label={…} checked={…} onChange={…} />` → Flutter `FilterChip`
/// — a selectable chip. `label` is its text (rides `opSetText` into
/// `node.text`), `checked` the selected state, `onChange(bool)` fires
/// on a tap.
Widget _buildChip(NodeState n, SkalBridge bridge) {
  final selected = n.getPropU32(propChecked, 0) != 0;
  final enabled = n.getPropU32(propEnabled, 1) != 0;
  final handler = n.onChangeHandlerId;
  Widget inner = FilterChip(
    label: Text(n.text),
    selected: selected,
    onSelected: (enabled && handler != 0)
        ? (v) => bridge.dispatchEventBool(handler, v)
        : null,
  );
  return _hotLayer(node: n, child: inner);
}

/// `<segmentedButton activeTab={…} onChange={…}>` → Flutter
/// `SegmentedButton` — a single-select row of segments. Each child is
/// one segment's label widget; `activeTab` is the selected index and
/// `onChange(index)` fires on a tap.
Widget _buildSegmentedButton(NodeState n, SkalBridge bridge) {
  final count = n.childCount;
  if (count == 0) return const SizedBox.shrink();
  final active = n.getPropU32(propActiveTab, 0).clamp(0, count - 1);
  final handler = n.onChangeHandlerId;

  Widget segLabel(int i) {
    final cid = n.childAt(i);
    return SkalNode(nodeId: cid, bridge: bridge, key: ValueKey<int>(cid));
  }

  Widget inner;
  if (bridge.isCupertino) {
    // iOS has a native segmented control — keep this widget in line
    // with the rest of the adaptive control set (switch / checkbox /
    // activity indicator all branch on the global design system).
    inner = CupertinoSlidingSegmentedControl<int>(
      groupValue: active,
      children: <int, Widget>{
        for (var i = 0; i < count; i++) i: segLabel(i),
      },
      onValueChanged: (v) {
        if (v != null && handler != 0) bridge.dispatchEventInt(handler, v);
      },
    );
  } else {
    inner = SegmentedButton<int>(
      segments: <ButtonSegment<int>>[
        for (var i = 0; i < count; i++)
          ButtonSegment<int>(value: i, label: segLabel(i)),
      ],
      selected: <int>{active},
      showSelectedIcon: false,
      onSelectionChanged: handler != 0
          ? (sel) => bridge.dispatchEventInt(handler, sel.first)
          : null,
    );
  }
  inner = _applyColdVisual(n, inner);
  return _hotLayer(node: n, child: inner);
}

/// `<expansionTile title={…} onChange={…}>` → Flutter `ExpansionTile`
/// — an accordion row. `title` is the header; the children are the
/// body revealed when expanded; `onChange(bool)` fires on each
/// expand / collapse. The open state is host-owned (uncontrolled) —
/// the expand animation runs host-side.
Widget _buildExpansionTile(NodeState n, SkalBridge bridge) {
  final title = n.getPropStr(propTitle) ?? '';
  final handler = n.onChangeHandlerId;
  Widget inner = ExpansionTile(
    title: Text(title),
    onExpansionChanged: handler != 0
        ? (b) => bridge.dispatchEventBool(handler, b)
        : null,
    children: _childWidgets(n, bridge),
  );
  inner = _applyColdVisual(n, inner);
  return _hotLayer(node: n, child: inner);
}

/// `<dropdown activeTab={…} onChange={…}>` → Flutter `DropdownButton`
/// — a single-select menu. Each child is one option's label widget;
/// `activeTab` is the selected index and `onChange(index)` fires on a
/// pick. Material-only (like `<chip>` / `<radio>`): `DropdownButton`
/// renders acceptably under Cupertino, and an iOS wheel variant can
/// follow later if needed.
Widget _buildDropdown(NodeState n, SkalBridge bridge) {
  final count = n.childCount;
  if (count == 0) return const SizedBox.shrink();
  final active = n.getPropU32(propActiveTab, 0).clamp(0, count - 1);
  final enabled = n.getPropU32(propEnabled, 1) != 0;
  final handler = n.onChangeHandlerId;

  Widget optionLabel(int i) {
    final cid = n.childAt(i);
    return SkalNode(nodeId: cid, bridge: bridge, key: ValueKey<int>(cid));
  }

  Widget inner = DropdownButton<int>(
    value: active,
    isDense: true,
    items: <DropdownMenuItem<int>>[
      for (var i = 0; i < count; i++)
        DropdownMenuItem<int>(value: i, child: optionLabel(i)),
    ],
    onChanged: (enabled && handler != 0)
        ? (v) {
            if (v != null) bridge.dispatchEventInt(handler, v);
          }
        : null,
  );
  inner = _applyColdVisual(n, inner);
  return _hotLayer(node: n, child: inner);
}

/// `<stepper activeTab={…} axis={…} onChange={…}>` → Flutter `Stepper`
/// — a multi-step flow. Each child is a `<step>` carrying a `title` and
/// one content child. `activeTab` is the current step; `onChange(i)`
/// fires on a step tap, or on the continue / cancel buttons (which
/// report the adjacent index). The app owns the index — Skal keeps the
/// host stateless here, consistent with `<tabs>`.
Widget _buildStepper(NodeState n, SkalBridge bridge) {
  final count = n.childCount;
  if (count == 0) return const SizedBox.shrink();
  final current = n.getPropU32(propActiveTab, 0).clamp(0, count - 1);
  final handler = n.onChangeHandlerId;
  final horizontal = n.getPropU32(propAxis, 0) == 1;

  void go(int i) {
    if (handler != 0) bridge.dispatchEventInt(handler, i.clamp(0, count - 1));
  }

  Step stepFor(int i) {
    final stepId = n.childAt(i);
    final stepNode = bridge.nodes[stepId];
    final title = stepNode?.getPropStr(propTitle) ?? 'Step ${i + 1}';
    return Step(
      title: Text(title),
      // The step's content is rendered through SkalNode → _buildStep,
      // which returns the step's single child.
      content: SkalNode(
        nodeId: stepId, bridge: bridge, key: ValueKey<int>(stepId)),
      isActive: i <= current,
      state: i < current
          ? StepState.complete
          : (i == current ? StepState.editing : StepState.indexed),
    );
  }

  Widget inner = Stepper(
    type: horizontal ? StepperType.horizontal : StepperType.vertical,
    currentStep: current,
    onStepTapped: go,
    onStepContinue: () => go(current + 1),
    onStepCancel: () => go(current - 1),
    steps: <Step>[for (var i = 0; i < count; i++) stepFor(i)],
  );
  inner = _applyColdVisual(n, inner);
  return _hotLayer(node: n, child: inner);
}

/// `<step>` → the content slot of a `<stepper>`. Like `<tab>`, it
/// renders its single child; the `title` prop is read by the parent
/// `<stepper>` builder, not here.
Widget _buildStep(NodeState n, SkalBridge bridge) {
  final children = _childWidgets(n, bridge);
  return children.isEmpty ? const SizedBox.shrink() : children.first;
}

/// `<drawer>` → Flutter `Drawer` — the slide-in side panel. Consumed by
/// the `<navigator>` (routed into `Scaffold.drawer`); a standalone
/// `<drawer>` outside a screen still renders so the tree stays valid.
/// Children stack in a scrolling `ListView` — typically `<listTile>`s.
///
/// Under Cupertino the Material 3 drawer treatment is stripped — no
/// elevation shadow, square edge (no rounded trailing corner), an iOS
/// grouped-background surface — so the panel reads as a neutral
/// slide-over. iOS has no native drawer pattern, so design-neutral is
/// the closest honest match (see DONE_OR_STALE/FLUTTER_COMPONENTS_TODO_2.md §2 / §3).
Widget _buildDrawer(NodeState n, SkalBridge bridge) {
  final bg = n.getPropU32(propBgColor, 0);
  final cupertino = bridge.isCupertino;
  return Drawer(
    backgroundColor: bg != 0
        ? _argb(bg)
        : (cupertino
            ? (_isDark(bridge)
                ? const Color(0xFF1C1C1E)
                : const Color(0xFFF2F2F7))
            : null),
    elevation: cupertino ? 0 : null,
    shape: cupertino ? const RoundedRectangleBorder() : null,
    child: ListView(
      padding: EdgeInsets.zero,
      children: _childWidgets(n, bridge),
    ),
  );
}

/// `<bottomSheet initialSize minSize maxSize>` → Flutter
/// `DraggableScrollableSheet` — a draggable, expandable bottom sheet.
/// Place it inside a `<stack>`: it pins to the bottom and the user
/// drags it between `minSize` and `maxSize` (0..1 height fractions).
/// The children stack in a `ListView` bound to the sheet's own
/// `ScrollController`, so scrolling the list past its edge keeps
/// driving the expand / collapse gesture seamlessly.
Widget _buildBottomSheet(NodeState n, SkalBridge bridge) {
  // Order the fractions so min ≤ initial ≤ max — DraggableScrollableSheet
  // asserts this, and a malformed prop set should degrade, not crash.
  final maxS = n.getPropF32(propSheetMax, 0.9).clamp(0.0, 1.0);
  final minS = n.getPropF32(propSheetMin, 0.25).clamp(0.0, maxS);
  final initial = n.getPropF32(propSheetInitial, 0.4).clamp(minS, maxS);
  final bg = n.getPropU32(propBgColor, 0);
  final corner = n.getPropU32(propCornerRadius, 16);

  Widget inner = DraggableScrollableSheet(
    initialChildSize: initial,
    minChildSize: minS,
    maxChildSize: maxS,
    builder: (context, scrollController) {
      return DecoratedBox(
        decoration: BoxDecoration(
          color: bg != 0 ? _argb(bg) : Theme.of(context).canvasColor,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(corner.toDouble()),
          ),
          boxShadow: const [
            BoxShadow(color: Color(0x33000000), blurRadius: 8),
          ],
        ),
        child: ListView(
          controller: scrollController,
          padding: EdgeInsets.zero,
          children: _childWidgets(n, bridge),
        ),
      );
    },
  );
  return _hotLayer(node: n, child: inner);
}

/// `<backdropFilter blurRadius={…}>` → Flutter `BackdropFilter` — a
/// blur / frosted-glass layer. The blur applies to whatever is painted
/// behind it, so place a `<backdropFilter>` inside a `<stack>` above
/// the content to frost. Its own children render un-blurred on top
/// (e.g. a translucent tint). Wrapped in a `ClipRect` so the blur is
/// bounded to this widget's box rather than bleeding across the layer.
Widget _buildBackdropFilter(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final radius = n.getPropU32(propBlurRadius, 8).toDouble();
  final children = _childWidgets(n, bridge);
  final Widget? content = children.isEmpty
      ? null
      : (children.length == 1
          ? children.first
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: children,
            ));
  Widget inner = ClipRect(
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: radius, sigmaY: radius),
      child: content,
    ),
  );
  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// `<interactiveViewer minScale maxScale>` → Flutter `InteractiveViewer`
/// — bounded pinch-zoom + pan of its single child.
Widget _buildInteractiveViewer(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  // InteractiveViewer asserts 0 < minScale <= maxScale — clamp a
  // malformed prop set rather than letting it crash.
  var minScale = n.getPropF32(propMinScale, 0.8);
  if (minScale <= 0) minScale = 0.8;
  var maxScale = n.getPropF32(propMaxScale, 4.0);
  if (maxScale < minScale) maxScale = minScale;
  final children = _childWidgets(n, bridge);
  final Widget content = children.isEmpty
      ? const SizedBox.shrink()
      : (children.length == 1
          ? children.first
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: children,
            ));
  Widget inner = InteractiveViewer(
    minScale: minScale,
    maxScale: maxScale,
    child: content,
  );
  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// `<htmlEmbed viewType="…"/>` → Flutter Web's [HtmlElementView]
/// (web) or a labelled placeholder (native). The actual DOM is built
/// JS-side by a factory registered with `registerHtmlView` — Skal's
/// "Flutter with DOM holes" escape hatch for hosting third-party JS
/// widgets (Stripe Elements, OAuth iframes, browser-native form
/// controls, WebGL/Three canvases) inside an otherwise-Flutter app.
///
/// Sizing follows normal `propWidth` / `propHeight`; the DOM element
/// inside the platform view is sized to fill, and gets pointer
/// events, scroll, text selection, ARIA all live.
Widget _buildHtmlEmbed(NodeState n, SkalBridge bridge) {
  final viewType = n.getPropStr(propViewType) ?? '';
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  Widget inner = buildHtmlEmbed(viewType);
  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// `<slider value={…} min={…} max={…} onChange={…} />` → a stateful
/// [_SkalSlider] host (uncontrolled while dragging, controlled
/// otherwise).
Widget _buildSlider(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  Widget widget = _SkalSlider(node: n, bridge: bridge);
  widget = _applyWidth(width, widget);
  return _hotLayer(node: n, child: widget);
}

/// `<activityIndicator color={…} width={…} />` →
/// `CircularProgressIndicator` / `CupertinoActivityIndicator`.
/// `width` doubles as the box size.
Widget _buildActivityIndicator(NodeState n, SkalBridge bridge) {
  final color = n.getPropU32(propFgColor, 0);
  final size = n.getPropU32(propWidth, 24);
  final dim =
      (size == kNoValue || size == kFillMax || size == kWrapContent)
          ? 24.0
          : size.toDouble();
  final Widget indicator = bridge.isCupertino
      ? CupertinoActivityIndicator(color: color != 0 ? _argb(color) : null)
      : CircularProgressIndicator(
          strokeWidth: 3,
          color: color != 0 ? _argb(color) : null,
        );
  final widget = SizedBox(width: dim, height: dim, child: indicator);
  return _hotLayer(node: n, child: widget);
}

/// `<progressBar progress={0.4} color={…} background={…} />` →
/// `LinearProgressIndicator`. Omitting `progress` (or a negative
/// value) renders the indeterminate animation.
Widget _buildProgressBar(NodeState n) {
  final color = n.getPropU32(propFgColor, 0);
  final bg = n.getPropU32(propBgColor, 0);
  final p = n.getPropF32(propProgress, -1.0);
  final width = n.getPropU32(propWidth, kFillMax);
  Widget widget = LinearProgressIndicator(
    value: p >= 0 ? p.clamp(0.0, 1.0).toDouble() : null,
    color: color != 0 ? _argb(color) : null,
    backgroundColor: bg != 0 ? _argb(bg) : null,
  );
  widget = _applyWidth(width, widget);
  return _hotLayer(node: n, child: widget);
}

// ── Wave-3 widgets ────────────────────────────────────────────────

/// `<lazyGrid crossAxisCount={2} aspectRatio={1} gap={8}>` →
/// `GridView.builder`. Lazily materializes only the visible cells.
Widget _buildLazyGrid(NodeState n, SkalBridge bridge) {
  final gap = n.getPropU32(propGap, 8).toDouble();
  final crossAxisCount = n.getPropU32(propCrossAxisCount, 2);
  final aspectRatio = n.getPropF32(propAspectRatio, 1.0);
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final pad = _paddingFor(n, 16);
  final count = n.childCount;

  Widget inner = GridView.builder(
    padding: pad,
    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: crossAxisCount < 1 ? 1 : crossAxisCount,
      mainAxisSpacing: gap,
      crossAxisSpacing: gap,
      childAspectRatio: aspectRatio > 0 ? aspectRatio : 1.0,
    ),
    itemCount: count,
    itemBuilder: (_, i) {
      final childId = n.childAt(i);
      return SkalNode(
        nodeId: childId,
        bridge: bridge,
        key: ValueKey<int>(childId),
      );
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
  // A GridView scrolls vertically — it needs a bounded height when it
  // isn't the parent-bounded outermost scroller.
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// `<wrap gap={8}>` → `Wrap` — children flow and wrap to new runs.
/// `gap` sets both `spacing` (within a run) and `runSpacing`.
Widget _buildWrap(NodeState n, SkalBridge bridge) {
  final gap = n.getPropU32(propGap, 8).toDouble();
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);

  Widget inner = Wrap(
    spacing: gap,
    runSpacing: gap,
    children: _childWidgets(n, bridge),
  );
  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  inner = _applyGestures(n, bridge, inner);
  inner = _applyHover(n, bridge, inner);
  inner = _applyFocus(n, bridge, inner);
  return _hotLayer(node: n, child: inner);
}

/// `<safeArea>` → `SafeArea` — insets its child past notches and
/// system bars. Multiple children are stacked in a `Column`.
Widget _buildSafeArea(NodeState n, SkalBridge bridge) {
  final children = _childWidgets(n, bridge);
  final Widget content = children.isEmpty
      ? const SizedBox.shrink()
      : (children.length == 1
          ? children.first
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: children,
            ));
  return _hotLayer(node: n, child: SafeArea(child: content));
}

/// `<richText>` → `Text.rich`. Each child `<text>` node is absorbed
/// into a `TextSpan` styled by the child's own text-tier props — the
/// child is NOT rendered as its own widget. The bridge re-dirties
/// this node when any child changes (see the coalescing loop in
/// bridge.dart).
Widget _buildRichText(NodeState n, SkalBridge bridge) {
  final align = _textAlignFor(n.getPropU32(propTextAlign, 0));
  final baseSize = n.getPropU32(propFontSize, 14);

  final spans = <TextSpan>[];
  for (final id in n.childIds) {
    final c = bridge.nodes[id];
    if (c == null) continue;
    final size = c.getPropU32(propFontSize, baseSize);
    final weight = _fontWeightFor(c.getPropU32(propFontWeight, 400));
    final color = c.getPropU32(propFgColor, 0xFF000000);
    // Default font family 2 (monospace) — same unstyled-text default
    // as a standalone <text>, so a span reads identically in or out
    // of a <richText>.
    final family = _fontFamilyFor(c.getPropU32(propFontFamily, 2));
    spans.add(TextSpan(
      text: c.text,
      style: TextStyle(
        fontSize: size.toDouble(),
        fontWeight: weight,
        color: _argb(color),
        fontFamily: family,
      ),
    ));
  }

  final widget = Text.rich(TextSpan(children: spans), textAlign: align);
  return _hotLayer(node: n, child: widget);
}

/// `<textInput …>` → a stateful [_SkalTextField] host. Defaults to
/// fill width (a text field with no width constraint is rarely what
/// you want).
Widget _buildTextInput(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kFillMax);
  Widget w = _SkalTextField(node: n, bridge: bridge);
  w = _applyWidth(width, w);
  return _hotLayer(node: n, child: w);
}

/// `propKeyboardType` wire enum → Flutter [TextInputType].
TextInputType _keyboardTypeFor(int v) {
  switch (v) {
    case 1: return TextInputType.number;
    case 2: return TextInputType.emailAddress;
    case 3: return TextInputType.phone;
    case 4: return TextInputType.url;
    case 5: return TextInputType.multiline;
    default: return TextInputType.text;
  }
}

// ── Navigation ────────────────────────────────────────────────────

/// A page-API `Page` with a cross-fade (or no) transition — backs
/// `<screen transition>` (ANIMATION.md §10). `instant` collapses the
/// transition to zero duration (`transition: 'none'`).
class _FadePage<T> extends Page<T> {
  final Widget child;
  final bool instant;
  const _FadePage({required this.child, required this.instant, super.key});

  @override
  Route<T> createRoute(BuildContext context) {
    return PageRouteBuilder<T>(
      settings: this,
      transitionDuration:
          instant ? Duration.zero : const Duration(milliseconds: 250),
      reverseTransitionDuration:
          instant ? Duration.zero : const Duration(milliseconds: 200),
      pageBuilder: (_, _, _) => child,
      transitionsBuilder: instant
          ? (_, _, _, c) => c
          : (_, animation, _, c) =>
              FadeTransition(opacity: animation, child: c),
    );
  }
}

/// `<navigator>` → Flutter `Navigator(pages:)`. Each `<screen>` child
/// becomes one page; the JS app owns the route stack, so a push is a
/// new `<screen>` child and a pop is one removed. Backgrounded screens
/// stay mounted — instant, state-preserving back. See NAVIGATION.md.
Widget _buildNavigator(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final cupertino = bridge.isCupertino;
  final popHandler = n.onPopHandlerId;

  final pages = <Page<dynamic>>[];
  for (final screenId in n.childIds) {
    final screen = bridge.nodes[screenId];
    if (screen == null) continue;
    // Split the screen's children: the first non-drawer child is the
    // route content; an optional `<drawer>` child routes to the
    // Scaffold's drawer slot rather than rendering inline.
    int contentId = -1;
    int drawerId = -1;
    for (final cid in screen.childIds) {
      final c = bridge.nodes[cid];
      if (c != null && c.type == wtDrawer) {
        drawerId = cid;
      } else if (contentId < 0) {
        contentId = cid;
      }
    }
    Widget content = contentId >= 0
        ? SkalNode(
            nodeId: contentId,
            bridge: bridge,
            key: ValueKey<int>(contentId),
          )
        : const SizedBox.shrink();
    // NAVIGATION.md Phase 2 — an optional AppBar / nav bar from a
    // `<screen title>`. The bar's back button is automatic: Flutter
    // shows it whenever the enclosing route can pop, and tapping it
    // pops the page-based route → `onDidRemovePage` below → `evNavPop`.
    // A `<drawer>` child also needs a Scaffold, so chrome is built when
    // EITHER a title or a drawer is present.
    final title = screen.getPropStr(propTitle) ?? '';
    final Widget? drawer = drawerId >= 0
        ? SkalNode(
            nodeId: drawerId,
            bridge: bridge,
            key: ValueKey<int>(drawerId),
          )
        : null;
    if (title.isNotEmpty || drawer != null) {
      content = _screenChrome(title, content, cupertino, drawer: drawer);
    }
    final modal = screen.getPropU32(propPresentation, 0) == 1;
    // ANIMATION.md §10 — `<screen transition>`: 1 fade, 2 none. 0 keeps
    // the platform default push (Material slide / Cupertino slide).
    final transition = screen.getPropU32(propTransition, 0);
    if (transition == 1 || transition == 2) {
      pages.add(_FadePage<dynamic>(
        key: ValueKey<int>(screenId),
        instant: transition == 2,
        child: content,
      ));
    } else {
      pages.add(cupertino
          ? CupertinoPage<dynamic>(
              key: ValueKey<int>(screenId),
              fullscreenDialog: modal,
              child: content,
            )
          : MaterialPage<dynamic>(
              key: ValueKey<int>(screenId),
              fullscreenDialog: modal,
              child: content,
            ));
    }
  }
  // A Navigator must always have at least one page.
  if (pages.isEmpty) {
    pages.add(const MaterialPage<dynamic>(child: SizedBox.shrink()));
  }

  Widget inner = Navigator(
    pages: pages,
    onDidRemovePage: (page) {
      // Tell a gesture / system-back pop apart from a programmatic
      // one: if the popped screen is STILL in the bridge's child
      // list, JS hasn't removed it → a gesture pop → tell JS to catch
      // up. If it's already gone, JS popped it and the pages-list
      // diff did the removal — nothing to dispatch (no feedback loop).
      final key = page.key;
      if (key is ValueKey<int> && n.childIds.contains(key.value)) {
        bridge.dispatchEvent(popHandler, eventKind: evNavPop);
      }
    },
  );

  // NAVIGATION.md Phase 2 — system-back arbitration. `<navigator>` is
  // a NESTED Navigator, so the Android system back button reaches the
  // app's ROOT Navigator first. `PopScope` registers with that root
  // route: while this navigator has more than one screen it reports
  // `canPop: false`, so the system back is intercepted (didPop ==
  // false) and forwarded to JS as `evNavPop` — JS drops the top route,
  // the pages diff runs the native pop. At one screen `canPop` is true
  // and the system back falls through (exits the app / pops a parent).
  //
  // Dialog arbitration is automatic: `showDialog` pushes its route on
  // the root Navigator ABOVE the route this PopScope is registered in,
  // so a system back with a dialog open pops the dialog first and this
  // PopScope never sees it (NAVIGATION.md §7).
  inner = PopScope<dynamic>(
    canPop: n.childCount <= 1,
    onPopInvokedWithResult: (didPop, result) {
      if (!didPop && popHandler != 0) {
        bridge.dispatchEvent(popHandler, eventKind: evNavPop);
      }
    },
    child: inner,
  );
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// Wrap a `<screen>`'s content in chrome carrying [title] and an
/// optional [drawer].
///
/// Material → `Scaffold` + `AppBar` (the `AppBar` is omitted when
/// [title] is empty). The back button and, when [drawer] is set, the
/// hamburger are added by the `AppBar` automatically — so a titleless
/// Material drawer screen has no hamburger and opens by edge-swipe.
///
/// Cupertino → `CupertinoPageScaffold` + `CupertinoNavigationBar`; the
/// visible chrome stays iOS. A `<drawer>` still needs a Material
/// `Scaffold` to own the drawer slot + the edge-swipe gesture, so a
/// drawer screen wraps the Cupertino scaffold in a bare `Scaffold`
/// (drawer slot only, no `AppBar`). The Cupertino nav bar has no
/// auto-hamburger, so an explicit `leading` button is added whenever
/// [drawer] is set.
Widget _screenChrome(
  String title,
  Widget content,
  bool cupertino, {
  Widget? drawer,
}) {
  if (cupertino) {
    // The visible chrome stays iOS — a `CupertinoNavigationBar`. A
    // drawer needs a Material `Scaffold` to own the drawer slot + the
    // edge-swipe gesture, so a drawer screen wraps the Cupertino
    // scaffold in a bare `Scaffold` (no AppBar of its own). The drawer
    // has no auto-hamburger here (that is an `AppBar` feature), so we
    // add an explicit one to the nav bar's `leading` slot.
    final cupertinoScaffold = CupertinoPageScaffold(
      navigationBar: CupertinoNavigationBar(
        middle: Text(title),
        leading: drawer == null
            ? null
            : Builder(
                builder: (ctx) => CupertinoButton(
                  padding: EdgeInsets.zero,
                  onPressed: () => Scaffold.of(ctx).openDrawer(),
                  child: const Icon(CupertinoIcons.bars),
                ),
              ),
      ),
      child: SafeArea(child: content),
    );
    if (drawer == null) return cupertinoScaffold;
    return Scaffold(drawer: drawer, body: cupertinoScaffold);
  }
  return Scaffold(
    appBar: title.isNotEmpty ? AppBar(title: Text(title)) : null,
    drawer: drawer,
    body: content,
  );
}

/// `<screen>` standalone — a screen is normally consumed by its parent
/// `<navigator>`, which reads its content + presentation directly.
/// Outside a navigator, just render the content so the tree stays
/// valid.
Widget _buildScreen(NodeState n, SkalBridge bridge) {
  final children = _childWidgets(n, bridge);
  return children.isEmpty ? const SizedBox.shrink() : children.first;
}

// ── Tabs ──────────────────────────────────────────────────────────

/// `<tabs activeTab={…} onChange={…}>` → an `IndexedStack` (every
/// `<tab>` subtree built once and kept alive) above a Material
/// `NavigationBar` / Cupertino `CupertinoTabBar`. NAVIGATION.md
/// Phase 3.
///
/// Controlled, like the other Wave-2 controls: `activeTab` is the
/// single source of truth, `onChange(index)` dispatches the user's
/// tap, JS updates its signal and writes `activeTab` back.
///
/// Sizing: with an explicit `height` the tab body fills via an
/// `Expanded`; without one the column is `MainAxisSize.min` and the
/// body sizes to its largest tab — so a `<tabs>` is safe inside an
/// unbounded-height parent.
Widget _buildTabs(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final cupertino = bridge.isCupertino;
  final handler = n.onChangeHandlerId;

  final contents = <Widget>[];
  final titles = <String>[];
  final icons = <String>[];
  for (final id in n.childIds) {
    final tab = bridge.nodes[id];
    if (tab == null) continue;
    final contentId = tab.hasChildren ? tab.childAt(0) : -1;
    contents.add(contentId >= 0
        ? SkalNode(
            nodeId: contentId,
            bridge: bridge,
            key: ValueKey<int>(contentId),
          )
        : const SizedBox.shrink());
    titles.add(tab.getPropStr(propTitle) ?? '');
    icons.add(tab.getPropStr(propIcon) ?? '');
  }
  if (contents.isEmpty) return const SizedBox.shrink();

  // Material `NavigationBar` and `CupertinoTabBar` both assert at least
  // two destinations. A single-`<tab>` `<tabs>` is degenerate — render
  // just the one body, no bar, rather than tripping the assert.
  if (contents.length < 2) {
    Widget only = _applyColdVisual(n, contents.first);
    only = _applyHeight(height, _applyWidth(width, only));
    return _hotLayer(node: n, child: only);
  }

  final active = n.getPropU32(propActiveTab, 0).clamp(0, contents.length - 1);
  void onSelect(int i) {
    if (handler != 0) bridge.dispatchEventInt(handler, i);
  }

  final bool bounded = height != kNoValue && height != kWrapContent;

  // IndexedStack builds + keeps ALL tab subtrees alive; only the
  // selected one paints. That is the tab keep-alive guarantee —
  // switching tabs never re-mounts, scroll + state survive.
  //
  // `sizing`: when the `<tabs>` has a bounded height the body fills it
  // with TIGHT constraints (`StackFit.expand`) — required so a tab
  // whose content is a scroller (`<listView>` / `<scrollView>`) gets a
  // bounded height instead of an unconstrained one. Without a height
  // the body sizes loosely to its largest tab.
  final Widget body = IndexedStack(
    index: active,
    sizing: bounded ? StackFit.expand : StackFit.loose,
    children: contents,
  );

  final Widget bar = cupertino
      ? CupertinoTabBar(
          currentIndex: active,
          onTap: onSelect,
          items: <BottomNavigationBarItem>[
            for (var i = 0; i < titles.length; i++)
              BottomNavigationBarItem(
                icon: Icon(_iconFor(icons[i])),
                label: titles[i],
              ),
          ],
        )
      : NavigationBar(
          selectedIndex: active,
          onDestinationSelected: onSelect,
          destinations: <Widget>[
            for (var i = 0; i < titles.length; i++)
              NavigationDestination(
                icon: Icon(_iconFor(icons[i])),
                label: titles[i],
              ),
          ],
        );

  Widget inner = Column(
    mainAxisSize: bounded ? MainAxisSize.max : MainAxisSize.min,
    children: <Widget>[
      bounded ? Expanded(child: body) : body,
      bar,
    ],
  );

  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// `<tab>` standalone — normally consumed by its parent `<tabs>`,
/// which reads its content + title + icon directly. Outside a `<tabs>`
/// just render the content so the tree stays valid.
Widget _buildTab(NodeState n, SkalBridge bridge) {
  final children = _childWidgets(n, bridge);
  return children.isEmpty ? const SizedBox.shrink() : children.first;
}

/// `<tab icon>` name → Flutter [IconData]. A small curated table —
/// covers the common bottom-bar icons; unknown names fall back to a
/// neutral dot so a typo is visible but never crashes.
IconData _iconFor(String name) {
  switch (name) {
    case 'home':                   return Icons.home;
    case 'search':                 return Icons.search;
    case 'settings':               return Icons.settings;
    case 'person': case 'profile': return Icons.person;
    case 'favorite': case 'heart': return Icons.favorite;
    case 'star':                   return Icons.star;
    case 'list':                   return Icons.list;
    case 'add':                    return Icons.add;
    case 'bell': case 'notifications': return Icons.notifications;
    case 'mail': case 'inbox':     return Icons.mail;
    case 'chat': case 'message':   return Icons.chat_bubble;
    case 'menu':                   return Icons.menu;
    case 'grid':                   return Icons.grid_view;
    case 'calendar':               return Icons.calendar_today;
    case 'camera':                 return Icons.camera_alt;
    case 'cart':                   return Icons.shopping_cart;
    case 'explore': case 'compass': return Icons.explore;
    case 'play':                   return Icons.play_circle;
    case 'music':                  return Icons.music_note;
    case 'map':                    return Icons.map;
    case 'code': case 'terminal':  return Icons.code;
    case 'storage': case 'database': return Icons.storage;
    default:                       return Icons.circle;
  }
}

// ── ListTile — structured Material row ────────────────────────────

/// `<listTile>` → Flutter `ListTile`. Props-keyed (not child slots):
/// `title` / `subtitle` strings, `leadingIcon` / `trailingIcon` names
/// resolved through [_iconFor], and `onTap` to make the whole row
/// pressable. For an arbitrary widget as leading / trailing, compose a
/// `<row>` instead — this fast-path covers the dominant icon+text case.
Widget _buildListTile(NodeState n, SkalBridge bridge) {
  final title = n.getPropStr(propTitle);
  final subtitle = n.getPropStr(propSubtitle);
  final leading = n.getPropStr(propIcon);
  final trailing = n.getPropStr(propTrailingIcon);
  final tap = n.onClickHandlerId;

  Widget inner = ListTile(
    leading: (leading != null && leading.isNotEmpty)
        ? Icon(_iconFor(leading))
        : null,
    title: title != null ? Text(title) : null,
    subtitle: subtitle != null ? Text(subtitle) : null,
    trailing: (trailing != null && trailing.isNotEmpty)
        ? Icon(_iconFor(trailing))
        : null,
    onTap: tap != 0 ? () => bridge.dispatchEvent(tap) : null,
  );

  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(n.getPropU32(propHeight, kNoValue),
      _applyWidth(n.getPropU32(propWidth, kNoValue), inner));
  return _hotLayer(node: n, child: inner);
}

// ── PageView — swipeable full-page pages ──────────────────────────

/// `<pageView>` → Flutter `PageView`. Each child is one full-bleed
/// page; horizontal swipe by default (`axis` → vertical). `activeTab`
/// is the CONTROLLED page index — a JS write animates the
/// `PageController` to it — and `onChange(index)` fires when a swipe
/// settles. The host owns the swipe physics: zero per-frame traffic.
Widget _buildPageView(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  Widget inner = _SkalPageView(node: n, bridge: bridge);
  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

class _SkalPageView extends StatefulWidget {
  final NodeState node;
  final SkalBridge bridge;
  const _SkalPageView({required this.node, required this.bridge});

  @override
  State<_SkalPageView> createState() => _SkalPageViewState();
}

class _SkalPageViewState extends State<_SkalPageView> {
  late final PageController _ctrl;
  // The page currently shown — tracked so a controlled `activeTab`
  // write can be told apart from JS echoing back our own swipe.
  int _active = 0;

  @override
  void initState() {
    super.initState();
    _active = widget.node.getPropU32(propActiveTab, 0);
    _ctrl = PageController(initialPage: _active);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(_SkalPageView oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Controlled index — JS changed `activeTab`; glide to it. Skipped
    // when the value just echoes a swipe we already reported.
    final target = widget.node.getPropU32(propActiveTab, _active);
    if (target != _active && _ctrl.hasClients) {
      _active = target;
      _ctrl.animateToPage(target,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.node;
    final handler = n.onChangeHandlerId;
    final count = n.childCount;
    if (count == 0) return const SizedBox.shrink();
    // PageView.builder (NOT PageView(children:)) — lazy: only the
    // visible page plus the cache-extent neighbours mount, so a large
    // pager costs the same as a small one. `childAt` is O(1) on the
    // node's ListChildList backing.
    return PageView.builder(
      controller: _ctrl,
      scrollDirection: _axisFor(n.getPropU32(propAxis, 0)),
      itemCount: count,
      itemBuilder: (_, i) {
        final id = n.childAt(i);
        return SkalNode(
            nodeId: id, bridge: widget.bridge, key: ValueKey<int>(id));
      },
      onPageChanged: (i) {
        _active = i;
        if (handler != 0) widget.bridge.dispatchEventInt(handler, i);
      },
    );
  }
}

// ── Dismissible — swipe-to-dismiss ────────────────────────────────

/// `<dismissible>` → Flutter `Dismissible`. Wraps its single child;
/// `onDismiss` fires when a swipe carries the child off-screen. The JS
/// app then drops the item from its source list.
///
/// The node latches `dismissed` in the `onDismissed` callback: if the
/// tree rebuilds in the gap before the JS removal lands, this builder
/// renders nothing — Flutter asserts that a dismissed `Dismissible`
/// must leave the tree, and a stale rebuild would otherwise trip it.
Widget _buildDismissible(NodeState n, SkalBridge bridge) {
  if (n.dismissed) return const SizedBox.shrink();
  final childId = n.hasChildren ? n.childAt(0) : -1;
  final Widget content = childId >= 0
      ? SkalNode(nodeId: childId, bridge: bridge, key: ValueKey<int>(childId))
      : const SizedBox.shrink();
  final handler = n.onDismissHandlerId;
  return _hotLayer(
    node: n,
    child: Dismissible(
      // ObjectKey on the NodeState — unique + stable for this node's
      // lifetime, which is what Dismissible's dismiss tracking needs.
      key: ObjectKey(n),
      onDismissed: (_) {
        n.dismissed = true;
        if (handler != 0) bridge.dispatchEvent(handler, eventKind: evDismiss);
      },
      child: content,
    ),
  );
}

// ── Slivers — CustomScrollView + collapsing headers ───────────────

/// True for the sliver widget types — the ones that may sit directly
/// inside a `<customScrollView>` and produce a `RenderSliver`.
bool _isSliverType(int t) =>
    t == wtSliverAppBar || t == wtSliverList || t == wtSliverGrid;

/// `<customScrollView>` → Flutter `CustomScrollView`. A child that is
/// itself a sliver type goes in directly — its `SkalNode` builds a
/// sliver and `MemoizingListenableBuilder` passes it through untouched
/// — while any non-sliver child is wrapped in a `SliverToBoxAdapter`.
/// This is the one place sliver widgets are valid.
Widget _buildCustomScrollView(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final axis = _axisFor(n.getPropU32(propAxis, 0));

  final slivers = <Widget>[];
  for (final id in n.childIds) {
    final childNode = bridge.nodes[id];
    if (childNode != null && _isSliverType(childNode.type)) {
      slivers.add(
          SkalNode(nodeId: id, bridge: bridge, key: ValueKey<int>(id)));
    } else {
      // Non-sliver child — wrap so it scrolls. Key the adapter itself
      // (by node id) so the slivers list reconciles stably if it ever
      // reorders, not just the SkalNode nested inside.
      slivers.add(SliverToBoxAdapter(
        key: ValueKey<int>(id),
        child: SkalNode(nodeId: id, bridge: bridge),
      ));
    }
  }

  Widget inner = CustomScrollView(
    scrollDirection: axis,
    physics: n.onRefreshHandlerId != 0
        ? const AlwaysScrollableScrollPhysics()
        : null,
    slivers: slivers,
  );
  inner = _withRefresh(n, bridge, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// `<sliverAppBar>` → Flutter `SliverAppBar` — the collapsing header.
/// `propTitle` → title, `propHeight` → expanded height, `propSliverMode`
/// → pinned / floating, `propBgColor` → bar colour. A child node becomes
/// the `FlexibleSpaceBar` background (the parallax content that
/// collapses). Valid only as a direct child of `<customScrollView>`.
Widget _buildSliverAppBar(NodeState n, SkalBridge bridge) {
  final title = n.getPropStr(propTitle);
  final height = n.getPropU32(propHeight, kNoValue);
  final mode = n.getPropU32(propSliverMode, 0);
  final bg = n.getPropU32(propBgColor, 0);
  final childId = n.hasChildren ? n.childAt(0) : -1;
  return SliverAppBar(
    title: title != null ? Text(title) : null,
    pinned: mode == 1 || mode == 3,    // 1 pinned, 3 pinned+floating
    floating: mode == 2 || mode == 3,  // 2 floating, 3 both
    backgroundColor: bg != 0 ? _argb(bg) : null,
    expandedHeight: height != kNoValue ? height.toDouble() : null,
    flexibleSpace: childId >= 0
        ? FlexibleSpaceBar(
            background: SkalNode(
                nodeId: childId,
                bridge: bridge,
                key: ValueKey<int>(childId)),
          )
        : null,
  );
}

/// `<sliverList>` → Flutter `SliverList`, lazily built — only the
/// on-screen rows materialise. Valid only inside `<customScrollView>`.
Widget _buildSliverList(NodeState n, SkalBridge bridge) {
  return SliverList(
    delegate: SliverChildBuilderDelegate(
      (_, i) {
        final id = n.childAt(i);
        return SkalNode(
            nodeId: id, bridge: bridge, key: ValueKey<int>(id));
      },
      childCount: n.childCount,
    ),
  );
}

/// `<sliverGrid>` → Flutter `SliverGrid`, lazily built. Reuses the
/// `crossAxisCount` / `aspectRatio` / `gap` props of `<lazyGrid>`.
Widget _buildSliverGrid(NodeState n, SkalBridge bridge) {
  final cross = n.getPropU32(propCrossAxisCount, 2);
  final ratio = n.getPropF32(propAspectRatio, 1.0);
  final gap = n.getPropU32(propGap, 8).toDouble();
  return SliverGrid(
    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: cross < 1 ? 1 : cross,
      childAspectRatio: ratio <= 0 ? 1.0 : ratio,
      mainAxisSpacing: gap,
      crossAxisSpacing: gap,
    ),
    delegate: SliverChildBuilderDelegate(
      (_, i) {
        final id = n.childAt(i);
        return SkalNode(
            nodeId: id, bridge: bridge, key: ValueKey<int>(id));
      },
      childCount: n.childCount,
    ),
  );
}

// ── Canvas — CustomPaint / arbitrary 2-D drawing ──────────────────

/// `<canvas>` → Flutter `CustomPaint`. The draw program — a JSON list
/// of paint commands recorded by the JS `draw(ctx)` callback — arrives
/// in `n.text` over the ordinary opSetText channel. `width` / `height`
/// size the paint surface (default 100×100 if unset).
Widget _buildCanvas(NodeState n) {
  final wRaw = n.getPropU32(propWidth, kNoValue);
  final hRaw = n.getPropU32(propHeight, kNoValue);
  final w = (wRaw > 0 && wRaw < kWrapContent) ? wRaw.toDouble() : 100.0;
  final h = (hRaw > 0 && hRaw < kWrapContent) ? hRaw.toDouble() : 100.0;
  Widget inner = CustomPaint(size: Size(w, h), painter: _SkalPainter(n.text));
  inner = _applyColdVisual(n, inner);
  return _hotLayer(node: n, child: inner);
}

double _canvasD(dynamic v) => v is num ? v.toDouble() : 0.0;
int _canvasI(dynamic v) => v is num ? v.toInt() : 0;

void _paintCanvasText(Canvas canvas, String text, double x, double y,
    Color color, double size) {
  final tp = TextPainter(
    text: TextSpan(text: text, style: TextStyle(color: color, fontSize: size)),
    textDirection: TextDirection.ltr,
  )..layout();
  tp.paint(canvas, Offset(x, y));
}

/// Replays a `<canvas>` draw program onto a Flutter `Canvas`. The
/// program is the JSON command list from the JS recorder. It's parsed
/// ONCE (lazily, cached on the painter instance — a new painter is
/// built per program change), and `shouldRepaint` gates repaints to
/// real program changes, so a static drawing never re-parses or
/// re-paints after its first frame. Replaying a command list is fast
/// and entirely host-side — zero per-frame bridge traffic.
class _SkalPainter extends CustomPainter {
  _SkalPainter(this.program);
  final String program;
  List<dynamic>? _cmds;

  @override
  void paint(Canvas canvas, Size size) {
    if (program.isEmpty) return;
    final cmds = _cmds ??= () {
      try {
        final d = jsonDecode(program);
        return d is List ? d : const <dynamic>[];
      } catch (_) {
        return const <dynamic>[];
      }
    }();

    final fill = Paint()..style = PaintingStyle.fill;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    Path path = Path();
    double fontSize = 14.0;

    for (final c in cmds) {
      if (c is! List || c.isEmpty) continue;
      switch (c[0]) {
        case 'fillStyle':
          fill.color = _argb(_canvasI(c[1]));
          break;
        case 'strokeStyle':
          stroke.color = _argb(_canvasI(c[1]));
          break;
        case 'lineWidth':
          stroke.strokeWidth = _canvasD(c[1]);
          break;
        case 'fillRect':
          canvas.drawRect(
              Rect.fromLTWH(_canvasD(c[1]), _canvasD(c[2]), _canvasD(c[3]),
                  _canvasD(c[4])),
              fill);
          break;
        case 'strokeRect':
          canvas.drawRect(
              Rect.fromLTWH(_canvasD(c[1]), _canvasD(c[2]), _canvasD(c[3]),
                  _canvasD(c[4])),
              stroke);
          break;
        case 'circle':
          path.addOval(Rect.fromCircle(
              center: Offset(_canvasD(c[1]), _canvasD(c[2])),
              radius: _canvasD(c[3])));
          break;
        case 'line':
          canvas.drawLine(Offset(_canvasD(c[1]), _canvasD(c[2])),
              Offset(_canvasD(c[3]), _canvasD(c[4])), stroke);
          break;
        case 'beginPath':
          path = Path();
          break;
        case 'moveTo':
          path.moveTo(_canvasD(c[1]), _canvasD(c[2]));
          break;
        case 'lineTo':
          path.lineTo(_canvasD(c[1]), _canvasD(c[2]));
          break;
        case 'closePath':
          path.close();
          break;
        case 'fill':
          canvas.drawPath(path, fill);
          break;
        case 'stroke':
          canvas.drawPath(path, stroke);
          break;
        case 'fontSize':
          fontSize = _canvasD(c[1]);
          break;
        case 'fillText':
          _paintCanvasText(canvas, '${c[1]}', _canvasD(c[2]), _canvasD(c[3]),
              fill.color, fontSize);
          break;
      }
    }
  }

  @override
  bool shouldRepaint(_SkalPainter oldDelegate) =>
      oldDelegate.program != program;
}

// ── Drag-and-drop — Draggable / DragTarget ────────────────────────

/// `<dragItem>` → Flutter `Draggable<String>`. Wraps its single child;
/// `propDragData` is the string payload delivered to whichever
/// `<dropZone>` the item is released over. A floating feedback follows
/// the pointer during the drag; the in-place copy ghosts to 30%.
Widget _buildDragItem(NodeState n, SkalBridge bridge) {
  final childId = n.hasChildren ? n.childAt(0) : -1;
  if (childId < 0) return const SizedBox.shrink();
  final data = n.getPropStr(propDragData) ?? '';
  Widget node() => SkalNode(nodeId: childId, bridge: bridge);
  Widget inner = Draggable<String>(
    data: data,
    // feedback rides in the app Overlay — Material gives it a text
    // style + lets it paint above everything.
    feedback: Material(color: Colors.transparent, child: node()),
    childWhenDragging: Opacity(opacity: 0.3, child: node()),
    child: node(),
  );
  inner = _applyColdVisual(n, inner);
  return _hotLayer(node: n, child: inner);
}

/// `<dropZone>` → Flutter `DragTarget<String>`. When a `<dragItem>` is
/// released over it, `onDrop` fires with the item's `dragData`. While
/// an item hovers the zone draws a faint highlight — entirely
/// host-side; nothing crosses the bridge until the actual drop.
Widget _buildDropZone(NodeState n, SkalBridge bridge) {
  final handler = n.onDropHandlerId;
  final childId = n.hasChildren ? n.childAt(0) : -1;
  final Widget content = childId >= 0
      ? SkalNode(nodeId: childId, bridge: bridge)
      : const SizedBox.shrink();
  Widget inner = DragTarget<String>(
    onAcceptWithDetails: (details) {
      if (handler != 0) {
        bridge.dispatchEventStr(handler, details.data, eventKind: evDrop);
      }
    },
    builder: (context, candidate, rejected) {
      // Structurally STABLE — the DecoratedBox is always present, only
      // its decoration toggles. Conditionally inserting/removing the
      // box would re-parent (and so rebuild) the child subtree on
      // every hover in / out. An empty BoxDecoration paints nothing.
      return DecoratedBox(
        decoration: candidate.isEmpty
            ? const BoxDecoration()
            : BoxDecoration(
                color: const Color(0x1A0A84FF),
                border:
                    Border.all(color: const Color(0x880A84FF), width: 2),
              ),
        child: content,
      );
    },
  );
  inner = _applyColdVisual(n, inner);
  return _hotLayer(node: n, child: inner);
}

// ── Hero — shared-element transitions ─────────────────────────────

/// `<hero tag="…">` → Flutter `Hero`. Two `<hero>` nodes carrying the
/// same `tag`, one on each route, fly into each other across a
/// navigator push/pop — the flight is GPU-composited, host-side, with
/// zero bridge traffic. ANIMATION.md §8.
///
/// An empty `tag` degrades to a plain passthrough (no Hero), so a
/// `<hero>` with no tag set yet never trips Flutter's
/// "tag must not be null" assert.
Widget _buildHero(NodeState n, SkalBridge bridge) {
  final children = _childWidgets(n, bridge);
  final Widget content = children.isEmpty
      ? const SizedBox.shrink()
      : (children.length == 1 ? children.first : Stack(children: children));
  final tag = n.getPropStr(propHeroTag);
  if (tag == null || tag.isEmpty) {
    return _hotLayer(node: n, child: content);
  }
  return _hotLayer(node: n, child: Hero(tag: tag, child: content));
}

// ── Animated list / cross-fade ────────────────────────────────────

/// `<crossFade>` → `AnimatedSwitcher`. Holds one child; when that
/// child's node id changes the old fades out while the new fades in.
/// `AnimatedSwitcher` retains the outgoing child's element for the
/// fade (it never rebuilds it), so the child whose `NodeState` the
/// bridge disposed in this same drain keeps painting its last frame as
/// it fades — no deferred teardown needed. ANIMATION.md §7.
Widget _buildCrossFade(NodeState n, SkalBridge bridge) {
  final width = n.getPropU32(propWidth, kNoValue);
  final height = n.getPropU32(propHeight, kNoValue);
  final durMs = n.getPropU32(propAnimDuration, 0);

  final childId = n.hasChildren ? n.childAt(0) : -1;
  final Widget current = childId >= 0
      ? SkalNode(nodeId: childId, bridge: bridge, key: ValueKey<int>(childId))
      : const SizedBox.shrink(key: ValueKey<int>(0));

  Widget inner = AnimatedSwitcher(
    duration: Duration(milliseconds: durMs > 0 ? durMs : 250),
    switchInCurve: _resolveCurve(n),
    child: current,
  );
  inner = _applyColdVisual(n, inner);
  inner = _applyHeight(height, _applyWidth(width, inner));
  return _hotLayer(node: n, child: inner);
}

/// `<animatedList>` → a column of children that animates both insertion
/// and removal. A newly-inserted child fades + expands in; a removed
/// child collapses + fades out, then the bridge tears it down. The
/// initial batch mounts without animation. ANIMATION.md §6.
///
/// Removal works via deferred teardown: `opRemoveNode` parks a removed
/// child in `node.leavingChildren` (NodeState kept alive) instead of
/// destroying it; this host plays the exit on the still-live subtree,
/// then calls `bridge.finalizeLeavingNode` post-frame.
///
/// For long feeds use `<listView>`; this is for short, mutating lists
/// (every row is built and carries an `AnimationController`).
Widget _buildAnimatedList(NodeState n, SkalBridge bridge) {
  return _SkalAnimatedList(node: n, bridge: bridge);
}

class _SkalAnimatedList extends StatefulWidget {
  final NodeState node;
  final SkalBridge bridge;
  const _SkalAnimatedList({required this.node, required this.bridge});

  @override
  State<_SkalAnimatedList> createState() => _SkalAnimatedListState();
}

class _SkalAnimatedListState extends State<_SkalAnimatedList> {
  // Child ids rendered at least once — anything absent is new and
  // earns a one-shot enter animation.
  final Set<int> _seen = <int>{};
  // Leaving ids whose exit animation has finished — `build` skips them
  // until `finalizeLeavingNode` drops them from `node.leavingChildren`.
  final Set<int> _done = <int>{};
  bool _first = true;

  /// A row's exit animation finished. Stop rendering it THIS frame (so
  /// its `SkalNode` element unmounts and drops its `cold` listener),
  /// then tear the node down post-frame — strictly after the unmount,
  /// so the `NodeState` is never disposed while still listened-to.
  void _onExited(int id) {
    if (!mounted) return;
    setState(() => _done.add(id));
    final bridge = widget.bridge;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      bridge.finalizeLeavingNode(id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final n = widget.node;
    final bridge = widget.bridge;
    final gap = n.getPropU32(propGap, 8).toDouble();
    final durMs = n.getPropU32(propAnimDuration, 0);
    final dur = Duration(milliseconds: durMs > 0 ? durMs : 280);
    final curve = _resolveCurve(n);

    final present = n.childIds.toList();
    final leaving = n.leavingChildren;

    // Render order: present children, with each leaving (exiting) child
    // spliced back in at the index it was removed from — so it collapses
    // in place while the rows below slide up.
    final order = List<int>.from(present);
    if (leaving != null && leaving.isNotEmpty) {
      final ls = leaving.entries.toList()
        ..sort((a, b) => a.value.compareTo(b.value));
      for (final e in ls) {
        order.insert(e.value.clamp(0, order.length), e.key);
      }
    }

    final items = <Widget>[];
    for (final id in order) {
      if (_done.contains(id)) continue;
      if (bridge.nodes[id] == null) continue;
      final isNew = !_seen.contains(id);
      _seen.add(id);
      items.add(_AnimatedListEntry(
        key: ValueKey<int>(id),
        animateIn: isNew && !_first,
        leaving: leaving != null && leaving.containsKey(id),
        duration: dur,
        curve: curve,
        gap: gap,
        onExited: () => _onExited(id),
        child: SkalNode(nodeId: id, bridge: bridge),
      ));
    }
    _first = false;

    // Keep the bookkeeping sets bounded — ids never reappear.
    final live = <int>{...present, if (leaving != null) ...leaving.keys};
    if (_seen.length > live.length) _seen.retainAll(live);
    if (_done.isNotEmpty) _done.retainWhere(live.contains);

    Widget col = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: items,
    );
    final pad = _paddingFor(n, 16);
    if (pad != null) col = Padding(padding: pad, child: col);
    return _hotLayer(node: n, child: _applyColdVisual(n, col));
  }
}

/// One `<animatedList>` row. A *new* id runs a one-shot enter animation
/// (`SizeTransition` expand + `FadeTransition`); when the host flips
/// `leaving` true the same animation reverses into an exit collapse,
/// and `onExited` fires once it is fully dismissed. The trailing `gap`
/// lives inside the row so it collapses with it on exit.
class _AnimatedListEntry extends StatefulWidget {
  final Widget child;
  final bool animateIn;
  final bool leaving;
  final Duration duration;
  final Curve curve;
  final double gap;
  final VoidCallback onExited;
  const _AnimatedListEntry({
    super.key,
    required this.child,
    required this.animateIn,
    required this.leaving,
    required this.duration,
    required this.curve,
    required this.gap,
    required this.onExited,
  });

  @override
  State<_AnimatedListEntry> createState() => _AnimatedListEntryState();
}

class _AnimatedListEntryState extends State<_AnimatedListEntry>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final CurvedAnimation _curved;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: widget.duration,
      value: widget.animateIn ? 0.0 : 1.0,
    );
    _curved = CurvedAnimation(parent: _c, curve: widget.curve);
    _c.addStatusListener(_onStatus);
    if (widget.leaving) {
      _c.reverse();
    } else if (widget.animateIn) {
      _c.forward();
    }
  }

  @override
  void didUpdateWidget(_AnimatedListEntry oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.leaving && !oldWidget.leaving) {
      _c.reverse(); // present → leaving: collapse + fade out
    }
  }

  void _onStatus(AnimationStatus s) {
    if (s == AnimationStatus.dismissed && widget.leaving) {
      widget.onExited();
    }
  }

  @override
  void dispose() {
    _c.removeStatusListener(_onStatus);
    _curved.dispose();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizeTransition(
      sizeFactor: _curved,
      axisAlignment: -1.0,
      child: FadeTransition(
        opacity: _curved,
        child: Padding(
          padding: EdgeInsets.only(bottom: widget.gap),
          child: widget.child,
        ),
      ),
    );
  }
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
