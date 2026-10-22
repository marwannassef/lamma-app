import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, Image, StyleSheet, View } from 'react-native';

import { gradients, radius, space, useTheme } from '@/core/theme';
import { Badge, Button, Pressable, Text } from '@/core/ui';
import type { GameModule } from '@/games/registry';

/** A game in the home list: logo, name, blurb, players and Play. */
export function GameCard({ game }: { game: GameModule }) {
  const { t } = useTranslation(['common', 'spy', 'werewolf', 'blendIn']);
  const { colors } = useTheme();
  const title = t(game.titleKey);
  const players = t('home.playersRange', { min: game.minPlayers, max: game.maxPlayers });
  const open = () => router.push(game.entryRoute);
  return (
    <Pressable
      testID={`game-${game.id}`}
      haptic={false}
      accessibilityLabel={[title, players, !game.ready && t('home.comingSoon')]
        .filter(Boolean)
        .join(', ')}
      onPress={open}
      style={({ pressed }) => [
        styles.cardShadow,
        { shadowColor: colors.glow, opacity: game.ready ? 1 : 0.85 },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <LinearGradient
        colors={game.ready ? gradients.brand : [colors.border, colors.border]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardFrame}
      >
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardTop}>
            <View>
              <Image
                source={game.icon}
                style={[styles.icon, !game.ready && styles.iconLocked]}
                accessibilityIgnoresInvertColors
              />
              {!game.ready ? (
                <View style={[styles.lock, { backgroundColor: colors.surfaceRaised }]}>
                  <Text accessible={false}>🔒</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.cardText}>
              <Text variant="title">{title}</Text>
              <Text variant="caption" tone="muted">
                {t(game.blurbKey)}
              </Text>
              <View style={styles.badges}>
                {game.mystery ? (
                  <Badge tone="secondary" label={t('games.mystery.teaser')} />
                ) : (
                  <Badge icon="👥" label={players} />
                )}
                {!game.ready ? <Badge tone="primary" label={t('home.comingSoon')} /> : null}
              </View>
            </View>
          </View>
          {game.ready ? (
            <Button
              testID={`play-${game.id}`}
              size="md"
              icon={I18nManager.isRTL ? '◀' : '▶'}
              label={t('home.play')}
              onPress={open}
            />
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    borderRadius: radius.card,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardFrame: { borderRadius: radius.card, padding: 3 },
  card: { borderRadius: radius.card - 3, padding: space.lg, gap: space.md },
  cardTop: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  icon: { width: 96, height: 96, borderRadius: 24 },
  iconLocked: { opacity: 0.55 },
  lock: {
    position: 'absolute',
    bottom: -6,
    end: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: space.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
