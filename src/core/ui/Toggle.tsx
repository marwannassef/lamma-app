import { StyleSheet, Switch, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Text } from './Text';

export function Toggle({
  label,
  sublabel,
  value,
  onChange,
  testID,
  surface = true,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onChange(value: boolean): void;
  testID: string;
  /** Draw its own surface; false when already inside a Panel. */
  surface?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, surface && { backgroundColor: colors.surface, padding: space.lg }]}>
      <View style={styles.labels}>
        <Text variant="label">{label}</Text>
        {sublabel ? (
          <Text variant="caption" tone="muted">
            {sublabel}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={sublabel}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.secondary, false: colors.border }}
        thumbColor={colors.surfaceRaised}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    borderRadius: radius.card - 4,
  },
  labels: { flex: 1 },
});
