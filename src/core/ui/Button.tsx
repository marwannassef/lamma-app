import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress(): void;
  variant?: Variant;
  testID?: string;
  accessibilityHint?: string;
  /** Use the warmer danger color for the face (e.g. punishments). */
  tone?: 'default' | 'danger';
}

/** Chunky button. Primary/secondary have a 6dp "lip" that presses down. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  testID,
  accessibilityHint,
  tone = 'default',
}: ButtonProps) {
  const { colors } = useTheme();
  if (variant === 'ghost') {
    return (
      <Pressable
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [
          styles.ghost,
          { borderColor: colors.border, backgroundColor: pressed ? colors.surface : 'transparent' },
        ]}
      >
        <Text variant="label" align="center">
          {label}
        </Text>
      </Pressable>
    );
  }
  const face =
    tone === 'danger' ? colors.danger : variant === 'primary' ? colors.primary : colors.secondary;
  const lip = variant === 'primary' && tone === 'default' ? colors.primaryLip : colors.text;
  const textColor =
    tone === 'danger' || variant === 'secondary' ? colors.onSecondary : colors.onPrimary;
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.lip,
        { backgroundColor: lip, paddingBottom: pressed ? 2 : 6, marginTop: pressed ? 4 : 0 },
      ]}
    >
      <View style={[styles.face, { backgroundColor: face }]}>
        <Text variant="heading" align="center" style={{ color: textColor }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lip: { borderRadius: radius.lg },
  face: {
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 56,
    justifyContent: 'center',
  },
  ghost: {
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
});
