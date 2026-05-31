// Wire constants — snapshot test guarding against silent drift from
// the JS side (packages/skal-js/src/bridge.js) and any future non-Dart consumer
// of the wire format.
//
// If anything in `wire.dart` changes value, this test fails and the
// fix is "update the matching constant in bridge.js as well". The
// constants are load-bearing — a one-byte opcode mismatch means
// every op decodes to the wrong widget type, silently.

import 'package:flutter_test/flutter_test.dart';
import 'package:skal_flutter/skal/wire.dart';

void main() {
  group('wire constants — opcodes', () {
    test('have expected byte values', () {
      expect(opCreateNode, 0x01);
      expect(opRemoveNode, 0x02);
      expect(opInsertBefore, 0x03);
      expect(opCreateCustomNode, 0x04);
      expect(opSetPropU32, 0x10);
      expect(opSetPropF32, 0x11);
      expect(opSetText, 0x14);
      expect(opBindHandler, 0x15);
      expect(opSetPropStr, 0x16);
    });

    test('custom-widget prop opcodes occupy 0x17-0x1B', () {
      expect(opDeclareName, 0x17);
      expect(opSetCustomPropU32, 0x18);
      expect(opSetCustomPropF32, 0x19);
      expect(opSetCustomPropStr, 0x1A);
      expect(opBindCustomHandler, 0x1B);
    });

    test('hot-prop opcodes occupy the 0x20+ range and are distinct', () {
      expect(opSetOpacity, 0x20);
      expect(opSetTranslationX, 0x21);
      expect(opSetTranslationY, 0x22);
      expect(opSetScaleX, 0x23);
      expect(opSetScaleY, 0x24);
      expect(opSetRotationZ, 0x25);
    });

    test('control + diagnostic opcodes', () {
      expect(opSetDesign, 0x26);
      expect(opCompleteRefresh, 0x27);
      expect(opLog, 0x28);
      expect(opResetRootSubtree, 0x29);
    });
  });

  group('wire constants — widget types', () {
    test('have expected values', () {
      expect(wtBox, 0);
      expect(wtColumn, 1);
      expect(wtRow, 2);
      expect(wtText, 3);
      expect(wtButton, 4);
      expect(wtScrollView, 5);
      expect(wtListView, 6);
      expect(wtReorderableListView, 7);
      expect(wtCustom, 8);
    });
  });

  group('wire constants — prop keys', () {
    test('layout tier (0x00-0x1F)', () {
      expect(propPadding, 0x00);
      expect(propWidth, 0x05);
      expect(propHeight, 0x06);
      expect(propAlignment, 0x08);
      expect(propGap, 0x09);
    });

    test('visual tier (0x20-0x3F)', () {
      expect(propBgColor, 0x20);
      expect(propFgColor, 0x21);
      expect(propCornerRadius, 0x22);
      expect(propBorderWidth, 0x23);
      expect(propBorderColor, 0x24);
    });

    test('text tier (0x40-0x5F)', () {
      expect(propFontSize, 0x40);
      expect(propFontWeight, 0x41);
      expect(propFontFamily, 0x42);
      expect(propTextAlign, 0x43);
    });
  });

  group('wire constants — header layout', () {
    test('header offsets', () {
      expect(hOpSeq, 0);
      expect(hOpWritePos, 8);
      expect(hStrWritePos, 12);
      expect(hEventSeq, 16);
      expect(hEventWritePos, 24);
      expect(hEventReadPos, 28);
      expect(hLastDrainedSeq, 32);
      expect(hReplyHeapReadPos, 40);
      expect(hReplyHeapWritePos, 44);
      expect(hJsResetEpoch, 48);
    });

    test('ring layout sizes', () {
      expect(kHeaderSize, 64);
      expect(kOpRingOffset, 64);
      expect(kOpRingSize, 4 * 1024 * 1024);
      expect(kStringHeapOff, 64 + 4 * 1024 * 1024);
      expect(kStringHeapSize, 768 * 1024); // trimmed 25% for the reply heap
      // Reply heap sits between the string heap and the event ring —
      // Dart-write / JS-read, carries RPC replies + error messages.
      expect(kReplyHeapOff, kStringHeapOff + kStringHeapSize);
      expect(kReplyHeapSize, 256 * 1024);
      expect(kBridgeSize, 6 * 1024 * 1024);
      // Event ring occupies whatever's left of the 6 MiB buffer after
      // header + op ring + string heap + reply heap.
      expect(kEventRingOffset, kReplyHeapOff + kReplyHeapSize);
      expect(
        kEventRingOffset + kEventRingSize,
        kBridgeSize,
        reason: 'header + op ring + string heap + reply heap + event '
            'ring must fill 6 MiB',
      );
    });
  });

  group('wire constants — sentinels', () {
    test('width/height sentinels', () {
      expect(kNoValue, -1);
      expect(kFillMax, 0x7FFFFFFE);
      expect(kWrapContent, 0x7FFFFFFD);
    });

    test('alignment enum', () {
      expect(alignStart, 0);
      expect(alignCenter, 1);
      expect(alignEnd, 2);
    });
  });
}
