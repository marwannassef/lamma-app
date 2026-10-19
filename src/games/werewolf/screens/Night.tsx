import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';
import { Button, Screen, Text, useCountdown } from '@/core/ui';

import type { GameState } from '../engine';
import { useWerewolf } from '../store';

/** "Night falls…" — the host starts the wolves' glance when everyone's eyes are closed. */
export function NightIntro({ game }: { game: GameState }) {
  const { t } = useTranslation('werewolf');
  const dispatch = useWerewolf((s) => s.dispatch);
  return (
    <Screen center>
      <Text style={styles.big} align="center" accessible={false}>
        🌙
      </Text>
      <Text variant="title" align="center">
        {t('night.title', { n: game.night })}
      </Text>
      <Text variant="heading" align="center" tone="muted" testID="narration">
        {t('night.fall')}
      </Text>
      <Button
        testID="wake-wolves"
        icon="🐺"
        label={t('night.wolvesWake')}
        onPress={() => dispatch({ t: 'nightIntroDone' })}
      />
    </Screen>
  );
}

/** The wolves' silent glance: a countdown, then "everyone open your eyes, pass the phone". */
export function Glance({ game, endsAt }: { game: GameState; endsAt: number }) {
  const { t } = useTranslation('werewolf');
  const { colors } = useTheme();
  const dispatch = useWerewolf((s) => s.dispatch);
  const left = useCountdown(endsAt);
  const over = left === 0;
  return (
    <Screen center>
      {over ? (
        <>
          <Text variant="heading" align="center" testID="narration">
            {t('night.glanceEnd')}
          </Text>
          <Button
            testID="start-pass"
            icon="📱"
            label={t('night.startPass')}
            onPress={() => dispatch({ t: 'glanceDone' })}
          />
        </>
      ) : (
        <>
          <Text variant="heading" align="center" testID="narration">
            {game.wolfKills === 2
              ? `${t('night.glance')} ${t('night.glanceTwice')}`
              : t('night.glance')}
          </Text>
          <View style={[styles.ring, { borderColor: colors.danger }]}>
            <Text variant="hero" style={styles.count} align="center">
              {String(Math.ceil(left / 1000))}
            </Text>
          </View>
          <Text style={styles.big} align="center" accessible={false}>
            💓
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 72, lineHeight: 90 },
  ring: {
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 64, lineHeight: 76 },
  card: { borderRadius: radius.card },
  gap: { gap: space.md },
});
