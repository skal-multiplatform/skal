// Hand-written escape-hatch adapter for the `shimmer` package's
// `Shimmer` widget.
//
// Why this is hand-written and not codegen-emitted:
//
//   `Shimmer`'s default constructor requires a `Gradient gradient`
//   parameter. Gradient is a complex Flutter class that skal_codegen
//   doesn't yet know how to encode over the bridge — so the build_runner
//   pass surfaces:
//
//     [WARNING] skal_codegen: skipped Shimmer — required param
//     'gradient' has unsupported type 'Gradient'. Write a manual
//     SkalRegistry.registerWidget call to wrap it.
//
//   The fix isn't "make codegen handle Gradient" — most devs using
//   Shimmer don't construct one manually. They use the package's
//   `Shimmer.fromColors` NAMED constructor, which derives a
//   LinearGradient internally from a base + highlight Color. That's
//   the natural API for JSX-driven usage.
//
//   The codegen MVP only walks default (unnamed) constructors; named
//   constructors are their own gap. Until that lands, packages with a
//   "convenient named constructor" pattern get a 10-line manual
//   wrapper. Tiny by design — codegen's contribution is making
//   primitive-only widgets free, so the manual cases that remain are
//   the ones genuinely worth thinking about.
//
// What this provides:
//
//   `<Shimmer baseColor={0xFFBDBDBD} highlightColor={0xFFE0E0E0}
//             period={1500}>...child...</Shimmer>`
//
//   — wraps whatever JSX child in a shimmering gradient animation.
//   Defaults match Material's grey-on-light-grey shimmer commonly
//   seen in skeleton-loader UIs.

import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../skal/bridge.dart';
import '../skal/node_state.dart';
import '../skal/registry.dart';
import '../skal/root.dart';

Widget _buildShimmer(NodeState n, SkalBridge bridge) {
  // Child resolution mirrors what the codegen-emitted Widget-child
  // encoding produces — SkalNode wraps the first JSX child, falls
  // back to SizedBox.shrink if none. Same behaviour as any other
  // widget-child param the codegen handles.
  final child = n.childCount > 0
      ? SkalNode(
          nodeId: n.childAt(0),
          bridge: bridge,
          key: ValueKey<int>(n.childAt(0)),
        )
      : const SizedBox.shrink();

  return Shimmer.fromColors(
    baseColor: Color(n.getCustomPropU32('baseColor', 0xFFBDBDBD)),
    highlightColor:
        Color(n.getCustomPropU32('highlightColor', 0xFFE0E0E0)),
    period: Duration(
        milliseconds: n.getCustomPropU32('period', 1500)),
    enabled: n.getCustomPropU32('enabled', 1) != 0,
    // `loop` defaults to 0 in the package, meaning "loop forever".
    // Keep that default — devs who want a finite loop pass an int.
    loop: n.getCustomPropU32('loop', 0),
    child: child,
  );
}

/// Mirrors the shape codegen produces — one `registerAll()` per
/// adapter module so main.dart can call them uniformly.
void registerAll() {
  SkalRegistry.registerWidget('shimmer', _buildShimmer);
}
