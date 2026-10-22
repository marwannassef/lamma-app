import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/core/ui';

import { flavorOf } from './flavor';

const BURST = 10;

function Particle({ emoji, i }: { emoji: string; i: number }) {
  const t = useSharedValue(0);
  // Spread evenly around the circle, each a little further or closer.
  const angle = (i / BURST) * Math.PI * 2 + (i % 2 ? 0.3 : -0.2);
  const dist = 110 + (i % 3) * 30;
  useEffect(() => {
    t.value = withDelay(120, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.7 ? 1 : 1 - (t.value - 0.7) / 0.3,
    transform: [
      { translateX: Math.cos(angle) * dist * t.value },
      { translateY: Math.sin(angle) * dist * t.value - 40 * t.value * t.value },
      { rotate: `${(i % 2 ? 1 : -1) * 220 * t.value}deg` },
      { scale: 0.4 + t.value * 0.8 },
    ],
  }));
  return (
    <Animated.View style={[styles.center, style]}>
      <Text style={styles.particle} accessible={false}>
        {emoji}
      </Text>
    </Animated.View>
  );
}

function Hero({ emoji }: { emoji: string }) {
  const pop = useSharedValue(0);
  const wiggle = useSharedValue(0);
  useEffect(() => {
    pop.value = withSequence(
      withSpring(1, { damping: 7, stiffness: 180 }),
      withDelay(700, withTiming(0, { duration: 400 })),
    );
    wiggle.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(-1, { duration: 120 }),
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 120 }),
    );
  }, [pop, wiggle]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.5),
    transform: [
      { translateY: (1 - pop.value) * -30 },
      { scale: 0.3 + pop.value * 1.1 },
      { rotate: `${wiggle.value * 14}deg` },
    ],
  }));
  return (
    <Animated.View style={[styles.center, style]}>
      <Text style={styles.hero} accessible={false}>
        {emoji}
      </Text>
    </Animated.View>
  );
}

/**
 * A short, game-themed burst when the wheel stops on a game: its emoji pops and wiggles while
 * little related emojis fly out. Decoration only; nothing with reduced motion.
 */
export function Surprise({ gameId }: { gameId: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const f = flavorOf(gameId);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      {Array.from({ length: BURST }, (_, i) => (
        <Particle key={i} i={i} emoji={f.burst[i % f.burst.length] ?? '✨'} />
      ))}
      <Hero emoji={f.hero} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: { fontSize: 30, lineHeight: 38 },
  hero: { fontSize: 96, lineHeight: 112 },
});
