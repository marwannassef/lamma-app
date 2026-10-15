import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/core/theme';

// Positions in % of the screen, echoing the confetti in the Lamma logo.
const SPARKLES = [
  { x: 8, y: 6, s: 14, c: '✦' },
  { x: 86, y: 9, s: 10, c: '✧' },
  { x: 62, y: 17, s: 8, c: '•' },
  { x: 18, y: 28, s: 9, c: '✧' },
  { x: 92, y: 33, s: 13, c: '✦' },
  { x: 5, y: 47, s: 8, c: '•' },
  { x: 74, y: 52, s: 9, c: '✧' },
  { x: 38, y: 61, s: 12, c: '✦' },
  { x: 90, y: 70, s: 8, c: '•' },
  { x: 12, y: 78, s: 13, c: '✦' },
  { x: 56, y: 86, s: 9, c: '✧' },
  { x: 82, y: 93, s: 11, c: '✦' },
] as const;

function Sparkle({ x, y, s, c, i }: { x: number; y: number; s: number; c: string; i: number }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const opacity = useSharedValue(0.18);
  useEffect(() => {
    if (reduce) return;
    opacity.value = withDelay(
      i * 350,
      withRepeat(
        withSequence(withTiming(0.55, { duration: 1600 }), withTiming(0.18, { duration: 1600 })),
        // Finite: ~20 s of twinkle, then still. Endless loops drain battery and keep
        // accessibility services and UI tests from ever seeing the screen as idle.
        6,
      ),
    );
  }, [i, opacity, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.sparkle, { start: `${x}%`, top: `${y}%` }, style]}>
      <Text style={{ color: colors.sparkle, fontSize: s }}>{c}</Text>
    </Animated.View>
  );
}

/** Deep gradient with sparkles that twinkle for a while after a screen opens (static with reduced motion). */
export function GameBackground() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.bgGradient}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {SPARKLES.map((p, i) => (
        <Sparkle key={i} i={i} {...p} />
      ))}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  sparkle: { position: 'absolute' },
});
