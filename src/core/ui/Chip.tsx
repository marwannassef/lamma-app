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
  locked = false,
  lockedLabel,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress(): void;
  testID?: string;
  /** Marks Teen content with a danger frame. */
  warning?: boolean;
  /** Premium-only: stays visible with a 🔒 and opens the paywall (monetization §3). */
  locked?: boolean;
  /** Screen-reader word for the lock, e.g. "Premium". */
  lockedLabel?: string;
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
      accessibilityLabel={[title, subtitle, locked && lockedLabel].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shadow,
        styles.fill,
        { shadowColor: colors.glow, shadowOpacity: selected ? 0.6 : 0 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <LinearGradient
        colors={frame}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.frame, styles.fill]}
      >
        <View
          style={[
            styles.inner,
            styles.fill,
            compact && styles.compact,
            compact && emoji ? styles.compactEmoji : null,
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
              numberOfLines={title.includes(' ') ? 2 : 1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                variant="caption"
                tone="muted"
                align={compact ? 'center' : 'auto'}
                numberOfLines={compact ? 1 : undefined}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {locked ? (
          <View style={[styles.check, styles.lock, { backgroundColor: colors.surfaceRaised }]}>
            <Text variant="caption" accessible={false}>
              🔒
            </Text>
          </View>
        ) : null}
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
  // Tiles stretch to their grid cell, so every tile in a row is the same height.
  fill: { flexGrow: 1 },
  frame: { borderRadius: radius.md + 2, padding: 2 },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    // Room for a two-line name plus a subtitle, so short and long names give equal tiles.
    minHeight: 76,
  },
  compact: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: space.sm,
    minHeight: 56,
  },
  // Emoji plus a two-line label.
  compactEmoji: { minHeight: 96 },
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
  lock: { width: 28, height: 28, borderRadius: 14 },
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
