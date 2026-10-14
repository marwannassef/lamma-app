import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

/** In-place yes/no question. Use instead of native alert dialogs, which can block game flow. */
export function ConfirmInline({
  question,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  testID,
}: {
  question: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm(): void;
  onCancel(): void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.danger }]}
    >
      <Text variant="label" align="center">
        {question}
      </Text>
      <View style={styles.row}>
        <Pressable
          testID={testID && `${testID}-yes`}
          onPress={onConfirm}
          accessibilityLabel={confirmLabel}
          style={[styles.btn, { backgroundColor: colors.danger, borderColor: colors.danger }]}
        >
          <Text variant="label" align="center" style={{ color: colors.onSecondary }}>
            {confirmLabel}
          </Text>
        </Pressable>
        <Pressable
          testID={testID && `${testID}-no`}
          onPress={onCancel}
          accessibilityLabel={cancelLabel}
          style={[styles.btn, { borderColor: colors.border }]}
        >
          <Text variant="label" align="center">
            {cancelLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, borderWidth: 2, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  btn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    justifyContent: 'center',
  },
});
