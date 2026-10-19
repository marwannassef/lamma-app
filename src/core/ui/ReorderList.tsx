import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { space, useTheme } from '@/core/theme';

import { Text } from './Text';

/** The row a dragged row lands on, from how far it moved. */
export function dropIndex(from: number, dy: number, stride: number, count: number) {
  'worklet';
  if (stride <= 0) return from;
  return Math.max(0, Math.min(count - 1, from + Math.round(dy / stride)));
}

/** How far row `i` slides to make room while row `from` is dragged over row `to`. */
export function shiftFor(i: number, from: number, to: number, stride: number) {
  'worklet';
  if (from < 0 || i === from) return 0;
  if (from < i && i <= to) return -stride;
  if (to <= i && i < from) return stride;
  return 0;
}

interface Drag {
  active: SharedValue<number>;
  dy: SharedValue<number>;
  stride: SharedValue<number>;
}

function Row({
  index,
  count,
  drag,
  onMove,
  handleLabel,
  moveUpLabel,
  moveDownLabel,
  children,
}: {
  index: number;
  count: number;
  drag: Drag;
  onMove(from: number, to: number): void;
  handleLabel: string;
  moveUpLabel: string;
  moveDownLabel: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const { active, dy, stride } = drag;

  const pan = Gesture.Pan()
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onStart(() => {
      active.set(index);
      dy.set(0);
    })
    .onUpdate((e) => {
      dy.set(e.translationY);
    })
    .onEnd(() => {
      const to = dropIndex(index, dy.value, stride.value, count);
      if (to !== index) scheduleOnRN(onMove, index, to);
    })
    .onFinalize(() => {
      active.set(-1);
      dy.set(0);
    });

  const style = useAnimatedStyle(() => {
    const dragging = active.value === index;
    if (dragging) {
      return { zIndex: 10, transform: [{ translateY: dy.value }, { scale: 1.03 }], opacity: 0.95 };
    }
    const to = dropIndex(active.value, dy.value, stride.value, count);
    const shift = shiftFor(index, active.value, to, stride.value);
    return {
      zIndex: 0,
      transform: [
        { translateY: withTiming(active.value < 0 ? 0 : shift, { duration: 120 }) },
        { scale: 1 },
      ],
      opacity: 1,
    };
  });

  return (
    <Animated.View
      style={[styles.row, style]}
      onLayout={
        index === 0
          ? (e) => {
              stride.set(e.nativeEvent.layout.height + space.sm);
            }
          : undefined
      }
    >
      <View style={styles.content}>{children}</View>
      <GestureDetector gesture={pan}>
        <View
          testID={`drag-${index}`}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={handleLabel}
          accessibilityActions={[
            ...(index > 0 ? [{ name: 'moveUp', label: moveUpLabel }] : []),
            ...(index < count - 1 ? [{ name: 'moveDown', label: moveDownLabel }] : []),
          ]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'moveUp') onMove(index, index - 1);
            if (e.nativeEvent.actionName === 'moveDown') onMove(index, index + 1);
          }}
          hitSlop={8}
          style={[styles.handle, { borderColor: colors.border }]}
        >
          <Text variant="heading" tone="secondary" accessible={false}>
            ≡
          </Text>
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

/**
 * A list reordered by dragging each row's ≡ handle. Rows must share one height. Screen readers
 * get "move up" / "move down" actions on the handle instead.
 */
export function ReorderList({
  count,
  renderRow,
  onMove,
  handleLabel,
  moveUpLabel,
  moveDownLabel,
}: {
  count: number;
  renderRow(index: number): ReactNode;
  onMove(from: number, to: number): void;
  handleLabel(index: number): string;
  moveUpLabel(index: number): string;
  moveDownLabel(index: number): string;
}) {
  const drag = {
    active: useSharedValue(-1),
    dy: useSharedValue(0),
    stride: useSharedValue(0),
  };
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <Row
          key={i}
          index={i}
          count={count}
          drag={drag}
          onMove={onMove}
          handleLabel={handleLabel(i)}
          moveUpLabel={moveUpLabel(i)}
          moveDownLabel={moveDownLabel(i)}
        >
          {renderRow(i)}
        </Row>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  content: { flex: 1 },
  handle: {
    width: 48,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
  },
});
