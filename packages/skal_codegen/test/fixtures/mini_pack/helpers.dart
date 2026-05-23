// Fixture file #3 — NOT a Widget. Just helpers / utility functions.
//
// In real packages most files won't contain Widget classes — they'll
// have plain Dart classes, enums, top-level functions, theme data,
// etc. The codegen has to walk these without erroring or emitting
// anything for them.
//
// This file's presence in the snapshot test confirms the walk skips
// non-Widget files silently.

class BadgeMetadata {
  final String version;
  const BadgeMetadata(this.version);
}

String formatVersion(BadgeMetadata md) => 'v${md.version}';
