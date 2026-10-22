import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePlayerName, usePlayers } from '@/core/players';
import { fitScores, useSession } from '@/core/session';
import { space, useTheme } from '@/core/theme';
import { Avatar, Button, Confetti, Panel, Scoreboard, Screen, SoftUpsell, Text } from '@/core/ui';

import { TEAM_COLOR } from '../components/meta';
import { RoleIcon } from '../components/RoleIcon';
import { ROLES, scoreGame, type GameState, type WinResult } from '../engine';
import { useWerewolf } from '../store';
import { useWerewolfT } from '../components/i18n';

const EMOJI: Record<WinResult['outcome'], string> = {
  village: '🏡',
  wolves: '🐺',
  tanner: '🪢',
  serialKiller: '🔪',
  lovers: '❤️',
  draw: '🕯️',
};

/** Who won, everyone's roles, and points added once to the shared scoreboard (§8). */
export default function GameOver({ game, result }: { game: GameState; result: WinResult }) {
  const { t } = useWerewolfT();
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  const count = usePlayers((s) => s.count);
  const session = useSession();
  const { scored, markScored, quit } = useWerewolf();

  useEffect(() => {
    if (scored) return;
    session.addPoints(scoreGame(result, game.players.length));
    markScored();
  }, [game.players.length, markScored, result, scored, session]);

  const leave = (to: '/' | '/games/werewolf') => {
    quit();
    router.replace(to);
  };

  return (
    <View style={styles.fill}>
      <Screen
        footer={
          <View style={styles.stack}>
            <Button
              testID="play-again"
              icon="🔁"
              label={t('over.playAgain')}
              onPress={() => leave('/games/werewolf')}
            />
            <Button
              size="md"
              variant="ghost"
              testID="go-home"
              label={t('over.home')}
              onPress={() => leave('/')}
            />
          </View>
        }
      >
        <Text style={styles.big} align="center" accessible={false}>
          {EMOJI[result.outcome]}
        </Text>
        <Text variant="title" tone="secondary" align="center" testID="outcome">
          {t(`over.outcome.${result.outcome}`)}
        </Text>
        {result.winners.length ? (
          <Panel title={t('over.winners')} icon="🏆">
            <View style={styles.winners}>
              {result.winners.map((id) => (
                <View key={id} style={styles.winner}>
                  <Avatar player={id} size={48} ring={colors.gold} />
                  <Text variant="caption" align="center" numberOfLines={1}>
                    {nameOf(id)}
                  </Text>
                </View>
              ))}
            </View>
          </Panel>
        ) : null}
        <Panel title={t('over.roles')} icon="🃏">
          {game.players.map((p) => (
            <View key={p.id} style={styles.row}>
              <Avatar player={p.id} size={36} />
              <Text variant="label" style={styles.flex} numberOfLines={1}>
                {p.alive ? nameOf(p.id) : `💀 ${nameOf(p.id)}`}
              </Text>
              <Text variant="caption" style={{ color: TEAM_COLOR[ROLES[p.dealtRole].team] }}>
                {t(`roles.${p.dealtRole}.name`)}
              </Text>
              <RoleIcon role={p.dealtRole} size={32} />
            </View>
          ))}
        </Panel>
        <Panel>
          <Scoreboard scores={fitScores(session.scores, count)} gains={session.lastGain} />
        </Panel>
        <SoftUpsell />
      </Screen>
      {result.winners.length ? <Confetti /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  big: { fontSize: 72, lineHeight: 90 },
  stack: { gap: space.sm },
  winners: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  winner: { width: 64, alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
});
