import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { gradients, radius, space, useTheme } from '@/core/theme';
import { Badge, Button, Pressable, Screen, Text } from '@/core/ui';
import { games, type GameModule } from '@/games/registry';

function Logo() {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 1800 })),
      6,
    );
  }, [pulse, reduce]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.04 }, { rotate: `${(pulse.value - 0.5) * 3}deg` }],
  }));
  return (
    <Animated.View style={[styles.logoGlow, { shadowColor: colors.glow }, style]}>
      <Image
        source={require('@/assets/images/lamma-logo.png')}
        style={styles.logo}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    </Animated.View>
  );
}

function GameCard({ game }: { game: GameModule }) {
  const { t } = useTranslation(['common', 'spy', 'werewolf']);
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
              <Text variant="caption" tone="muted" numberOfLines={3}>
                {t(game.blurbKey)}
              </Text>
              <View style={styles.badges}>
                <Badge icon="👥" label={players} />
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

export default function Home() {
  const { t } = useTranslation(['common', 'spy', 'werewolf']);
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          testID="open-settings"
          accessibilityLabel={t('home.openSettings')}
          onPress={() => router.push('/settings')}
          style={[
            styles.settingsBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={styles.gear} accessible={false}>
            ⚙️
          </Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Logo />
        <Text variant="hero" tone="secondary" align="center" testID="app-title">
          {t('appName')}
        </Text>
        <Text variant="label" tone="muted" align="center">
          {t('tagline')}
        </Text>
      </View>

      <Text variant="heading">{`🎮 ${t('home.pickGame')}`}</Text>

      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}

      <View style={styles.footer}>
        <Text variant="caption" tone="muted" align="center">
          {t('publisher')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  settingsBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gear: { fontSize: 22, lineHeight: 28 },
  hero: { alignItems: 'center', gap: space.xs, paddingBottom: space.sm },
  logoGlow: {
    borderRadius: 40,
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
    marginBottom: space.sm,
  },
  logo: { width: 150, height: 150, borderRadius: 36 },
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
  footer: { flex: 1, justifyContent: 'flex-end', paddingTop: space.lg },
});
