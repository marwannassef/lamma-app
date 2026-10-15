import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Text } from './Text';

/** Small pill label, e.g. "Coming soon" or "3–12 players". */
export function Badge({
  label,
  tone = 'neutral',
  icon,
  testID,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'secondary' | 'gold';
  icon?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const bg = {
    neutral: colors.surfaceRaised,
    primary: colors.primary,
    secondary: colors.secondaryGradient[1],
    gold: colors.surfaceRaised,
  }[tone];
  const fg = {
    neutral: colors.text,
    primary: colors.onPrimary,
    secondary: colors.onSecondary,
    gold: colors.gold,
  }[tone];
  return (
    <View testID={testID} style={[styles.badge, { backgroundColor: bg }]}>
      <Text variant="caption" style={{ color: fg }}>
        {icon ? `${icon} ${label}` : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 2,
  },
});
