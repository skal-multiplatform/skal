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

Widget buildHtmlEmbed(String viewType) {
  return Container(
    decoration: BoxDecoration(
      color: const Color(0xFFFFF5F5),
      border: Border.all(color: const Color(0xFFD33), width: 1, style: BorderStyle.solid),
    ),
    padding: const EdgeInsets.all(8),
    alignment: Alignment.center,
    child: Text(
      '<HtmlEmbed viewType="$viewType">\n(web-only intrinsic)',
      textAlign: TextAlign.center,
      style: const TextStyle(
        color: Color(0xFFD33),
        fontSize: 11,
        fontFamily: 'monospace',
      ),
    ),
  );
}
