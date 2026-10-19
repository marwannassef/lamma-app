import type { Cue } from '@/core/audio';

import type { BlendInState } from './logic';

/** A new cue for each phase, and for each speaker in the clue circle. */
export const audioKey = (g: BlendInState) => {
  const ph = g.phase;
  return ph.t === 'circle'
    ? `${g.round.no}-circle-${ph.clueRound}-${ph.turn}`
    : `${g.round.no}-${ph.t}-${ph.t === 'vote' ? (ph.among?.join(',') ?? 'all') : ''}`;
};

const lounge = (volume: number) => ({ id: 'lounge' as const, volume });

/** What each Blend In phase sounds like (§10): a lighter take on the Werewolf narrator. */
export function audioCue(g: BlendInState, nameOf: (seat: number) => string, topic: string): Cue {
  const ph = g.phase;
  switch (ph.t) {
    case 'peek':
      return { loops: { music: null } };
    case 'circle': {
      if (ph.clueRound === 1 && ph.turn === 0) {
        const name = nameOf(g.round.order[0] ?? 0);
        return {
          loops: { music: lounge(0.5) },
          line: { key: 'say.roundStart', params: { topic, name } },
        };
      }
      return { loops: { music: lounge(0.5) }, sfx: 'chime' };
    }
    case 'discuss':
      return { loops: { music: lounge(0.3) } };
    case 'vote':
      return { loops: { music: null }, line: { key: 'say.countdown' } };
    case 'escape':
      return { line: { key: 'say.caught' } };
    case 'result': {
      const name = nameOf(g.round.chameleon);
      const line =
        ph.outcome === 'notCaught'
          ? { key: 'say.wrongPerson', params: { name } }
          : ph.outcome === 'escaped'
            ? { key: 'say.escaped', params: { name } }
            : ph.outcome === 'caught'
              ? { key: 'say.town' }
              : { key: 'say.ruleBroken' };
      return { loops: { music: null }, sfx: 'swoosh', line };
    }
    case 'over':
      return { loops: { music: null }, sfx: 'fanfare', line: { key: 'say.over' } };
  }
}
