import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { space } from '@/core/theme';
import { BackHeader, Badge, Screen, Text } from '@/core/ui';
import { getGame } from '@/games/registry';

/** Entry for a game whose screens haven't shipped yet (or the secret teaser). */
export default function GameEntry() {
  const { t } = useTranslation(['common', 'spy', 'werewolf', 'blendIn']);
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = getGame(gameId);
  if (!game) return <Redirect href="/" />;

  return (
    <Screen>
      <BackHeader title={t(game.titleKey)} image={game.icon} />
      <View style={styles.body}>
        <Image source={game.icon} style={styles.icon} accessibilityIgnoresInvertColors />
        <Text variant="body" align="center">
          {game.mystery ? t('games.mystery.reveal') : t(game.blurbKey)}
        </Text>
        <Badge
          testID="coming-soon"
          tone="primary"
          icon="🔒"
          label={t('home.comingSoon')}
          align="center"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  icon: { width: 180, height: 180, borderRadius: 40 },
});
