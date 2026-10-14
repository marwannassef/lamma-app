import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { radius, space, useTheme } from '@/core/theme';
import { Pressable, Screen, Text } from '@/core/ui';
import { games } from '@/games/registry';

export default function Home() {
  const { t } = useTranslation(['common', 'spy']);
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          testID="open-settings"
          accessibilityLabel={t('home.openSettings')}
          onPress={() => router.push('/settings')}
          style={[styles.settingsBtn, { backgroundColor: colors.surface }]}
        >
          <Text variant="label" tone="secondary">
            {t('home.openSettings')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text variant="hero" tone="secondary" align="center" testID="app-title">
          {t('appName')}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {t('tagline')}
        </Text>
      </View>

      <Text variant="heading">{t('home.pickGame')}</Text>

      {games.map((game) => {
        const title = t(game.titleKey);
        const players = t('home.playersRange', { min: game.minPlayers, max: game.maxPlayers });
        return (
          <Pressable
            key={game.id}
            onPress={() => router.push(game.entryRoute)}
            testID={`game-${game.id}`}
            accessibilityLabel={[title, players, !game.ready && t('home.comingSoon')]
              .filter(Boolean)
              .join(', ')}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Image source={game.icon} style={styles.icon} accessibilityIgnoresInvertColors />
            <View style={styles.tileText}>
              <Text variant="heading">{title}</Text>
              <Text variant="caption" tone="muted">
                {t(game.blurbKey)}
              </Text>
              <View style={styles.meta}>
                <Text variant="caption" tone="secondary">
                  {players}
                </Text>
                {!game.ready && (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text variant="caption" tone="onPrimary">
                      {t('home.comingSoon')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      })}

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
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', gap: space.xs, paddingVertical: space.lg },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  icon: { width: 72, height: 72, borderRadius: radius.md },
  tileText: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  badge: { paddingHorizontal: space.sm, borderRadius: radius.pill },
  footer: { flex: 1, justifyContent: 'flex-end' },
});
