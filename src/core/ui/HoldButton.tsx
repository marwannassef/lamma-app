import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSettings } from '@/core/settings/store';
import { radius, space } from '@/core/theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

const HOLD_MS = 900;

/**
 * Press-and-hold button: a bar fills while held and fires `onComplete` when full. Every turn
 * uses the same hold and the same single haptic, so nobody can tell roles apart by feel.
 */
export function HoldButton({
  label,
  onComplete,
  enabled = true,
  color,
  textColor,
  testID,
}: {
  label: string;
  onComplete(): void;
  enabled?: boolean;
  color: string;
  textColor: string;
  testID?: string;
}) {
  const haptics = useSettings((s) => s.haptics);
  const progress = useSharedValue(0);
  const done = () => {
    if (haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    progress.value = 0;
    onComplete();
  };
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <Pressable
      testID={testID}
      haptic={false}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      onPressIn={() => {
        if (!enabled) return;
        progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
          if (finished) runOnJS(done)();
        });
      }}
      onPressOut={() => {
        cancelAnimation(progress);
        progress.value = withTiming(0, { duration: 150 });
      }}
      // Screen readers can't hold: a double-tap activates directly.
      onAccessibilityAction={() => enabled && onComplete()}
      accessibilityActions={[{ name: 'activate' }]}
      style={[styles.wrap, { borderColor: color, opacity: enabled ? 1 : 0.4 }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
      <View style={styles.label}>
        <Text variant="label" align="center" style={{ color: textColor }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Milliseconds left until `until`, re-rendering a few times a second. Computed from the latest
 * `until`, so a new deadline never reads as 0 before the next tick.
 */
export function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [until]);
  return Math.max(0, until - now);
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 60,
    borderWidth: 2,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', top: 0, bottom: 0, start: 0 },
  label: { paddingHorizontal: space.lg },
});
