import { useKeepAwake } from 'expo-keep-awake';
import { Redirect, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, ThemeProvider, useTheme } from '@/core/theme';
import { ConfirmInline, Pressable, SecretGuard, Text } from '@/core/ui';

import type { GameState } from '../engine';
import { useWerewolf } from '../store';
import {
  DeathEffects,
  Discussion,
  Execution,
  MayorElection,
  MayorTieBreak,
  Morning,
  Vote,
} from './Day';
import Discovery from './Discovery';
import GameOver from './GameOver';
import { Glance, NightIntro } from './Night';
import Pass from './Pass';

const isSecret = (g: GameState) => g.phase.t === 'discovery' || g.phase.t === 'pass';

function PhaseScreen({ game }: { game: GameState }) {
  const ph = game.phase;
  switch (ph.t) {
    case 'discovery':
      return <Discovery key={`d-${ph.seat}`} game={game} seat={ph.seat} />;
    case 'nightIntro':
      return <NightIntro game={game} />;
    case 'glance':
      return <Glance game={game} endsAt={ph.endsAt} />;
    case 'pass':
      return <Pass key={`p-${ph.turn}-${ph.step}`} game={game} phase={ph} />;
    case 'morning':
      return <Morning game={game} report={ph.report} />;
    case 'deathEffects':
      return ph.queue[0] ? (
        <DeathEffects key={JSON.stringify(ph.queue[0])} game={game} effect={ph.queue[0]} />
      ) : null;
    case 'mayorElection':
      return <MayorElection game={game} />;
    case 'discussion':
      return <Discussion game={game} endsAt={ph.endsAt} pausedLeft={ph.pausedLeft} />;
    case 'vote':
      return <Vote game={game} />;
    case 'mayorTieBreak':
      return <MayorTieBreak game={game} tied={ph.tied} />;
    case 'execution':
      return <Execution game={game} playerId={ph.playerId} />;
    case 'gameOver':
      return <GameOver game={game} result={ph.result} />;
    default:
      return null;
  }
}

/** Host control on public screens: end the game (inline confirmation, never a native dialog). */
function HostBar() {
  const { t } = useTranslation(['werewolf', 'common']);
  const quit = useWerewolf((s) => s.quit);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [ask, setAsk] = useState(false);
  return (
    <View style={[styles.host, { paddingTop: insets.top + space.xs }]}>
      {ask ? (
        <ConfirmInline
          testID="quit-confirm"
          question={t('host.quitConfirm')}
          confirmLabel={t('host.quit')}
          cancelLabel={t('common:actions.cancel')}
          onConfirm={() => {
            quit();
            router.replace('/games/werewolf');
          }}
          onCancel={() => setAsk(false)}
        />
      ) : (
        <Pressable
          testID="quit"
          accessibilityLabel={t('host.quit')}
          onPress={() => setAsk(true)}
          style={[styles.quit, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text variant="label" tone="muted" accessible={false}>
            ✖
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Runs a Werewolf game from discovery to game over. The phone sits in the middle of the table. */
export default function Play() {
  useKeepAwake();
  const game = useWerewolf((s) => s.game);

  // The game is saved after every step; leaving by accident must not drop out of it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (!game) return <Redirect href="/games/werewolf" />;
  const secret = isSecret(game);

  return (
    <ThemeProvider scheme="dark">
      <Stack.Screen options={{ gestureEnabled: false }} />
      <StatusBar style="light" hidden={secret} />
      {secret ? (
        <SecretGuard>
          <PhaseScreen game={game} />
        </SecretGuard>
      ) : (
        <View style={styles.fill}>
          <PhaseScreen game={game} />
          {game.phase.t !== 'gameOver' ? <HostBar /> : null}
        </View>
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  host: { position: 'absolute', top: 0, start: space.lg, end: space.lg },
  quit: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
