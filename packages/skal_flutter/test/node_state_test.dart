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

  group('NodeState — custom widget storage', () {
    test('custom prop maps are lazy (null until written)', () {
      // The vast majority of nodes are built-in widgets that never touch
      // the custom-prop bag. Carrying four empty maps each would cost
      // ~50 bytes × N nodes for nothing.
      final n = NodeState(wtCustom);
      expect(n.customPropsU32, isNull);
      expect(n.customPropsF32, isNull);
      expect(n.customPropsStr, isNull);
      expect(n.customHandlers, isNull);
    });

    test('custom prop maps allocate on first write, persist on read', () {
      final n = NodeState(wtCustom);

      n.setCustomPropU32('zoom', 14);
      n.setCustomPropF32('latitude', 37.7749);
      n.setCustomPropStr('source', 'camera');
      n.setCustomHandler('onTap', 0xABCD);

      expect(n.getCustomPropU32('zoom'), 14);
      expect(n.getCustomPropF32('latitude'), closeTo(37.7749, 1e-9));
      expect(n.getCustomPropStr('source'), 'camera');
      expect(n.getCustomHandler('onTap'), 0xABCD);

      expect(n.customPropsU32, hasLength(1));
      expect(n.customPropsF32, hasLength(1));
      expect(n.customPropsStr, hasLength(1));
      expect(n.customHandlers, hasLength(1));
    });

    test('getCustomProp* returns fallback for missing keys', () {
      final n = NodeState(wtCustom);
      // No maps allocated yet — getter must not throw, must return the
      // fallback. Adapters depend on this so they can write
      // `getCustomPropF32('zoom', 14.0)` without first probing.
      expect(n.getCustomPropU32('missing'), 0);
      expect(n.getCustomPropU32('missing', 42), 42);
      expect(n.getCustomPropF32('missing'), 0.0);
      expect(n.getCustomPropF32('missing', 1.5), 1.5);
      expect(n.getCustomPropStr('missing'), isNull);
      expect(n.getCustomHandler('missing'), 0);

      // Same shape after some writes — the getter shouldn't accidentally
      // shadow other keys with the fallback.
      n.setCustomPropU32('zoom', 14);
      expect(n.getCustomPropU32('zoom', 99), 14);
      expect(n.getCustomPropU32('other', 99), 99);
    });

    test('custom prop writes do not fire cold notifier', () {
      // Same contract as the built-in cold-prop maps: the bridge fires
      // cold.notify() once per drain after coalescing. Direct map writes
      // must stay silent or the per-prop fan-out cost would dominate.
      final n = NodeState(wtCustom);
      var coldCount = 0;
      n.cold.addListener(() => coldCount++);

      n.setCustomPropU32('zoom', 14);
      n.setCustomPropF32('latitude', 37.7749);
      n.setCustomPropStr('source', 'camera');
      n.setCustomHandler('onTap', 1);

      expect(coldCount, 0, reason: 'custom-prop writes must not fan out');
    });

    test('customWidgetName starts null, can be set by the bridge', () {
      final n = NodeState(wtCustom);
      expect(n.customWidgetName, isNull,
          reason: 'name comes from opCreateCustomNode, set by the drain');
      n.customWidgetName = 'GoogleMap';
      expect(n.customWidgetName, 'GoogleMap');
    });
  });
}
