// Flutter Web has no general filesystem access — browsers can't open
// arbitrary local paths. `file://` and absolute paths from JSX
// `<image src="…">` are silently dropped (the renderer treats them as
// no-source and skips painting); native targets get the real FileImage
// via `_file_image_io.dart`.

import 'package:flutter/widgets.dart';

// Apps that put a `file://` or absolute path in `<image src>` on web
// have already opted out of cross-target behavior — silently dropping
// to null lets the renderer paint nothing without crashing the tree.
ImageProvider? fileImageFromPath(String path) => null;
