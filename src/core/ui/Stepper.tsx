import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { minTouch, radius, space, useTheme } from '@/core/theme';

import { Hint } from './Hint';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface StepperProps {
  label: string;
  sublabel?: string;
  icon?: string;
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

export function Stepper(p: StepperProps) {
  const { colors } = useTheme();
  const [hint, setHint] = useState<string | null>(null);
  const step = (delta: number) => {
    const next = p.value + delta;
    if (next < p.min) return setHint(p.minHint);
    if (next > p.max) return setHint(p.maxHint);
    setHint(null);
    p.onChange(next);
  };
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        {p.icon ? (
          <Text style={styles.icon} accessible={false}>
            {p.icon}
          </Text>
        ) : null}
        <View style={styles.labels}>
          <Text variant="label">{p.label}</Text>
          {p.sublabel ? (
            <Text variant="caption" tone="muted">
              {p.sublabel}
            </Text>
          ) : null}
        </View>
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
      </View>
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
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  btn: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 48, fontSize: 40, lineHeight: 50 },
});
