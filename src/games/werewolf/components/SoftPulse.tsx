import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { space } from '@/core/theme';

/** After this long on a secret turn, the screen starts pulsing (§4 "soft maximum"). */
export const SOFT_MAX_MS = 15_000;
const PULSES = 100;

/**
 * Pulses its content gently once a turn passes the soft maximum, so a slow turn (a thinking Witch)
 * looks the same as any other slow turn instead of standing out. Still with reduced motion.
 */
export function SoftPulse({ since, children }: { since: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  const [late, setLate] = useState(() => Date.now() - since >= SOFT_MAX_MS);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (late) return;
    const id = setTimeout(() => setLate(true), Math.max(0, since + SOFT_MAX_MS - Date.now()));
    return () => clearTimeout(id);
  }, [late, since]);

  useEffect(() => {
    if (!late || reduce) return;
    opacity.set(
      withRepeat(
        withSequence(withTiming(0.72, { duration: 900 }), withTiming(1, { duration: 900 })),
        // Finite (about 3 minutes), like GameBackground: no endless loops on idle screens.
        PULSES,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [late, opacity, reduce]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.fill, style]} testID={late ? 'soft-max' : undefined}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { gap: space.lg } });
