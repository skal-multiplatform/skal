// Native (non-web) fallback for `<HtmlEmbed viewType="…"/>`.
//
// The intrinsic exists to host third-party JS widgets (Stripe
// Elements, OAuth iframes, browser-native form controls) — all
// inherently web-only. On native there's no equivalent, so we render
// a visible placeholder so apps that share JSX across targets can SEE
// where their HtmlEmbed regions would be. Apps that care about layout
// flow can gate `<HtmlEmbed>` behind an `IS_WEB_DOM`-style flag (or
// `kIsWeb`) and skip mounting it on native.

import 'package:flutter/widgets.dart';

/// Placeholder red. Was written as `Color(0xFFD33)` — CSS `#D33` with
/// an `FF` alpha in front, which is not how an ARGB literal parses:
/// Dart read it as `0x000FFD33`, i.e. **alpha 0x00**. Both the border
/// and the label below were fully transparent, so the "visible
/// placeholder" this file exists to draw rendered as an empty pink box.
/// Caught by `use_full_hex_values_for_flutter_colors`, which is exactly
/// the mistake that lint is for.
const Color _placeholderRed = Color(0xFFDD3333);

Widget buildHtmlEmbed(String viewType) {
  return Container(
    decoration: BoxDecoration(
      color: const Color(0xFFFFF5F5),
      border: Border.all(
          color: _placeholderRed, width: 1, style: BorderStyle.solid),
    ),
    padding: const EdgeInsets.all(8),
    alignment: Alignment.center,
    child: Text(
      '<HtmlEmbed viewType="$viewType">\n(web-only intrinsic)',
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: _placeholderRed,
        fontSize: 11,
        fontFamily: 'monospace',
      ),
    ),
  );
}
