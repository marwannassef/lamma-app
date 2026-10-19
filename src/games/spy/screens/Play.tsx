import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import { allPacks } from '@/core/content';
import { usePlayers } from '@/core/players';
import { useSession } from '@/core/session';
import { usePacks } from '@/core/settings/content';
import { ThemeProvider } from '@/core/theme';
import { useStayAwake } from '@/core/ui';

import { clampSpies } from '../logic';
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
  const [phase, setPhase] = useState<Phase>({ name: 'reveal', player: 0 });

  const pack = round && allPacks.find((p) => p.id === round.packId);
  const word = pack?.words.find((w) => w.id === round?.wordId);
  if (!round || !pack || !word) return <Redirect href="/games/spy" />;

  if (phase.name === 'round') {
    return (
      <Round
        key={round.no}
        round={round}
        pack={pack}
        word={word}
        onNext={() => {
          startRound({
            players: count,
            spies: clampSpies(useSpy.getState().spies, count),
            packs,
            no: session.startRound(),
          });
          setPhase({ name: 'reveal', player: 0 });
        }}
        onSettings={() => (router.canGoBack() ? router.back() : router.replace('/games/spy'))}
      />
    );
  }

  // The card reveal uses the dark "party night" theme so the card glows in a dim room.
  return (
    <ThemeProvider scheme="dark">
      <StatusBar style="light" />
      <Reveal
        key={`reveal-${round.no}-${phase.player}`}
        player={phase.player}
        pack={pack}
        word={word}
        isSpy={round.spies.includes(phase.player)}
        spySeesCategory={spySeesCategory}
        onDone={() =>
          setPhase(
            phase.player + 1 < count
              ? { name: 'reveal', player: phase.player + 1 }
              : { name: 'round' },
          )
        }
      />
    </ThemeProvider>
  );
}
