import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * Selectable game tile: emoji bubble + title + optional subtitle. The selected tile gets a
 * gradient frame, a glow and a ✓ badge, so selection never relies on colour alone.
 */
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
  /** Marks adult content with a danger frame. */
  warning?: boolean;
  /** Emoji stacked above a centered title, for narrow grids. */
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const frame = selected
    ? colors.secondaryGradient
    : warning
      ? colors.dangerGradient
      : ([colors.border, colors.border] as const);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shadow,
        { shadowColor: colors.glow, shadowOpacity: selected ? 0.6 : 0 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <LinearGradient
        colors={frame}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.frame}
      >
        <View
          style={[
            styles.inner,
            compact && styles.compact,
            { backgroundColor: selected ? colors.surfaceRaised : colors.surface },
          ]}
        >
          {emoji ? (
            <View
              style={[
                compact ? styles.bubbleSm : styles.bubble,
                { backgroundColor: selected ? colors.surface : colors.surfaceRaised },
              ]}
            >
              <Text style={compact ? styles.emojiSm : styles.emoji} accessible={false}>
                {emoji}
              </Text>
            </View>
          ) : null}
          <View style={[styles.text, compact && styles.compactText]}>
            <Text
              variant={compact ? 'caption' : 'label'}
              tone={selected ? 'secondary' : 'default'}
              align={compact ? 'center' : 'auto'}
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {selected ? (
          <View style={[styles.check, { backgroundColor: colors.secondaryGradient[1] }]}>
            <Text variant="caption" style={{ color: colors.onSecondary }} accessible={false}>
              ✓
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, borderRadius: radius.md },
  frame: { borderRadius: radius.md + 2, padding: 2 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    minHeight: 56,
  },
  compact: { flexDirection: 'column', gap: 2, paddingVertical: space.sm },
  bubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleSm: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22, lineHeight: 28 },
  emojiSm: { fontSize: 20, lineHeight: 26 },
  text: { flex: 1 },
  compactText: { flex: 0, alignSelf: 'stretch' },
  check: {
    position: 'absolute',
    top: -6,
    end: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
