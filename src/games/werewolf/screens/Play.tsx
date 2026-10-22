import { Redirect, router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HostAudioControls, pickLine, usePhaseAudio } from '@/core/audio';
import { mathRng } from '@/core/rng';
import { PlayerNamesContext, usePlayerName } from '@/core/players';
import { useSettings } from '@/core/settings/store';
import { space, ThemeProvider, useTheme } from '@/core/theme';
import {
  ConfirmInline,
  Pressable,
  ScreenBackground,
  ScreenTopInset,
  SecretGuard,
  Text,
  useStayAwake,
} from '@/core/ui';

import { useStoryText } from '../components/story';
import { audioCue, audioKey } from '../audio';
import { MoonlitBackground } from '../components/MoonlitBackground';
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
import { HostActions, HostOwnChoice, HostReveal } from './NetHost';
import { getWerewolfRoom, openWerewolfRoom } from '../net/room';
import { useWerewolfT } from '../components/i18n';

const isSecret = (g: GameState) =>
  g.phase.t === 'discovery' ||
  g.phase.t === 'pass' ||
  g.phase.t === 'reveal' ||
  g.phase.t === 'actions';

function PhaseScreen({ game }: { game: GameState }) {
  const ph = game.phase;
  switch (ph.t) {
    case 'discovery':
      return <Discovery key={`d-${ph.seat}`} game={game} seat={ph.seat} />;
    case 'reveal':
      return <HostReveal game={game} />;
    case 'actions':
      return <HostActions key={`a-${game.night}`} game={game} />;
    case 'nightIntro':
      return <NightIntro game={game} />;
    case 'glance':
      return <Glance game={game} endsAt={ph.endsAt} />;
    case 'pass':
      return <Pass key={`p-${ph.turn}-${ph.step}`} game={game} phase={ph} />;
    case 'morning':
      return <Morning game={game} report={ph.report} story={ph.story} />;
    case 'deathEffects':
      if (game.mode === 'network') return <HostOwnChoice game={game} />;
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
      if (game.mode === 'network') return <HostOwnChoice game={game} />;
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
  const { t } = useWerewolfT(['common']);
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
        <View style={styles.hostRow}>
          <HostAudioControls />
          <Pressable
            testID="quit"
            accessibilityLabel={t('host.quit')}
            onPress={() => setAsk(true)}
            style={[styles.quit, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text variant="label" tone="muted" accessible={false} maxFontSizeMultiplier={1}>
              ✖
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const BACKDROP = {
  werewolf: <MoonlitBackground theme="werewolf" />,
  mafia: <MoonlitBackground theme="mafia" />,
};
/** Room the overlaid host bar takes at the top of public screens. */
const HOST_BAR_HEIGHT = 44;

/** Runs a Werewolf game from discovery to game over. The phone sits in the middle of the table. */
export default function Play() {
  useStayAwake();
  const game = useWerewolf((s) => s.game);
  const netMembers = useWerewolf((s) => s.netMembers);
  const myName = useSettings((s) => s.myName);
  const { t } = useWerewolfT();
  const nameOf = usePlayerName();
  const tell = useStoryText();
  usePhaseAudio('werewolf', game ? audioKey(game) : 'none', () => {
    if (!game) return {};
    const cue = audioCue(game, nameOf, (r) => t(`roles.${r}.name` as never), tell);
    if (!cue.line || !('key' in cue.line)) return cue;
    // Narration follows the theme too: resolve the line here, one variant at random.
    const variants = t(
      cue.line.key as never,
      { ...cue.line.params, returnObjects: true } as never,
    ) as unknown;
    const text = Array.isArray(variants)
      ? pickLine(variants as string[], mathRng)
      : String(variants);
    return { ...cue, line: { text } };
  });

  // A network game survives a relaunch: reopen the room so the phones find their seats again.
  const network = game?.mode === 'network';
  useEffect(() => {
    if (!network || getWerewolfRoom() || !game) return;
    const host = netMembers?.find((m) => m.isHost);
    void openWerewolfRoom({ name: host?.name ?? myName, theme: game.theme, kids: game.kids }).catch(
      () => undefined,
    );
  }, [game, myName, netMembers, network]);

  // The game is saved after every step; leaving by accident must not drop out of it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (!game) return <Redirect href="/games/werewolf" />;
  const secret = isSecret(game);

  return (
    <PlayerNamesContext.Provider value={network ? (netMembers?.map((m) => m.name) ?? null) : null}>
      <ThemeProvider scheme="dark">
        <ScreenBackground.Provider value={BACKDROP[game.theme]}>
          <Stack.Screen options={{ gestureEnabled: false }} />
          <StatusBar style="light" hidden={secret} />
          {secret ? (
            <SecretGuard>
              <PhaseScreen game={game} />
            </SecretGuard>
          ) : (
            <View style={styles.fill}>
              <ScreenTopInset.Provider value={game.phase.t === 'gameOver' ? 0 : HOST_BAR_HEIGHT}>
                <PhaseScreen game={game} />
              </ScreenTopInset.Provider>
              {game.phase.t !== 'gameOver' ? <HostBar /> : null}
            </View>
          )}
        </ScreenBackground.Provider>
      </ThemeProvider>
    </PlayerNamesContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  host: { position: 'absolute', top: 0, start: space.lg, end: space.lg },
  hostRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quit: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
