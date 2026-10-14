import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

/** Selectable tile: emoji + title + optional subtitle. Selection shows a check, not just color. */
export function Chip({
  emoji,
  title,
  subtitle,
  selected,
  onPress,
  testID,
  warning = false,
  compact = false,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress(): void;
  testID?: string;
  /** Marks adult content with a danger border. */
  warning?: boolean;
  /** Emoji stacked above a centered title, for narrow grids. */
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const border = selected ? colors.secondary : warning ? colors.danger : colors.border;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.compact,
        {
          borderColor: border,
          backgroundColor: selected ? colors.surface : colors.surfaceRaised,
        },
      ]}
    >
      {emoji ? (
        <Text style={styles.emoji} accessible={false}>
          {emoji}
        </Text>
      ) : null}
      <View style={[styles.text, compact && styles.compactText]}>
        <Text
          variant={compact ? 'caption' : 'label'}
          tone={selected ? 'secondary' : 'default'}
          align={compact ? 'center' : 'auto'}
          numberOfLines={2}
        >
          {selected && compact ? `✓ ${title}` : title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {selected && !compact ? (
        <Text variant="label" tone="secondary" accessible={false}>
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  compact: { flexDirection: 'column', gap: 2, paddingHorizontal: space.xs },
  compactText: { flex: 0, alignSelf: 'stretch' },
  emoji: { fontSize: 24, lineHeight: 32 },
  text: { flex: 1 },
});
