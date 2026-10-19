import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FlipInEasyX } from 'react-native-reanimated';

import { useContentLevel } from '@/core/age';
import { usePlayerName } from '@/core/players';
import { punishmentText, usePunishments, type PunishmentCard } from '@/core/punishments';
import { radius, space, useTheme } from '@/core/theme';

import { Avatar } from './Avatar';
import { Badge } from './Badge';
import { Button } from './Button';
import { Panel } from './Panel';
import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * The shared punishment flow (BRIEF §4): losers draw cards from the chosen level, 4+ losers
 * share one group card, and each card can be swapped once. Renders nothing when punishments
 * are off or nobody lost.
 */
export function PunishmentPanel({ losers }: { losers: readonly number[] }) {
  const { t, i18n } = useTranslation('common');
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  const punishments = usePunishments();
  const content = useContentLevel();
  const [cards, setCards] = useState<PunishmentCard[] | null>(null);
  const join = (ids: readonly number[]) => ids.map(nameOf).join(t('list.and'));

  if (punishments.level === 'off' || losers.length === 0) return null;
  return (
    <Panel title={t('punishments.panelTitle')} icon="😈" testID="punishments">
      <Text variant="body" align="center">
        {t('punishments.losers', { names: join(losers) })}
      </Text>
      {cards == null ? (
        <Button
          testID="draw-punishment"
          variant="danger"
          icon="🎁"
          label={t('punishments.draw')}
          onPress={() => setCards(punishments.deal(losers, content))}
        />
      ) : (
        cards.map((card, i) => (
          <Animated.View
            key={`${card.id}-${card.swapped}`}
            entering={FlipInEasyX.delay(i * 120).duration(500)}
            accessibilityLiveRegion="polite"
          >
            <LinearGradient
              colors={colors.dangerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.card, { transform: [{ rotate: i % 2 ? '1deg' : '-1deg' }] }]}
            >
              <View style={styles.who}>
                {card.players.slice(0, 6).map((p) => (
                  <Avatar key={p} player={p} size={32} />
                ))}
              </View>
              <Text variant="label" align="center" style={{ color: colors.onDanger }}>
                {card.players.length > 1
                  ? t('punishments.group', { names: join(card.players) })
                  : nameOf(card.players[0] ?? 0)}
              </Text>
              <Text
                variant="title"
                align="center"
                style={{ color: colors.onDanger }}
                testID="punishment-text"
              >
                {punishmentText(i18n.language, card.draw.level, card.draw.index)}
              </Text>
              <View style={styles.level}>
                <Badge label={t(`punishments.levels.${card.draw.level}`)} />
              </View>
              {!card.swapped ? (
                <Pressable
                  testID={`swap-${card.id}`}
                  accessibilityLabel={t('punishments.swap')}
                  onPress={() =>
                    setCards((cs) =>
                      (cs ?? []).map((c) => (c.id === card.id ? punishments.swap(c, content) : c)),
                    )
                  }
                  style={styles.swap}
                >
                  <Text
                    variant="label"
                    align="center"
                    style={{ color: colors.onDanger, textDecorationLine: 'underline' }}
                  >
                    {t('punishments.swap')}
                  </Text>
                </Pressable>
              ) : null}
            </LinearGradient>
          </Animated.View>
        ))
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  who: { flexDirection: 'row', justifyContent: 'center', gap: -8 },
  level: { alignItems: 'center' },
  swap: { alignSelf: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
