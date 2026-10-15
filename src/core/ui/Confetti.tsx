import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#4F8FDB', '#6B3FC6', '#D23C82', '#EF7A3C', '#FFD25E', '#6DBE45', '#2FB8C9'];
const PIECES = 36;

function Piece({ i, width, height }: { i: number; width: number; height: number }) {
  const p = useMemo(() => {
    const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
    return {
      x: r(1) * width,
      drift: (r(2) - 0.5) * 160,
      spin: (r(3) - 0.5) * 900,
      delay: r(4) * 400,
      size: 8 + r(5) * 8,
      color: COLORS[i % COLORS.length],
      round: r(6) > 0.6,
    };
  }, [i, width]);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      p.delay,
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
    );
  }, [p.delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
    transform: [
      { translateX: p.x + p.drift * t.value },
      { translateY: -40 + t.value * (height * 0.9) },
      { rotate: `${p.spin * t.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: p.size,
          height: p.round ? p.size : p.size * 0.45,
          borderRadius: p.round ? p.size / 2 : 2,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
}

/** One celebratory burst on mount. Renders nothing with reduced motion. */
export function Confetti() {
  const reduce = useReducedMotion();
  const { width, height } = useWindowDimensions();
  if (reduce) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} i={i} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Physical left: the burst uses screen x coordinates and must not flip in RTL.
  piece: { position: 'absolute', top: 0, left: 0 }, // eslint-disable-line no-restricted-syntax
});
