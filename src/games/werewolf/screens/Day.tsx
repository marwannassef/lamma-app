import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { mixer } from '@/core/audio';
import { usePlayerName } from '@/core/players';
import { radius, space, useTheme } from '@/core/theme';
import { Avatar, Button, Panel, PlayerPicker, Screen, Text, useCountdown } from '@/core/ui';

import { RoleIcon } from '../components/RoleIcon';
import { RoleCard } from '../components/RoleCard';
import type { Effect, GameState, NightReport, PlayerId } from '../engine';
import { useWerewolf } from '../store';

const usePicker = () => {
  const { colors } = useTheme();
  return {
    fg: colors.text,
    muted: colors.textMuted,
    bg: colors.surfaceRaised,
    accent: colors.secondary,
  };
};

/** Morning: who died (and, by house rule, their role, causes and saves). */
export function Morning({ game, report }: { game: GameState; report: NightReport }) {
  const { t } = useTranslation(['werewolf', 'common']);
  const nameOf = usePlayerName();
  const dispatch = useWerewolf((s) => s.dispatch);
  const names = report.deaths.map((d) => nameOf(d.playerId)).join(t('common:list.and'));
  const headline =
    report.deaths.length === 0
      ? t('morning.none')
      : report.deaths.length === 1
        ? t('morning.single', { name: names })
        : t('morning.multi', { names });
  return (
    <Screen
      footer={
        <Button
          testID="morning-done"
          icon="☀️"
          label={t('morning.continue')}
          onPress={() => dispatch({ t: 'morningDone' })}
        />
      }
    >
      <Text style={styles.big} align="center" accessible={false}>
        🌅
      </Text>
      <Text variant="title" align="center">
        {t('morning.title')}
      </Text>
      <Text variant="heading" align="center" testID="narration">
        {headline}
      </Text>
      {report.deaths.map((d) => {
        const role = game.players[d.playerId]?.dealtRole;
        return (
          <Panel key={d.playerId}>
            <View style={styles.row}>
              <Avatar player={d.playerId} size={48} />
              {game.rules.revealRoleOnDeath && role ? <RoleIcon role={role} size={48} /> : null}
              <View style={styles.flex}>
                <Text variant="label">{nameOf(d.playerId)}</Text>
                {game.rules.revealRoleOnDeath && role ? (
                  <Text variant="caption" tone="muted">
                    {t('morning.was', { name: nameOf(d.playerId), role: t(`roles.${role}.name`) })}
                  </Text>
                ) : null}
                {game.rules.detailedNarration ? (
                  <Text variant="caption" tone="muted">
                    {t(`morning.cause.${d.cause as 'wolves'}`, { name: nameOf(d.playerId) })}
                  </Text>
                ) : null}
              </View>
            </View>
          </Panel>
        );
      })}
      {game.rules.detailedNarration
        ? report.saves.map((s, i) => (
            <Text key={i} variant="body" tone="muted" align="center">
              {t(`morning.saved.${s.by}`)}
            </Text>
          ))
        : null}
    </Screen>
  );
}

/** Hunter's last shot and the Mayor's badge, handed to that player in public. */
export function DeathEffects({ game, effect }: { game: GameState; effect: Effect }) {
  const { t } = useTranslation('werewolf');
  const nameOf = usePlayerName();
  const dispatch = useWerewolf((s) => s.dispatch);
  const picker = usePicker();
  const [picked, setPicked] = useState<PlayerId | null>(null);
  const isHunter = effect.t === 'hunterShot';
  const who = isHunter ? effect.hunter : effect.mayor;
  return (
    <Screen
      footer={
        <View style={styles.stack}>
          <Button
            testID="effect-confirm"
            icon={isHunter ? '🏹' : '🎖️'}
            label={picked != null ? nameOf(picked) : '…'}
            onPress={() => {
              if (picked == null) return;
              dispatch(
                isHunter ? { t: 'hunterShoot', target: picked } : { t: 'passBadge', to: picked },
              );
            }}
          />
          {!isHunter ? (
            <Button
              variant="ghost"
              size="md"
              testID="effect-nobody"
              label={t('effects.nobody')}
              onPress={() => dispatch({ t: 'passBadge', to: null })}
            />
          ) : null}
        </View>
      }
    >
      <View style={styles.center}>
        <Avatar player={who} size={72} />
        <Text variant="heading" align="center" testID="narration">
          {isHunter
            ? t('effects.hunter', { name: nameOf(who) })
            : t('effects.mayor', { name: nameOf(who) })}
        </Text>
      </View>
      <PlayerPicker
        players={game.players}
        selected={picked != null ? [picked] : []}
        onToggle={setPicked}
        {...picker}
      />
    </Screen>
  );
}

export function MayorElection({ game }: { game: GameState }) {
  const { t } = useTranslation('werewolf');
  const nameOf = usePlayerName();
  const dispatch = useWerewolf((s) => s.dispatch);
  const picker = usePicker();
  const [picked, setPicked] = useState<PlayerId | null>(null);
  return (
    <Screen
      footer={
        <Button
          testID="elect"
          icon="🎖️"
          label={picked != null ? nameOf(picked) : '…'}
          onPress={() => picked != null && dispatch({ t: 'electMayor', id: picked })}
        />
      }
    >
      <Text variant="title" align="center">
        {t('day.title', { n: game.day })}
      </Text>
      <Text variant="heading" align="center">
        {t('day.electMayor')}
      </Text>
      <PlayerPicker
        players={game.players}
        selected={picked != null ? [picked] : []}
        onToggle={setPicked}
        {...picker}
      />
    </Screen>
  );
}

/** Discussion timer: pause, +30 s, vote now; orange for the last 30 s; votes when it runs out. */
export function Discussion({
  game,
  endsAt,
  pausedLeft,
}: {
  game: GameState;
  endsAt: number | null;
  pausedLeft: number | null;
}) {
  const { t } = useTranslation('werewolf');
  const { colors } = useTheme();
  const dispatch = useWerewolf((s) => s.dispatch);
  const live = useCountdown(endsAt ?? 0);
  const left = endsAt != null ? live : pausedLeft;
  const ended = useRef(false);
  useEffect(() => {
    if (endsAt != null && live === 0 && !ended.current) {
      ended.current = true;
      dispatch({ t: 'endDiscussion' });
    }
  }, [dispatch, endsAt, live]);
  // The tavern music speeds up in the last 30 seconds (§10).
  const hurry = endsAt != null && live > 0 && live <= 30_000;
  useEffect(() => mixer.setRate('music', hurry ? 1.25 : 1), [hurry]);
  const secs = left == null ? null : Math.ceil(left / 1000);
  const late = secs != null && secs <= 30;
  const clock =
    secs == null ? '∞' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <Screen
      footer={
        <Button
          testID="vote-now"
          icon="☝️"
          label={t('day.voteNow')}
          onPress={() => dispatch({ t: 'endDiscussion' })}
        />
      }
    >
      <Text variant="title" align="center">
        {t('day.title', { n: game.day })}
      </Text>
      <Text variant="heading" align="center" tone="muted">
        {t('day.discussion')}
      </Text>
      <View
        style={[styles.timer, { borderColor: late ? colors.primary : colors.secondary }]}
        accessible
        accessibilityRole="timer"
        accessibilityLabel={secs == null ? t('day.untimed') : clock}
      >
        <Text
          variant="hero"
          style={[styles.clock, late && { color: colors.primary }]}
          testID="timer"
        >
          {clock}
        </Text>
      </View>
      {secs != null ? (
        <View style={styles.controls}>
          <View style={styles.flex}>
            <Button
              size="md"
              variant="ghost"
              icon={endsAt != null ? '⏸' : '▶'}
              label={endsAt != null ? t('day.pause') : t('day.resume')}
              onPress={() =>
                dispatch({ t: endsAt != null ? 'pauseDiscussion' : 'resumeDiscussion' })
              }
            />
          </View>
          <View style={styles.flex}>
            <Button
              size="md"
              variant="ghost"
              label={t('day.add')}
              onPress={() => dispatch({ t: 'addTime' })}
            />
          </View>
        </View>
      ) : (
        <Text variant="body" tone="muted" align="center">
          {t('day.untimed')}
        </Text>
      )}
    </Screen>
  );
}

/** "3… 2… 1… Point!", then the host enters the most-pointed player, a tie, or no execution. */
export function Vote({ game }: { game: GameState }) {
  const { t } = useTranslation('werewolf');
  const nameOf = usePlayerName();
  const dispatch = useWerewolf((s) => s.dispatch);
  const picker = usePicker();
  const [count, setCount] = useState(3);
  const [tie, setTie] = useState(false);
  const [picked, setPicked] = useState<PlayerId[]>([]);
  useEffect(() => {
    if (count <= 0) return;
    mixer.sfx('countdown');
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count]);

  if (count > 0) {
    return (
      <Screen center>
        <Text variant="heading" align="center" tone="muted">
          {t('day.countdown')}
        </Text>
        <Text variant="hero" align="center" style={styles.countdown} testID="countdown">
          {String(count)}
        </Text>
      </Screen>
    );
  }
  return (
    <Screen
      footer={
        <View style={styles.stack}>
          {tie ? (
            <Button
              testID="confirm-tie"
              icon="⚖️"
              label={t('day.confirmTie')}
              onPress={() =>
                picked.length > 1 && dispatch({ t: 'vote', choice: { t: 'tie', tied: picked } })
              }
            />
          ) : (
            <Button
              testID="banish"
              icon="☝️"
              label={
                picked[0] != null
                  ? t('day.banished', { name: nameOf(picked[0]) })
                  : t('day.voteTitle')
              }
              onPress={() =>
                picked[0] != null && dispatch({ t: 'vote', choice: { t: 'player', id: picked[0] } })
              }
            />
          )}
          <View style={styles.controls}>
            <View style={styles.flex}>
              <Button
                size="md"
                variant="ghost"
                testID="tie-mode"
                label={tie ? '↩︎' : t('day.tie')}
                onPress={() => {
                  setTie((v) => !v);
                  setPicked([]);
                }}
              />
            </View>
            <View style={styles.flex}>
              <Button
                size="md"
                variant="ghost"
                testID="no-execution"
                label={t('day.noExecution')}
                onPress={() => dispatch({ t: 'vote', choice: { t: 'none' } })}
              />
            </View>
          </View>
        </View>
      }
    >
      <Text variant="hero" align="center">
        {t('day.point')}
      </Text>
      <Text variant="heading" align="center" tone="muted">
        {tie ? t('day.tieHint') : t('day.voteTitle')}
      </Text>
      <PlayerPicker
        players={game.players}
        selected={picked}
        onToggle={(id) =>
          setPicked((cur) =>
            tie ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id],
          )
        }
        {...picker}
      />
    </Screen>
  );
}

export function MayorTieBreak({ game, tied }: { game: GameState; tied: PlayerId[] }) {
  const { t } = useTranslation('werewolf');
  const nameOf = usePlayerName();
  const dispatch = useWerewolf((s) => s.dispatch);
  const picker = usePicker();
  const [picked, setPicked] = useState<PlayerId | null>(null);
  const mayor = game.mayor ?? 0;
  return (
    <Screen
      footer={
        <View style={styles.stack}>
          <Button
            testID="mayor-pick"
            icon="🎖️"
            label={picked != null ? t('day.banished', { name: nameOf(picked) }) : '…'}
            onPress={() => picked != null && dispatch({ t: 'mayorDecide', pick: picked })}
          />
          <Button
            size="md"
            variant="ghost"
            testID="mayor-spare"
            label={t('day.spare')}
            onPress={() => dispatch({ t: 'mayorDecide', pick: null })}
          />
        </View>
      }
    >
      <View style={styles.center}>
        <Avatar player={mayor} size={72} />
        <Text variant="heading" align="center">
          {t('day.mayorBreak', { name: nameOf(mayor) })}
        </Text>
      </View>
      <PlayerPicker
        players={game.players}
        selected={picked != null ? [picked] : []}
        include={(p) => tied.includes(p.id)}
        onToggle={setPicked}
        {...picker}
      />
    </Screen>
  );
}

export function Execution({ game, playerId }: { game: GameState; playerId: PlayerId | null }) {
  const { t } = useTranslation('werewolf');
  const nameOf = usePlayerName();
  const dispatch = useWerewolf((s) => s.dispatch);
  const role = playerId != null ? game.players[playerId]?.dealtRole : undefined;
  return (
    <Screen
      footer={
        <Button
          testID="execution-done"
          icon="🌙"
          label={t('day.continue')}
          onPress={() => dispatch({ t: 'executionDone' })}
        />
      }
    >
      {playerId == null ? (
        <Text variant="title" align="center" testID="narration">
          {t('day.nobody')}
        </Text>
      ) : (
        <>
          <View style={styles.center}>
            <Avatar player={playerId} size={96} />
            <Text variant="title" align="center" testID="narration">
              {t('day.banished', { name: nameOf(playerId) })}
            </Text>
          </View>
          {game.rules.revealRoleOnDeath && role ? (
            <>
              <Text variant="heading" align="center" tone="muted">
                {t('day.theyWere', { role: t(`roles.${role}.name`) })}
              </Text>
              <RoleCard role={role} />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  big: { fontSize: 64, lineHeight: 80 },
  center: { alignItems: 'center', gap: space.md },
  stack: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  timer: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: { fontSize: 56, lineHeight: 68 },
  controls: { flexDirection: 'row', gap: space.sm },
  countdown: { fontSize: 120, lineHeight: 140 },
  card: { borderRadius: radius.card },
});
