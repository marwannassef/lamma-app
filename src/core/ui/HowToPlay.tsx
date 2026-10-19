import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

function Steps({ title, icon, steps }: { title: string; icon: string; steps: readonly string[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="label" tone="secondary">{`${icon} ${title}`}</Text>
      {steps.map((step, i) => (
        <View key={i} style={styles.step}>
          <View style={[styles.num, { backgroundColor: colors.surfaceRaised }]}>
            <Text variant="caption" tone="secondary" align="center">
              {String(i + 1)}
            </Text>
          </View>
          <Text variant="body" tone="muted" style={styles.flex}>
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Collapsible "How to play" card at the top of a game's setup: setting up, then playing. */
export function HowToPlay({
  setup,
  play,
  testID = 'how-to',
}: {
  setup: readonly string[];
  play: readonly string[];
  testID?: string;
}) {
  const { t } = useTranslation('common');
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('howTo.title')}
        onPress={() => setOpen((v) => !v)}
        style={styles.header}
      >
        <Text variant="label" style={styles.flex}>{`📖 ${t('howTo.title')}`}</Text>
        <Text variant="label" tone="secondary" accessible={false}>
          {open ? '▲' : '▼'}
        </Text>
      </Pressable>
      {open ? (
        <>
          <Steps title={t('howTo.setup')} icon="🛠️" steps={setup} />
          <Steps title={t('howTo.play')} icon="🎮" steps={play} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.card - 4,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  section: { gap: space.sm, paddingVertical: space.sm },
  step: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
