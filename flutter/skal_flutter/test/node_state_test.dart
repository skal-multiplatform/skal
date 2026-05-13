// NodeState — the per-node reactive cell. Two ChangeNotifier channels
// (cold + hot) and a bag of plain fields + maps that the bridge
// mutates directly.
//
// Tests focus on the reactivity model: subscribing to `cold` should
// receive notifications when `cold.notify()` is called, and not when
// `hot.notify()` is called. Independent fan-out is the architectural
// guarantee that makes 60 fps hot-prop tweens not invalidate the
// cached widget tree.

import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/node_state.dart';
import 'package:skal_flutter/skal/wire.dart';

void main() {
  group('NodeState', () {
    test('cold and hot notifiers fire independently', () {
      final n = NodeState(wtColumn);
      var coldCount = 0;
      var hotCount = 0;
      n.cold.addListener(() => coldCount++);
      n.hot.addListener(() => hotCount++);

      n.cold.notify();
      expect(coldCount, 1);
      expect(hotCount, 0, reason: 'hot should not fire when cold notifies');

      n.hot.notify();
      expect(coldCount, 1, reason: 'cold should not fire when hot notifies');
      expect(hotCount, 1);
    });

    test('cold-prop maps are plain (not reactive)', () {
      final n = NodeState(wtBox);
      // Writing to .props doesn't fire the notifier — that's by design.
      // The bridge fires cold.notify() once per drain after coalescing
      // multiple writes.
      var coldCount = 0;
      n.cold.addListener(() => coldCount++);

      n.props[propBgColor] = 0xFFFF0000;
      n.props[propPadding] = 16;
      expect(coldCount, 0, reason: 'plain map writes must not fan out');
    });

    test('getPropU32 returns fallback for unset keys', () {
      final n = NodeState(wtBox);
      expect(n.getPropU32(propBgColor), 0);
      expect(n.getPropU32(propBgColor, 0xFFAABBCC), 0xFFAABBCC);
      n.props[propBgColor] = 0xFFFF0000;
      expect(n.getPropU32(propBgColor, 0xFFAABBCC), 0xFFFF0000);
    });

    test('default field values are framework-neutral identity', () {
      final n = NodeState(wtBox);
      expect(n.opacity, 1.0);
      expect(n.translationX, 0.0);
      expect(n.translationY, 0.0);
      expect(n.scaleX, 1.0);
      expect(n.scaleY, 1.0);
      expect(n.rotationZ, 0.0);
      expect(n.text, '');
      expect(n.onClickHandlerId, 0);
      expect(n.parent, 0);
      expect(n.childCount, 0);
      expect(n.hasChildren, isFalse);
    });
  });
}
