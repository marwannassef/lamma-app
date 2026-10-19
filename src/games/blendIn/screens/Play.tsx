import { Redirect, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HostAudioControls, usePhaseAudio } from '@/core/audio';
import { allPacks, localized, type Pack } from '@/core/content';
import { usePlayerName } from '@/core/players';
import { space, useTheme } from '@/core/theme';
import { ConfirmInline, Pressable, Text, useStayAwake } from '@/core/ui';

import { audioCue, audioKey } from '../audio';
import { useBlendIn } from '../store';
import { Circle, Discuss, Escape, Over, Peek, Result, Vote } from './Phases';

function QuitButton() {
  const { t } = useTranslation(['blendIn', 'common']);
  const quit = useBlendIn((s) => s.quit);
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
            router.replace('/games/blend-in');
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
            <Text variant="label" tone="muted" accessible={false}>
              ✖
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Runs a Blend In game; the phone sits in the middle of the table between peeks. */
export default function Play() {
  useStayAwake();
  const game = useBlendIn((s) => s.game);
  const { i18n } = useTranslation();
  const nameOf = usePlayerName();
  const pack = game
    ? (allPacks.find((p) => p.id === game.round.packId) as Pack | undefined)
    : undefined;
  usePhaseAudio('blendIn', game ? audioKey(game) : 'none', () =>
    game && pack ? audioCue(game, nameOf, localized(pack.name, i18n.language)) : {},
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  if (!game) return <Redirect href="/games/blend-in" />;
  if (!pack) return <Redirect href="/games/blend-in" />;
  const ph = game.phase;
  const key = `${game.round.no}-${ph.t}`;

  let screen;
  switch (ph.t) {
    case 'peek':
      screen = <Peek key={`${key}-${ph.seat}`} game={game} pack={pack} seat={ph.seat} />;
      break;
    case 'circle':
      screen = (
        <Circle
          key={`${key}-${ph.clueRound}-${ph.turn}`}
          game={game}
          pack={pack}
          clueRound={ph.clueRound}
          turn={ph.turn}
        />
      );
      break;
    case 'discuss':
      screen = <Discuss key={key} />;
      break;
    case 'vote':
      screen = <Vote key={`${key}-${ph.among?.join(',') ?? 'all'}`} game={game} among={ph.among} />;
      break;
    case 'escape':
      screen = <Escape key={key} game={game} pack={pack} choices={ph.choices} />;
      break;
    case 'result':
      screen = (
        <Result
          key={key}
          game={game}
          pack={pack}
          outcome={ph.outcome}
          accused={ph.accused}
          guess={ph.guess}
          gain={ph.gain}
        />
      );
      break;
    case 'over':
      screen = <Over game={game} winners={ph.winners} />;
      break;
  }
  const secret = ph.t === 'peek' || ph.t === 'escape';

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      {screen}
      {!secret && ph.t !== 'over' ? <QuitButton /> : null}
    </View>
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
