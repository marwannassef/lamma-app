import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { space } from '@/core/theme';
import { Screen, Text } from '@/core/ui';
import { BackHeader } from '@/core/ui/BackHeader';
import { getGame } from '@/games/registry';

/** Placeholder entry for a game whose screens haven't shipped yet (Spy lands in M4). */
export default function GameEntry() {
  const { t } = useTranslation(['common', 'spy']);
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = getGame(gameId);
  if (!game) return <Redirect href="/" />;

  return (
    <Screen>
      <BackHeader title={t(game.titleKey)} />
      <View style={styles.body}>
        <Image source={game.icon} style={styles.icon} accessibilityIgnoresInvertColors />
        <Text variant="body" align="center">
          {t(game.blurbKey)}
        </Text>
        <Text variant="heading" tone="secondary" align="center" testID="coming-soon">
          {t('home.comingSoon')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  icon: { width: 144, height: 144, borderRadius: 32 },
});
