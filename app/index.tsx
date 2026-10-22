import { Redirect, router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAge, useContentLevel } from '@/core/age';
import { radius, space, useTheme } from '@/core/theme';
import { Badge, Pressable, Screen, Text } from '@/core/ui';
import { useSettings } from '@/core/settings/store';
import { games, homeOrder } from '@/games/registry';
import { GameList } from '@/home/GameList';
import { GameWheel } from '@/home/GameWheel';
import { useWerewolf } from '@/games/werewolf/store';
import { regionTheme } from '@/games/werewolf/theme';

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

export default function Home() {
  const { t } = useTranslation(['common', 'spy', 'werewolf', 'blendIn']);
  const { colors } = useTheme();
  const audience = useAge((s) => s.audience);
  const pin = useAge((s) => s.pin);
  const firstTheme = useWerewolf((s) => s.lastTheme) ?? regionTheme();
  const level = useContentLevel();
  const view = useSettings((s) => s.homeView);
  const setView = useSettings((s) => s.setHomeView);

  // First launch asks "Who's playing tonight?" before anything else.
  // First launch, or an install from before the PIN was required (monetization §7).
  if (audience == null || pin == null) return <Redirect href="/welcome" />;

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          testID="join-game"
          accessibilityLabel={t('net.joinTitle')}
          onPress={() => router.push('/join' as Href)}
          style={[styles.joinBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text variant="label" accessible={false} numberOfLines={1}>
            {`📶 ${t('net.joinTitle')}`}
          </Text>
        </Pressable>
        <View style={styles.flex} />
        <Pressable
          testID="open-shop"
          accessibilityLabel={t('shop.title')}
          onPress={() => router.push('/shop' as Href)}
          style={[
            styles.settingsBtn,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={styles.gear} accessible={false}>
            🛍️
          </Text>
        </Pressable>
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
        {level === 'kids' ? (
          <Badge
            testID="kids-badge"
            tone="secondary"
            icon="🧒"
            label={t('age.kidsBadge')}
            align="center"
          />
        ) : null}
      </View>

      <View style={styles.pickRow}>
        <Text
          variant="heading"
          accessibilityRole="header"
          accessibilityLabel={t('home.pickGame')}
          style={styles.flex}
        >
          {`🎮 ${t('home.pickGame')}`}
        </Text>
        <View
          style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="radiogroup"
        >
          {(['wheel', 'list'] as const).map((v) => (
            <Pressable
              key={v}
              testID={`view-${v}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: view === v }}
              accessibilityLabel={t(`home.view.${v}`)}
              onPress={() => setView(v)}
              style={[styles.toggleBtn, view === v && { backgroundColor: colors.secondary }]}
            >
              <Text variant="label" accessible={false}>
                {v === 'wheel' ? '🎡' : '☰'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {view === 'wheel' ? (
        <GameWheel games={homeOrder(games, firstTheme)} />
      ) : (
        <GameList games={homeOrder(games, firstTheme)} />
      )}

      <View style={styles.footer}>
        <Text variant="caption" tone="muted" align="center">
          {t('publisher')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toggle: { flexDirection: 'row', borderWidth: 1.5, borderRadius: radius.pill, padding: 2 },
  toggleBtn: {
    minWidth: 48,
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  joinBtn: {
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  footer: { flex: 1, justifyContent: 'flex-end', paddingTop: space.lg },
});
