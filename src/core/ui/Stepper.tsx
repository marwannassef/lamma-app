import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';

import { minTouch, radius, space, useTheme } from '@/core/theme';

import { Hint } from './Hint';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface StepperProps {
  label: string;
  sublabel?: string;
  /** An emoji, or an image element. */
  icon?: string | ReactNode;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
  decreaseLabel: string;
  increaseLabel: string;
  /** Shown when + / − is pressed at the limit; the buttons stay tappable. */
  minHint: string;
  maxHint: string;
  testID: string;
}

function RoundButton({
  sign,
  label,
  dim,
  onPress,
  testID,
}: {
  sign: string;
  label: string;
  dim: boolean;
  onPress(): void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        { opacity: dim ? 0.45 : 1 },
        pressed && { transform: [{ scale: 0.92 }] },
      ]}
    >
      <LinearGradient colors={colors.secondaryGradient} style={styles.btn}>
        <Text variant="title" align="center" style={{ color: colors.onSecondary }}>
          {sign}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Below this width (points, scaled by the phone's text size) the controls wrap under the label. */
const NARROW_WIDTH = 360;

export function Stepper(p: StepperProps) {
  const { colors } = useTheme();
  const [hint, setHint] = useState<string | null>(null);
  // On a narrow row (small phone, large text) the controls go on their own line instead of
  // squeezing the label into a sliver.
  const [narrow, setNarrow] = useState(false);
  const step = (delta: number) => {
    const next = p.value + delta;
    if (next < p.min) return setHint(p.minHint);
    if (next > p.max) return setHint(p.maxHint);
    setHint(null);
    p.onChange(next);
  };
  const controls = (
    <View style={styles.controls}>
      <RoundButton
        sign="−"
        label={p.decreaseLabel}
        dim={p.value <= p.min}
        onPress={() => step(-1)}
        testID={`${p.testID}-minus`}
      />
      <Text
        variant="hero"
        align="center"
        style={[styles.value, { color: colors.text }]}
        maxFontSizeMultiplier={1.3}
        testID={`${p.testID}-value`}
        accessibilityLabel={`${p.label}: ${p.value}`}
      >
        {String(p.value)}
      </Text>
      <RoundButton
        sign="+"
        label={p.increaseLabel}
        dim={p.value >= p.max}
        onPress={() => step(1)}
        testID={`${p.testID}-plus`}
      />
    </View>
  );
  return (
    <View
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onLayout={(e) =>
        setNarrow(
          e.nativeEvent.layout.width < NARROW_WIDTH * Math.max(1, PixelRatio.getFontScale()),
        )
      }
    >
      <View style={styles.row}>
        {typeof p.icon === 'string' ? (
          <Text style={styles.icon} accessible={false}>
            {p.icon}
          </Text>
        ) : (
          (p.icon ?? null)
        )}
        <View style={styles.labels}>
          <Text variant="label">{p.label}</Text>
          {p.sublabel ? (
            <Text variant="caption" tone="muted">
              {p.sublabel}
            </Text>
          ) : null}
        </View>
        {narrow ? null : controls}
      </View>
      {narrow ? <View style={styles.controlsLine}>{controls}</View> : null}
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card - 4,
    borderWidth: 1.5,
    padding: space.md,
    paddingStart: space.lg,
    gap: space.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 28, lineHeight: 36 },
  labels: { flex: 1 },
  controlsLine: { alignItems: 'flex-end' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginStart: 'auto' },
  btn: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 48, fontSize: 40, lineHeight: 50 },
});
