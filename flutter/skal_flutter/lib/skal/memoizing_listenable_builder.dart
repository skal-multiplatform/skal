// Like `ListenableBuilder`, but **only re-runs `builder` when the
// listenable has actually fired since the last build.**
//
// Standard `ListenableBuilder` re-runs its builder closure whenever
// Flutter cascades a rebuild from above — parent's setState fires, the
// parent rebuilds, all its descendants' builders run too. For Skal's
// per-node listenables that's wasted work: an unchanged Text leaf
// doesn't need to re-run its builder just because a sibling somewhere
// above triggered a rebuild for an unrelated reason.
//
// This widget caches the last-built subtree and returns it unchanged
// when its `listenable` hasn't notified since the previous build.
// Flutter's element tree honors widget identity for skip-rebuild, so
// the cached subtree is reused without re-walking.
//
// `didChangeDependencies` invalidates the cache, so InheritedWidget
// changes (Theme, MediaQuery, etc.) still propagate.
//
// Same pattern as `flutter_app/lib/widgets/memoizing_listenable_builder.dart`
// in the `skol/` prior prototype. Extracted as a reusable widget here
// (was previously inlined into `_SkalNodeState`) so any code that needs
// the listenable-driven caching can use it directly, and so theme /
// MediaQuery dependence propagates correctly.

import 'package:flutter/widgets.dart';

class MemoizingListenableBuilder extends StatefulWidget {
  const MemoizingListenableBuilder({
    super.key,
    required this.listenable,
    required this.builder,
  });

  final Listenable listenable;
  final WidgetBuilder builder;

  @override
  State<MemoizingListenableBuilder> createState() =>
      _MemoizingListenableBuilderState();
}

class _MemoizingListenableBuilderState
    extends State<MemoizingListenableBuilder> {
  Widget? _cached;
  bool _dirty = true;

  @override
  void initState() {
    super.initState();
    widget.listenable.addListener(_onChanged);
  }

  @override
  void didUpdateWidget(MemoizingListenableBuilder oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.listenable != widget.listenable) {
      oldWidget.listenable.removeListener(_onChanged);
      widget.listenable.addListener(_onChanged);
      _dirty = true;
    }
    // Intentionally NOT comparing builder closures: every parent rebuild
    // creates a new closure object (Dart compares by reference), so doing
    // so would invalidate the cache on every cascade — exactly the
    // behavior we're trying to avoid. Callers are responsible for firing
    // the listenable when the data the builder reads from changes.
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _dirty = true;
  }

  @override
  void dispose() {
    widget.listenable.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (!mounted) return;
    setState(() => _dirty = true);
  }

  @override
  Widget build(BuildContext context) {
    if (_dirty || _cached == null) {
      _cached = widget.builder(context);
      _dirty = false;
    }
    return _cached!;
  }
}
