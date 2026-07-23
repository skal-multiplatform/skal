// Dev-provided capability class for the codegen SERVICE pattern
// (`services:` in lib/skal_codegen.yaml — Roadmap A2).
//
// What this file is:
//
//   Clipboard and haptics are capabilities #10 and #11 in
//   docs/NATIVE_SUPPORT.md, and both are pure Flutter SDK — zero pub
//   dependencies. They are also not widget-shaped: there is nothing to
//   mount, so `hosts:` and the regular widget walk have nothing to say
//   about them.
//
//   A service is the answer. Codegen walks the STATIC methods of the
//   class named in `services:` and emits one `registerService`
//   dispatcher, which JS reaches as:
//
//     const dev = createSkalService('device');
//     await dev.copy('hello');
//     await dev.paste();          // 'hello'
//     await dev.tap();            // selection click
//
//   Unlike `hosts:`, no factory function is needed — a static method
//   has no constructor to carry across the bridge.
//
// What the dev has to write (this file):
//
//   Only the parts that are genuinely app-specific: which SDK calls to
//   expose, and what shape their results should take. The dispatcher,
//   argument decoding, result encoding, and registration are generated.
//
// Why a wrapper class at all, rather than pointing `services:` straight
// at `Clipboard`?
//
//   Two reasons, both about the API JS actually sees. First,
//   `Clipboard.getData('text/plain')` returns `ClipboardData?`, whose
//   useful content is one nullable field — a JS caller wants the string.
//   Second, and more important: `docs/PERFORMANCE.md` measures a
//   one-shot RPC at one frame (16.67 ms), so `await clip.getData()` then
//   `.text` in JS would be a frame for a field access. Collapsing the
//   pair into one method here is the difference between one frame and
//   two.

import 'package:flutter/services.dart';

/// Clipboard + haptics, exposed to JS as the `device` service.
class DeviceService {
  /// Read the clipboard as plain text. Returns `''` rather than null
  /// when the clipboard is empty or holds a non-text flavour — a JS
  /// caller almost always wants to render the result, and `''` renders.
  static Future<String> paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    return data?.text ?? '';
  }

  /// Write plain text to the clipboard.
  static Future<void> copy(String text) =>
      Clipboard.setData(ClipboardData(text: text));

  /// Selection-click haptic — the light one, for list/segment changes.
  static Future<void> tap() => HapticFeedback.selectionClick();

  /// Impact haptic. [strength] 0 = light, 1 = medium, 2 = heavy;
  /// anything else clamps. An int rather than an enum so the JS call
  /// site stays `dev.impact(2)` with no shared vocabulary to keep in
  /// sync across the two languages.
  static Future<void> impact(int strength) {
    switch (strength) {
      case 0:
        return HapticFeedback.lightImpact();
      case 2:
        return HapticFeedback.heavyImpact();
      default:
        return HapticFeedback.mediumImpact();
    }
  }

  /// Long-press style vibration.
  static Future<void> vibrate() => HapticFeedback.vibrate();
}
