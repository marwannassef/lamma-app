// The host phone during a Blend In network game's private steps: its own player's card, a count
// of who has looked (never names), and the offline fallback; the Chameleon's guess waits for
// their own phone.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Pack } from '@/core/content';
import { usePlayerName } from '@/core/players';
import { space, STEALTH } from '@/core/theme';
import { Button, Screen, Text } from '@/core/ui';

import type { BlendInState } from '../logic';
import { useBlendInRoom } from '../net';
import { useBlendIn } from '../store';
import { Escape, Peek } from './Phases';

/** Who still has to act, the host player's seat, and which pending phones are offline. */
function useSeats(pending: readonly number[]) {
  const { room, snapshot } = useBlendInRoom();
  const hostSeat = room?.hostSeat ?? 0;
  const online = (seat: number) => snapshot?.members[seat]?.online ?? false;
  return {
    hostSeat,
    hostPending: pending.includes(hostSeat),
    offline: pending.filter((s) => s !== hostSeat && !online(s)),
  };
}

function PlayHere({ seats, onPick }: { seats: readonly number[]; onPick(seat: number): void }) {
  const { t } = useTranslation('blendIn');
  const nameOf = usePlayerName();
  return seats.map((seat) => (
    <View key={seat} style={styles.stack}>
      <Text variant="caption" align="center" style={styles.muted}>
        {t('net.offlineSeat', { name: nameOf(seat) })}
      </Text>
      <Button
        testID={`play-here-${seat}`}
        variant="ghost"
        size="md"
        label={t('net.playHere', { name: nameOf(seat) })}
        onPress={() => onPick(seat)}
      />
    </View>
  ));
}

/** Everyone looks at their own card; the host player's card is behind the usual hold. */
export function HostLook({ game, pack }: { game: BlendInState; pack: Pack }) {
  const { t } = useTranslation('blendIn');
  const dispatch = useBlendIn((s) => s.dispatch);
  const ph = game.phase.t === 'look' ? game.phase : null;
  const pending = ph
    ? Array.from({ length: game.players }, (_, i) => i).filter((i) => !ph.seen.includes(i))
    : [];
  const { hostSeat, hostPending, offline } = useSeats(pending);
  const [here, setHere] = useState<number | null>(null);
  if (!ph) return null;

  const seat = here ?? (hostPending ? hostSeat : null);
  if (seat != null && pending.includes(seat)) {
    return (
      <Peek
        key={`${game.round.no}-${seat}`}
        game={game}
        pack={pack}
        seat={seat}
        onDone={() => {
          dispatch({ t: 'seen', seat });
          setHere(null);
        }}
      />
    );
  }
  return (
    <Screen stealthColor={STEALTH.bg} center>
      <Text variant="heading" align="center" style={styles.text}>
        {t('net.lookTitle')}
      </Text>
      <Text variant="hero" align="center" style={styles.text} testID="net-progress">
        {t('net.looking', { n: ph.seen.length, total: game.players })}
      </Text>
      <PlayHere seats={offline} onPick={setHere} />
    </Screen>
  );
}

/** The caught Chameleon guesses on their own phone, unless it's this phone's player or offline. */
export function HostEscape({
  game,
  pack,
  choices,
}: {
  game: BlendInState;
  pack: Pack;
  choices: string[];
}) {
  const { t } = useTranslation('blendIn');
  const nameOf = usePlayerName();
  const cham = game.round.chameleon;
  const { hostSeat, offline } = useSeats([cham]);
  const [here, setHere] = useState(false);
  if (cham === hostSeat || here) return <Escape game={game} pack={pack} choices={choices} />;
  return (
    <Screen center>
      <Text variant="title" align="center">
        {`🚨 ${t('escape.caught')}`}
      </Text>
      <Text variant="heading" align="center" testID="guessing">
        {t('net.guessing', { name: nameOf(cham) })}
      </Text>
      <PlayHere seats={offline} onPick={() => setHere(true)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xs, alignSelf: 'stretch' },
  text: { color: '#C9C2DA' },
  muted: { color: STEALTH.text },
});
