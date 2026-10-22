import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { allPacks } from '@/core/content';
import { PlayerNamesContext, usePlayers } from '@/core/players';
import { useSession } from '@/core/session';
import { usePacks } from '@/core/settings/content';
import { ThemeProvider } from '@/core/theme';
import { useStayAwake } from '@/core/ui';

import { clampSpies } from '../logic';
import { useSpyRoom } from '../net';
import { useSpy } from '../store';
import Reveal from './Reveal';
import Round from './Round';

type Phase = { name: 'reveal'; player: number } | { name: 'round' };

/** Runs one round: each player flips their secret card → round screen. */
export default function Play() {
  useStayAwake();
  const round = useSpy((s) => s.round);
  const spySeesCategory = useSpy((s) => s.spySeesCategory);
  const startRound = useSpy((s) => s.start);
  const count = usePlayers((s) => s.count);
  const packs = usePacks('spy');
  const session = useSession();
  const { room, snapshot } = useSpyRoom();
  const network = !!round?.network;
  // On everyone's phone, this phone only shows its own player's card; the others use theirs.
  const hostSeat = network ? (room?.hostSeat ?? 0) : 0;
  const players = network ? (round?.players ?? count) : count;
  const [phase, setPhase] = useState<Phase>({ name: 'reveal', player: hostSeat });

  const pack = round && allPacks.find((p) => p.id === round.packId);
  const word = pack?.words.find((w) => w.id === round?.wordId);
  if (!round || !pack || !word) return <Redirect href="/games/spy" />;
  const names = network ? (snapshot?.members.map((m) => m.name) ?? null) : null;

  if (phase.name === 'round') {
    return (
      <PlayerNamesContext.Provider value={names}>
        <Round
          key={round.no}
          round={round}
          pack={pack}
          word={word}
          onNext={() => {
            startRound({
              players,
              spies: clampSpies(useSpy.getState().spies, players),
              packs,
              no: session.startRound(),
              network,
            });
            setPhase({ name: 'reveal', player: hostSeat });
          }}
          onSettings={() => {
            // The other phones go back to the room's lobby.
            if (network) useSpy.getState().endRound();
            if (router.canGoBack()) router.back();
            else router.replace('/games/spy');
          }}
        />
      </PlayerNamesContext.Provider>
    );
  }

  // The card reveal uses the dark "party night" theme so the card glows in a dim room.
  return (
    <PlayerNamesContext.Provider value={names}>
      <ThemeProvider scheme="dark">
        <StatusBar style="light" />
        <Reveal
          key={`reveal-${round.no}-${phase.player}`}
          player={phase.player}
          total={players}
          pack={pack}
          word={word}
          isSpy={round.spies.includes(phase.player)}
          spySeesCategory={spySeesCategory}
          onDone={() => {
            if (network) {
              useSpy.getState().markSeen(phase.player);
              return setPhase({ name: 'round' });
            }
            setPhase(
              phase.player + 1 < count
                ? { name: 'reveal', player: phase.player + 1 }
                : { name: 'round' },
            );
          }}
        />
      </ThemeProvider>
    </PlayerNamesContext.Provider>
  );
}
