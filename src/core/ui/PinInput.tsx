import { StyleSheet, TextInput } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

/** A 4-digit, hidden PIN field with a number pad. */
export function PinInput({
  value,
  onChange,
  label,
  testID,
  autoFocus = true,
}: {
  value: string;
  onChange(v: string): void;
  label: string;
  testID?: string;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 4))}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={4}
      autoFocus={autoFocus}
      accessibilityLabel={label}
      placeholder="••••"
      placeholderTextColor={colors.textMuted}
      maxFontSizeMultiplier={1.5}
      style={[
        styles.input,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border, color: colors.text },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    alignSelf: 'center',
    width: 200,
    minHeight: 56,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 28,
    letterSpacing: 16,
    textAlign: 'center',
  },
});
