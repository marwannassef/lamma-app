import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
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
import { Pressable, Text } from '@/core/ui';

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

/** Seconds left until `enabledAt`, ticking down (for the minimum turn time). */
export function useCountdown(until: number) {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()));
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timer.current = setInterval(() => setLeft(Math.max(0, until - Date.now())), 200);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [until]);
  return left;
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
