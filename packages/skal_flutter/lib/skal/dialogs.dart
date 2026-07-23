// Imperative dialog / sheet / snackbar API — FLUTTER_JS_COMPONENTS.md
// §10.2.
//
// Dialogs are not tree nodes — they are an imperative surface. JS
// calls `showDialog(spec)` / `showActionSheet(spec)` /
// `showSnackbar(spec)`; those cross the bridge as RPC method
// invocations on the ROOT node, handled by the app-level dispatcher
// installed here. The whole transport (callId correlation, the reply
// heap, async Futures) is the existing host-RPC machinery — this file
// only adds a new *consumer* of it.
//
// Phase 1 — declarative content only. The JS side passes a spec
// `{title, message, actions:[{label, value, style}]}`; this builds a
// stock AlertDialog / CupertinoAlertDialog (variant per the active
// design system). The Promise resolves with the chosen action's
// `value`, or null on a barrier dismiss.

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Directory;

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';

import 'bridge.dart';
import 'services.dart';

/// Navigator handle so dialog code can run without a widget
/// `BuildContext`. main.dart wires this into the `MaterialApp`.
final GlobalKey<NavigatorState> skalNavigatorKey =
    GlobalKey<NavigatorState>();

/// ScaffoldMessenger handle for context-free snackbars.
final GlobalKey<ScaffoldMessengerState> skalScaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

/// Register the app-level RPC dispatcher. JS `showDialog` /
/// `showActionSheet` / `showSnackbar` calls arrive as RPC invocations
/// on `kRootNodeId`.
///
/// The dispatcher is stored on the bridge (`rootDispatcher`), whose
/// setter also attaches it to the current root node; `opCreateNode`
/// re-attaches on any future root recreation. Safe to call regardless
/// of whether the root node exists yet.
///
/// Anything this switch doesn't recognize falls through to the service
/// registry (skal/services.dart), so `registerService('geo', …)` needs
/// no changes here and no changes in the app's `main.dart`.
void installAppDispatcher(SkalBridge bridge) {
  registerBuiltinServices();
  bridge.rootDispatcher = (method, args) {
    if (isServiceMethod(method)) return dispatchService(method, args);
    final spec = _decodeSpec(args);
    switch (method) {
      case 'showDialog':
        return _showDialog(bridge, spec);
      case 'showActionSheet':
        return _showActionSheet(bridge, spec);
      case 'showSnackbar':
        return _showSnackbar(spec);
      case 'showDatePicker':
        return _showDatePicker(bridge, spec);
      case 'showTimePicker':
        return _showTimePicker(bridge, spec);
      case 'getDataDir':
        return _getDataDir();
      default:
        throw 'skal: unknown app method "$method"';
    }
  };
}

/// The JS side ships the spec as a single JSON STRING arg — kept on
/// the string shape deliberately, because every host version can
/// decode it (an old host reads an object arg as null, and JS hot
/// reload routinely pairs a new bundle with an old host). The Map
/// branch below exists because the wire also supports real object
/// args now (`eventArgJson`), and a future caller may use them.
Map<String, dynamic> _decodeSpec(List<Object?> args) {
  if (args.isEmpty) return const {};
  final raw = args.first;
  if (raw is Map) return raw.cast<String, dynamic>();
  if (raw is String && raw.isNotEmpty) {
    final decoded = jsonDecode(raw);
    if (decoded is Map) return decoded.cast<String, dynamic>();
  }
  return const {};
}

List<Map<String, dynamic>> _actions(Map<String, dynamic> spec) {
  final raw = spec['actions'];
  if (raw is! List) return const [];
  return [
    for (final a in raw)
      if (a is Map) a.cast<String, dynamic>(),
  ];
}

Future<Object?> _showDialog(SkalBridge bridge, Map<String, dynamic> spec) {
  final ctx = skalNavigatorKey.currentContext;
  if (ctx == null) return Future<Object?>.value();
  final title = spec['title'] as String?;
  final message = spec['message'] as String?;
  final actions = _actions(spec);

  if (bridge.isCupertino) {
    return showCupertinoDialog<Object?>(
      context: ctx,
      builder: (c) => CupertinoAlertDialog(
        title: title != null ? Text(title) : null,
        content: message != null ? Text(message) : null,
        actions: [
          for (final a in actions)
            CupertinoDialogAction(
              isDestructiveAction: a['style'] == 'destructive',
              onPressed: () => Navigator.of(c).pop(a['value']),
              child: Text(a['label']?.toString() ?? ''),
            ),
        ],
      ),
    );
  }
  return showDialog<Object?>(
    context: ctx,
    builder: (c) => AlertDialog(
      title: title != null ? Text(title) : null,
      content: message != null ? Text(message) : null,
      actions: [
        for (final a in actions)
          TextButton(
            onPressed: () => Navigator.of(c).pop(a['value']),
            child: Text(a['label']?.toString() ?? ''),
          ),
      ],
    ),
  );
}

Future<Object?> _showActionSheet(
    SkalBridge bridge, Map<String, dynamic> spec) {
  final ctx = skalNavigatorKey.currentContext;
  if (ctx == null) return Future<Object?>.value();
  final title = spec['title'] as String?;
  final actions = _actions(spec);

  if (bridge.isCupertino) {
    return showCupertinoModalPopup<Object?>(
      context: ctx,
      builder: (c) => CupertinoActionSheet(
        title: title != null ? Text(title) : null,
        actions: [
          for (final a in actions)
            CupertinoActionSheetAction(
              isDestructiveAction: a['style'] == 'destructive',
              onPressed: () => Navigator.of(c).pop(a['value']),
              child: Text(a['label']?.toString() ?? ''),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(c).pop(),
          child: const Text('Cancel'),
        ),
      ),
    );
  }
  return showModalBottomSheet<Object?>(
    context: ctx,
    builder: (c) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          for (final a in actions)
            ListTile(
              title: Text(a['label']?.toString() ?? ''),
              onTap: () => Navigator.of(c).pop(a['value']),
            ),
        ],
      ),
    ),
  );
}

Future<Object?> _showSnackbar(Map<String, dynamic> spec) {
  final message = spec['message'] as String? ?? '';
  skalScaffoldMessengerKey.currentState
      ?.showSnackBar(SnackBar(content: Text(message)));
  return Future<Object?>.value();
}

/// A writable data directory for the JS persistence store. The embedded
/// JS runtime's `os.tmpdir()` falls back to `/tmp` (its env carries no
/// `$TMPDIR`), which the macOS app sandbox forbids — so the store asks
/// the host, which resolves the real sandbox-container path via
/// `path_provider`. Returns the absolute path, or '' on failure.
Future<Object?> _getDataDir() async {
  try {
    final base = await getApplicationSupportDirectory();
    final dir = Directory('${base.path}/skal-store');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return dir.path;
  } catch (_) {
    return '';
  }
}

/// Parse an ISO `YYYY-MM-DD` (or full ISO-8601) string into a DateTime,
/// or null when absent / malformed.
DateTime? _parseIsoDate(Object? v) =>
    (v is String && v.isNotEmpty) ? DateTime.tryParse(v) : null;

/// `YYYY-MM-DD` — the wire shape the JS side both sends and receives.
String _isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// A Cupertino wheel picker in a bottom modal popup, with a
/// Cancel / Done bar. [pickerBuilder] receives the `onDateTimeChanged`
/// callback to wire into a `CupertinoDatePicker`; the latest value is
/// captured and returned when Done is tapped (null on Cancel / barrier
/// dismiss). Shared by the date and time variants.
Future<DateTime?> _cupertinoWheelPicker(
  BuildContext ctx,
  Widget Function(ValueChanged<DateTime>) pickerBuilder,
  DateTime initial,
) {
  DateTime selected = initial;
  return showCupertinoModalPopup<DateTime>(
    context: ctx,
    builder: (c) => Container(
      height: 300,
      color: CupertinoColors.systemBackground.resolveFrom(c),
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                CupertinoButton(
                  onPressed: () => Navigator.of(c).pop(),
                  child: const Text('Cancel'),
                ),
                CupertinoButton(
                  onPressed: () => Navigator.of(c).pop(selected),
                  child: const Text('Done'),
                ),
              ],
            ),
            Expanded(child: pickerBuilder((d) => selected = d)),
          ],
        ),
      ),
    ),
  );
}

/// Imperative date picker — §2. Spec: `{initialDate?, firstDate?,
/// lastDate?}` (all ISO `YYYY-MM-DD`). Resolves to an ISO date string,
/// or null on dismiss. Adaptive: Material `showDatePicker` calendar
/// dialog, or a `CupertinoDatePicker` wheel under Cupertino — matching
/// the adaptive `showDialog` / `showActionSheet` in this file.
Future<Object?> _showDatePicker(
    SkalBridge bridge, Map<String, dynamic> spec) async {
  final ctx = skalNavigatorKey.currentContext;
  if (ctx == null) return null;
  final now = DateTime.now();
  final first = _parseIsoDate(spec['firstDate']) ?? DateTime(now.year - 100);
  final last = _parseIsoDate(spec['lastDate']) ?? DateTime(now.year + 100);
  var initial = _parseIsoDate(spec['initialDate']) ?? now;
  // Both pickers assert initialDate ∈ [firstDate, lastDate].
  if (initial.isBefore(first)) initial = first;
  if (initial.isAfter(last)) initial = last;

  final DateTime? picked;
  if (bridge.isCupertino) {
    picked = await _cupertinoWheelPicker(
      ctx,
      (onChanged) => CupertinoDatePicker(
        mode: CupertinoDatePickerMode.date,
        initialDateTime: initial,
        minimumDate: first,
        maximumDate: last,
        onDateTimeChanged: onChanged,
      ),
      initial,
    );
  } else {
    picked = await showDatePicker(
      context: ctx,
      initialDate: initial,
      firstDate: first,
      lastDate: last,
    );
  }
  return picked == null ? null : _isoDate(picked);
}

/// Imperative time picker — §2. Spec: `{initialHour?, initialMinute?}`
/// (ints). Resolves to a 24-hour `HH:MM` string, or null on dismiss.
/// Adaptive: Material `showTimePicker` clock dialog, or a
/// `CupertinoDatePicker` time wheel under Cupertino.
Future<Object?> _showTimePicker(
    SkalBridge bridge, Map<String, dynamic> spec) async {
  final ctx = skalNavigatorKey.currentContext;
  if (ctx == null) return null;
  final now = TimeOfDay.now();
  final h = spec['initialHour'];
  final m = spec['initialMinute'];
  final initial = TimeOfDay(
    hour: h is num ? h.toInt().clamp(0, 23) : now.hour,
    minute: m is num ? m.toInt().clamp(0, 59) : now.minute,
  );

  int hour;
  int minute;
  if (bridge.isCupertino) {
    final n = DateTime.now();
    // CupertinoDatePicker works in DateTime — anchor the time wheel to
    // today; only the hour / minute components are read back.
    final initialDT =
        DateTime(n.year, n.month, n.day, initial.hour, initial.minute);
    final picked = await _cupertinoWheelPicker(
      ctx,
      (onChanged) => CupertinoDatePicker(
        mode: CupertinoDatePickerMode.time,
        initialDateTime: initialDT,
        onDateTimeChanged: onChanged,
      ),
      initialDT,
    );
    if (picked == null) return null;
    hour = picked.hour;
    minute = picked.minute;
  } else {
    final picked = await showTimePicker(context: ctx, initialTime: initial);
    if (picked == null) return null;
    hour = picked.hour;
    minute = picked.minute;
  }
  return '${hour.toString().padLeft(2, '0')}:'
      '${minute.toString().padLeft(2, '0')}';
}
