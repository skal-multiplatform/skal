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

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'bridge.dart';
import 'wire.dart';

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
/// The dispatcher is stored on the bridge (`rootDispatcher`) and also
/// attached to the current root node — `opCreateNode` re-attaches it
/// on any future root recreation, so this is safe to call regardless
/// of whether the root node exists yet.
void installAppDispatcher(SkalBridge bridge) {
  bridge.rootDispatcher = (method, args) {
    final spec = _decodeSpec(args);
    switch (method) {
      case 'showDialog':
        return _showDialog(bridge, spec);
      case 'showActionSheet':
        return _showActionSheet(bridge, spec);
      case 'showSnackbar':
        return _showSnackbar(spec);
      default:
        throw 'skal: unknown app method "$method"';
    }
  };
  bridge.nodes[kRootNodeId]?.methodDispatcher = bridge.rootDispatcher;
}

/// The JS side ships the spec as a single JSON string arg.
Map<String, dynamic> _decodeSpec(List<Object?> args) {
  if (args.isEmpty) return const {};
  final raw = args.first;
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
