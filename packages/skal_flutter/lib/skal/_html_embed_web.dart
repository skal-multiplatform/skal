// Flutter Web implementation of `<HtmlEmbed viewType="…"/>`.
//
// Renders Flutter's `HtmlElementView`, which punches a rectangle in
// the CanvasKit canvas and composites a real DOM element (built by
// the JS-side factory registered via `registerHtmlView`) at that
// position. Pointer events, scroll, text selection, ARIA all stay
// live on the embedded DOM.
//
// The DOM element factory is installed by main_web.dart's
// `_installHtmlEmbedHooks` — which on the first registerHtmlView
// call from JS wires `ui_web.platformViewRegistry.registerViewFactory`
// for that viewType to call back into JS's `__skalCreateHtmlViewElement`
// to build the actual DOM. We just render the view here.

import 'package:flutter/widgets.dart';

Widget buildHtmlEmbed(String viewType) {
  if (viewType.isEmpty) {
    // Empty viewType — nothing to mount. Render a 0×0 placeholder so
    // the surrounding layout doesn't see anything weird.
    return const SizedBox.shrink();
  }
  return HtmlElementView(viewType: viewType);
}
