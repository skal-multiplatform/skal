// Flutter Web has no general filesystem access — browsers can't open
// arbitrary local paths. `file://` and absolute paths from JSX
// `<image src="…">` are silently dropped (the renderer treats them as
// no-source and skips painting); native targets get the real FileImage
// via `_file_image_io.dart`.

import 'package:flutter/widgets.dart';

ImageProvider? fileImageFromPath(String path) {
  // eslint-disable-next-line no-console
  // dart:developer log would be the right channel for this, but a
  // no-op silence is fine — apps that put a file:// in <image src> on
  // web have already opted out of cross-target behavior.
  return null;
}
