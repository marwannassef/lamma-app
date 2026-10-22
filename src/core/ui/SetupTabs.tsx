import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

export type SetupTab = 'play' | 'customize';

const TABS: { id: SetupTab; icon: string }[] = [
  { id: 'play', icon: '🎮' },
  { id: 'customize', icon: '⚙️' },
];

/** A game's setup in two tabs: the short "Play" one and "Customize" with every option. */
export function SetupTabs({ value, onChange }: { value: SetupTab; onChange(tab: SetupTab): void }) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  return (
    <View
      style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="tablist"
    >
      {TABS.map(({ id, icon }) => {
        const selected = value === id;
        return (
          <Pressable
            key={id}
            testID={`tab-${id}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t(`setupTabs.${id}`)}
            onPress={() => onChange(id)}
            style={[styles.tab, selected && { backgroundColor: colors.secondary }]}
          >
            <Text
              variant="label"
              accessible={false}
              style={{ color: selected ? colors.onSecondary : colors.text }}
            >
              {`${icon} ${t(`setupTabs.${id}`)}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The current custom settings at a glance on the Play tab; tapping it opens Customize.
 * `lines` are short, already-translated phrases such as "🎲 Random category".
 */
export function CustomizeSummary({ lines, onPress }: { lines: string[]; onPress(): void }) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  return (
    <Pressable
      testID="customize-summary"
      accessibilityLabel={`${t('setupTabs.yourSettings')}: ${lines.join(', ')}. ${t('setupTabs.change')}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.summary,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.summaryText}>
        <Text variant="label" tone="muted" accessible={false}>
          {t('setupTabs.yourSettings')}
        </Text>
        {lines.map((l) => (
          <Text key={l} variant="body" accessible={false}>
            {l}
          </Text>
        ))}
      </View>
      <Text variant="label" tone="secondary" accessible={false}>
        {t('setupTabs.changeArrow')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderWidth: 1.5, borderRadius: radius.pill, padding: 3, gap: 3 },
  tab: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.md,
  },
  summaryText: { flex: 1, gap: 2 },
});
