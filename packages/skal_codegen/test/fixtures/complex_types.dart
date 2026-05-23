// Test fixture for complex-type codegen support — enums + Duration.
//
// `Banner` exercises:
//   • An enum-typed param with an enum default (`BannerStyle.info`)
//   • A Duration-typed param with a Duration default
//     (`Duration(milliseconds: 500)`)
//   • A plain primitive (String) alongside, so the test confirms the
//     mixed-type encoding path doesn't accidentally regress primitives.
//
// The enum is declared locally rather than importing `package:flutter/material.dart`'s
// `BoxFit` so the test stays self-contained (works without a real
// Flutter dev_dependency on the codegen package).

import '_fake_flutter.dart';

enum BannerStyle { info, warning, error }

class Banner extends StatelessWidget {
  final String message;
  final BannerStyle style;
  final Duration dismissAfter;
  final EdgeInsets padding;

  const Banner({
    super.key,
    this.message = '',
    this.style = BannerStyle.info,
    this.dismissAfter = const Duration(milliseconds: 500),
    // Asymmetric default so the snapshot test confirms each side
    // gets its own value from constant evaluation rather than a
    // single shared fallback.
    this.padding = const EdgeInsets.fromLTRB(4, 8, 4, 8),
  });

  @override
  Widget build(BuildContext context) => Text(message);
}
