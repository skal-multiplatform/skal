// Ticker demo — exercises the codegen's HOST pattern + RPC slice
// end-to-end with a pure-Dart, no-plugin stateful widget.
//
// Three pieces in one file:
//
//   • TickController — owns a periodic `Timer`, counts ticks, supports
//     pause/resume/reset/getValue. Extends ChangeNotifier so the view
//     can rebuild on each tick via AnimatedBuilder.
//
//   • TickView — StatelessWidget that takes a TickController and
//     renders the current count, tinted by paused state.
//
//   • createTicker — factory function for the codegen HOST pattern.
//     Its parameters (`intervalMs`, `startPaused`) become JSX props;
//     codegen emits a `_TickerHost` StatefulWidget that constructs +
//     disposes the controller around the view.
//
// Codegen registers a JS → Dart RPC dispatcher on the host's NodeState
// that lets JSX call:
//
//   const ref = createSkalRef();
//   <Ticker ref={ref} intervalMs={500} />
//   ref.pause();                          // → controller.pause()
//   const v = await ref.getValue();       // → controller.getValue()
//
// Filter rules in `_collectControllerMethods` automatically skip the
// inherited ChangeNotifier methods (notifyListeners, addListener…)
// and the host-managed `dispose()`.

import 'dart:async';

import 'package:flutter/material.dart';

class TickController extends ChangeNotifier {
  Timer? _timer;
  int _value = 0;
  bool _paused;

  TickController({
    Duration interval = const Duration(seconds: 1),
    bool startPaused = false,
  }) : _paused = startPaused {
    _timer = Timer.periodic(interval, (_) {
      if (!_paused) {
        _value++;
        notifyListeners();
      }
    });
  }

  // RPC-eligible methods. Each becomes a `case` in the codegen-emitted
  // host dispatcher. Public, non-static, encodable args + returns
  // (primitives, String, jsonEncode-able objects).
  void pause() { _paused = true; }
  void resume() { _paused = false; }
  void reset() {
    _value = 0;
    notifyListeners();
  }
  int getValue() => _value;
  bool isPaused() => _paused;
  void bump(int delta) {
    _value += delta;
    notifyListeners();
  }
  // String arg + String return — exercises both directions of the
  // string bridge via the reply heap (Dart → JS) and the JS string
  // heap (JS → Dart).
  String describe(String tag) {
    return '$tag: ticks=$_value, paused=$_paused';
  }
  // Object return — encoded as JSON, parsed automatically on the
  // JSX side. The dev's onClick handler receives a real JS object.
  Map<String, Object?> snapshot() {
    return {
      'value': _value,
      'paused': _paused,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };
  }

  // Stream<int> — every tick (or every value change, including
  // bump/reset) emits the current count. The codegen dispatcher
  // returns this Stream as-is; the bridge does the `.listen` when
  // the JSX side calls `ref.ticks$(cb)`. Subscribe / unsubscribe
  // round-trips through the wire protocol's stream ops.
  Stream<int> ticks() {
    late StreamController<int> ctl;
    void emit() {
      if (!ctl.isClosed) ctl.add(_value);
    }
    ctl = StreamController<int>(
      onListen: () => addListener(emit),
      onCancel: () => removeListener(emit),
    );
    return ctl.stream;
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

class TickView extends StatelessWidget {
  final TickController controller;
  const TickView(this.controller, {super.key});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (_, _) => Container(
        decoration: BoxDecoration(
          color: controller.isPaused()
              ? const Color(0xFFFFE8B0)
              : const Color(0xFFB0F0D0),
          borderRadius: BorderRadius.circular(8),
        ),
        padding: const EdgeInsets.all(12),
        child: Text(
          controller.isPaused()
              ? 'ticks: ${controller.getValue()} (paused)'
              : 'ticks: ${controller.getValue()}',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Color(0xFF1F2937),
          ),
        ),
      ),
    );
  }
}

/// Codegen HOST factory. Codegen walks this function's parameters →
/// JSX props, derives the controller type (TickController) from the
/// return type, walks the controller's methods → RPC dispatcher.
///
/// Sync factory — no `await` needed; the synthesized host calls this
/// directly in initState. The Timer kicks off inside the constructor,
/// so by the time setState fires the widget already has a live ticker.
TickController createTicker({
  int intervalMs = 1000,
  bool startPaused = false,
}) {
  return TickController(
    interval: Duration(milliseconds: intervalMs),
    startPaused: startPaused,
  );
}
