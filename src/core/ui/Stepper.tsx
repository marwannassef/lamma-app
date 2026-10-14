import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { minTouch, radius, space, useTheme } from '@/core/theme';

import { Hint } from './Hint';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface StepperProps {
  label: string;
  sublabel?: string;
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
  const atMin = p.value <= p.min;
  const atMax = p.value >= p.max;
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <View style={styles.labels}>
          <Text variant="label">{p.label}</Text>
          {p.sublabel ? (
            <Text variant="caption" tone="muted">
              {p.sublabel}
            </Text>
          ) : null}
        </View>
        <View style={styles.controls}>
          <Pressable
            testID={`${p.testID}-minus`}
            accessibilityLabel={p.decreaseLabel}
            onPress={() => step(-1)}
            style={[
              styles.btn,
              { backgroundColor: colors.surfaceRaised, opacity: atMin ? 0.5 : 1 },
            ]}
          >
            <Text variant="title" tone="secondary" align="center">
              −
            </Text>
          </Pressable>
          <Text
            variant="title"
            align="center"
            style={styles.value}
            testID={`${p.testID}-value`}
            accessibilityLabel={`${p.label}: ${p.value}`}
          >
            {String(p.value)}
          </Text>
          <Pressable
            testID={`${p.testID}-plus`}
            accessibilityLabel={p.increaseLabel}
            onPress={() => step(1)}
            style={[
              styles.btn,
              { backgroundColor: colors.surfaceRaised, opacity: atMax ? 0.5 : 1 },
            ]}
          >
            <Text variant="title" tone="secondary" align="center">
              +
            </Text>
          </Pressable>
        </View>
      </View>
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, padding: space.md, paddingStart: space.lg, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  labels: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  btn: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 40 },
});
