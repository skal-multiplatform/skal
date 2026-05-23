// Fixture file #2 — a second Widget in the same fake package.
//
// Different param mix from `badge.dart`: a bool + a double (vs an
// int + a String). Confirms the codegen picks the right encoding
// per param regardless of file boundary.

import '../_fake_flutter.dart';

class Panel extends StatelessWidget {
  final String title;
  final bool collapsed;
  final double padding;

  const Panel({
    super.key,
    this.title = 'Untitled',
    this.collapsed = false,
    this.padding = 8.0,
  });

  @override
  Widget build(BuildContext context) => Text(title);
}
