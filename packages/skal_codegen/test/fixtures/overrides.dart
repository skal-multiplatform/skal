// Fixture for B4 — per-param overrides.
//
// `Tiles` is the shape that loses whole packages today: twenty
// perfectly mappable props plus one exotic required type. Without an
// escape valve the required `provider` skips the entire widget and the
// dev gets a build warning instead of a component.
//
// `builder` is the optional-but-unmappable case: the widget survives
// today by silently omitting it, and `ignore: true` makes that
// omission explicit and greppable.

// Uses the fake-Flutter shim, same as every other fixture — the
// codegen package is pure Dart and deliberately doesn't depend on the
// Flutter SDK.
import '_fake_flutter.dart';

/// Not reconstructable from bridge props — the stand-in for
/// flutter_map's TileProvider.
///
/// The `dispose()` is what makes it unmappable: `_looksStateful`
/// rejects anything that owns a resource, which is exactly right and
/// exactly why an escape valve is needed for the cases where the dev
/// knows a fixed instance is fine.
class TileSource {
  TileSource(this.endpoint);
  final String endpoint;
  void dispose() {}
}

class Tiles extends StatelessWidget {
  const Tiles({
    required this.provider,
    this.urlTemplate = '',
    this.maxZoom = 18.0,
    this.retina = false,
    this.builder,
  });

  final TileSource provider;
  final String urlTemplate;
  final double maxZoom;
  final bool retina;
  final Widget Function(BuildContext, Widget)? builder;

  @override
  Widget build(BuildContext context) => Text(urlTemplate);
}

/// B2 — indexed builder params. `rowBuilder` is the shape the protocol
/// handles; `decorator` is the shape it must refuse, because there is
/// no index to key a subtree by.
class Feed extends StatelessWidget {
  const Feed({
    required this.count,
    required this.rowBuilder,
    this.decorator,
  });

  final int count;
  final Widget Function(BuildContext, int) rowBuilder;
  final Widget Function(BuildContext, Widget)? decorator;

  @override
  Widget build(BuildContext context) => rowBuilder(context, 0);
}

/// B3 — a widget with a controller param. `hosts:` handles this per
/// WIDGET by synthesizing a StatefulWidget around a dev-written
/// factory; the handle route handles it per PARAM, with JS owning the
/// controller's lifetime.
class Playback extends StatelessWidget {
  const Playback({required this.controller, this.muted = false, this.overlay});

  final PlaybackController controller;
  final bool muted;

  /// A Widget param — mappable as a child node, and therefore NOT
  /// something a handle can stand in for. Marking it `handle: true`
  /// must be refused.
  final Widget? overlay;

  @override
  Widget build(BuildContext context) => const Text('');
}

class PlaybackController {
  PlaybackController(this.url);
  final String url;
  void dispose() {}
}
