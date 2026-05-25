// `_imageProviderFor` (root.dart) needs to produce a `FileImage` from
// a path on native. The class FileImage is part of flutter/widgets,
// but constructing it requires dart:io's File — which isn't available
// on Flutter Web. This shim is the io half; the web half
// (`_file_image_web.dart`) returns null for the file:// / absolute-path
// cases since browsers have no general filesystem access anyway.

import 'dart:io';
import 'package:flutter/widgets.dart';

ImageProvider? fileImageFromPath(String path) => FileImage(File(path));
