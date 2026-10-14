import * as Haptics from 'expo-haptics';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import type { Pack, Word } from '@/core/content';
import { usePlayerName } from '@/core/players';
import { useSettings } from '@/core/settings/store';
import { useTheme } from '@/core/theme';
import { Button, Screen, Text } from '@/core/ui';

import { RoleCard } from '../components/RoleCard';

/** One player's secret card. Hidden from screenshots and the app switcher. */
export default function Card({
  player,
  pack,
  word,
  isSpy,
  spySeesCategory,
  onHide,
}: {
  player: number;
  pack: Pack;
  word: Word;
  isSpy: boolean;
  spySeesCategory: boolean;
  onHide(): void;
}) {
  const { t } = useTranslation('spy');
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  const haptics = useSettings((s) => s.haptics);
  const [covered, setCovered] = useState(AppState.currentState !== 'active');

  // Android: FLAG_SECURE blanks the recents thumbnail. iOS: blocks screen recording.
  usePreventScreenCapture('spy-card');

  // iOS snapshots the app on "inactive", so cover the card as soon as we leave "active".
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setCovered(s !== 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!haptics) return;
    void Haptics.impactAsync(
      isSpy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
  }, [haptics, isSpy]);

  return (
    <View style={styles.fill}>
      <Screen center>
        <Text variant="heading" tone="muted" align="center">
          {nameOf(player)}
        </Text>
        <RoleCard pack={pack} word={word} isSpy={isSpy} spySeesCategory={spySeesCategory} />
        <Button testID="hide-card" label={t('card.hide')} onPress={onHide} />
      </Screen>
      {covered ? (
        <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.bg }]}>
          <Text variant="title" tone="muted" align="center">
            {t('card.cover')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { alignItems: 'center', justifyContent: 'center' },
});
