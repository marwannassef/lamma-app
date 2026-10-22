// The host phone during a network game's secret steps (werewolf-network.md §2.1): its own
// player's turn first, then a count of who's done (never names), and the offline fallback.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePlayerName } from '@/core/players';
import { space, STEALTH } from '@/core/theme';
import { Button, Screen, Text } from '@/core/ui';

import { useWerewolfT } from '../components/i18n';
import { actingSeat, viewFor, type GameState, type PlayerId } from '../engine';
import { useWerewolfRoom } from '../net/room';
import { DeathEffects, MayorTieBreak } from './Day';
import { ActionTurn, RevealTurn, TurnHandoff } from './NetTurn';

/** Who still has to act, which of them are on this phone or offline, and how to act for them. */
function useSeats(pending: readonly PlayerId[]) {
  const { room, snapshot } = useWerewolfRoom();
  const hostSeat = room?.hostSeat ?? 0;
  const online = (seat: PlayerId) => snapshot?.members[seat]?.online ?? false;
  return {
    room,
    hostSeat,
    hostPending: pending.includes(hostSeat),
    offline: pending.filter((s) => s !== hostSeat && !online(s)),
  };
}

/** The public "waiting" screen: a count, plus a way to play an offline phone's turn here. */
function Waiting({
  title,
  done,
  offline,
  onPlayHere,
}: {
  title: string;
  done: string;
  offline: readonly PlayerId[];
  onPlayHere(seat: PlayerId): void;
}) {
  const { t } = useWerewolfT();
  const nameOf = usePlayerName();
  return (
    <Screen stealthColor={STEALTH.bg} center>
      <Text variant="heading" align="center" style={styles.text}>
        {title}
      </Text>
      <Text
        variant="hero"
        align="center"
        style={styles.text}
        testID="net-progress"
        accessibilityLiveRegion="polite"
      >
        {done}
      </Text>
      {offline.map((seat) => (
        <View key={seat} style={styles.stack}>
          <Text variant="caption" align="center" style={styles.muted}>
            {t('net.offlineSeat', { name: nameOf(seat) })}
          </Text>
          <Button
            testID={`play-here-${seat}`}
            variant="ghost"
            size="md"
            label={t('net.playHere', { name: nameOf(seat) })}
            onPress={() => onPlayHere(seat)}
          />
        </View>
      ))}
    </Screen>
  );
}

/** Everyone looks at their own card; the host player's card is behind a hold-to-open. */
export function HostReveal({ game }: { game: GameState }) {
  const { t } = useWerewolfT();
  const ph = game.phase.t === 'reveal' ? game.phase : null;
  const pending = ph ? game.players.map((p) => p.id).filter((id) => !ph.seen.includes(id)) : [];
  const { room, hostSeat, hostPending, offline } = useSeats(pending);
  // The seat whose card is open on this phone, and whether it's past the handoff.
  const [turn, setTurn] = useState<{ seat: PlayerId; open: boolean } | null>(null);
  if (!ph || !room) return null;

  const seat = turn?.seat ?? (hostPending ? hostSeat : null);
  if (seat != null && pending.includes(seat)) {
    if (!turn?.open)
      return <TurnHandoff seat={seat} onOpen={() => setTurn({ seat, open: true })} />;
    return (
      <RevealTurn
        view={viewFor(game, seat)}
        onLink={(lovers) => room.actFor(seat, { t: 'cupidLink', lovers })}
        onSeen={() => {
          room.actFor(seat, { t: 'seen' });
          setTurn(null);
        }}
      />
    );
  }
  return (
    <Waiting
      title={t('net.hostReveal')}
      done={t('net.ready', { done: ph.seen.length, total: game.players.length })}
      offline={offline}
      onPlayHere={(s) => setTurn({ seat: s, open: false })}
    />
  );
}

/** Everyone takes their night turn on their own phone at once; the host player does it here. */
export function HostActions({ game }: { game: GameState }) {
  const { t } = useWerewolfT();
  const ph = game.phase.t === 'actions' ? game.phase : null;
  const pending = ph ? game.players.map((p) => p.id).filter((id) => !ph.acted.includes(id)) : [];
  const { room, hostSeat, hostPending, offline } = useSeats(pending);
  const [turn, setTurn] = useState<{ seat: PlayerId; open: boolean } | null>(null);
  if (!ph || !room) return null;

  const seat = turn?.seat ?? (hostPending ? hostSeat : null);
  if (seat != null) {
    if (!turn?.open)
      return <TurnHandoff seat={seat} onOpen={() => setTurn({ seat, open: true })} />;
    return (
      <ActionTurn
        key={`${game.night}-${seat}`}
        view={viewFor(game, seat)}
        onConfirm={(action) => room.actFor(seat, { t: 'seatAction', action })}
        onDone={() => setTurn(null)}
      />
    );
  }
  return (
    <Waiting
      title={t('net.hostActions')}
      done={t('net.progress', { done: ph.acted.length, total: game.players.length })}
      offline={offline}
      onPlayHere={(s) => setTurn({ seat: s, open: false })}
    />
  );
}

/**
 * The Hunter's shot or the Mayor's choice: on that player's own phone, unless it's the host
 * player or their phone is offline (then on this phone, as in the one-phone game).
 */
export function HostOwnChoice({ game }: { game: GameState }) {
  const { t } = useWerewolfT();
  const nameOf = usePlayerName();
  const seat = actingSeat(game);
  const { hostSeat, offline } = useSeats(seat == null ? [] : [seat]);
  const [here, setHere] = useState(false);
  const ph = game.phase;
  let screen: ReactNode = null;
  if (ph.t === 'deathEffects' && ph.queue[0]) {
    screen = <DeathEffects key={JSON.stringify(ph.queue[0])} game={game} effect={ph.queue[0]} />;
  } else if (ph.t === 'mayorTieBreak') {
    screen = <MayorTieBreak game={game} tied={ph.tied} />;
  }
  if (seat == null || seat === hostSeat || here) return screen;
  return (
    <Screen center>
      <Text variant="heading" align="center" testID="wait-for">
        {t('net.waitFor', { name: nameOf(seat) })}
      </Text>
      {offline.includes(seat) ? (
        <>
          <Text variant="caption" align="center" tone="muted">
            {t('net.offlineSeat', { name: nameOf(seat) })}
          </Text>
          <Button
            testID={`play-here-${seat}`}
            variant="ghost"
            size="md"
            label={t('net.playHere', { name: nameOf(seat) })}
            onPress={() => setHere(true)}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xs, alignSelf: 'stretch' },
  text: { color: '#C9C2DA' },
  muted: { color: STEALTH.text },
});
