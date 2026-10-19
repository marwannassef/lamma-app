import { allPacks, filterPacks } from '@/core/content';
import ar from '@/locales/ar/blendIn.json';
import en from '@/locales/en/blendIn.json';
import { seededRng } from '@/core/rng';

import { audioCue, audioKey } from './audio';
import { DEFAULT_SETTINGS, newGame, type BlendInState, type Phase } from './logic';

const packs = filterPacks(allPacks, { game: 'spy', regions: ['global'], level: 'kids' });
const base = newGame(
  4,
  DEFAULT_SETTINGS,
  packs,
  { usedByPack: {}, lastPackId: null, lastChameleon: null },
  seededRng(3),
);
const nameOf = (seat: number) => `P${seat}`;
const at = (phase: Phase): BlendInState => ({ ...base, phase });
const cue = (phase: Phase) => audioCue(at(phase), nameOf, 'Food');

describe('Blend In audio cues', () => {
  it('re-cues for every speaker in the circle', () => {
    const a = audioKey(at({ t: 'circle', clueRound: 1, turn: 0 }));
    expect(audioKey(at({ t: 'circle', clueRound: 1, turn: 1 }))).not.toBe(a);
    expect(audioKey(at({ t: 'vote', among: [1, 2] }))).not.toBe(
      audioKey(at({ t: 'vote', among: null })),
    );
    expect(audioKey(at({ t: 'peek', seat: 0 }))).toBe(audioKey(at({ t: 'peek', seat: 2 })));
  });

  it('opens the circle with the topic and the first speaker, then chimes each turn', () => {
    expect(cue({ t: 'peek', seat: 0 })).toEqual({ loops: { music: null } });
    expect(cue({ t: 'circle', clueRound: 1, turn: 0 })).toEqual({
      loops: { music: { id: 'lounge', volume: 0.5 } },
      line: { key: 'say.roundStart', params: { topic: 'Food', name: `P${base.round.order[0]}` } },
    });
    expect(cue({ t: 'circle', clueRound: 1, turn: 1 }).sfx).toBe('chime');
    expect(cue({ t: 'circle', clueRound: 2, turn: 0 }).line).toBeUndefined();
    expect(cue({ t: 'discuss' }).loops?.music).toEqual({ id: 'lounge', volume: 0.3 });
  });

  it('counts down the vote and builds suspense on the escape', () => {
    expect(cue({ t: 'vote', among: null })).toEqual({
      loops: { music: null },
      line: { key: 'say.countdown' },
    });
    expect(cue({ t: 'escape', choices: [] })).toEqual({ line: { key: 'say.caught' } });
  });

  it('reveals the Chameleon with a swoosh and the outcome line', () => {
    const result = (outcome: 'notCaught' | 'escaped' | 'caught' | 'ruleBroken') =>
      cue({ t: 'result', outcome, accused: null, guess: null, gain: [] });
    const name = `P${base.round.chameleon}`;
    expect(result('notCaught')).toMatchObject({
      sfx: 'swoosh',
      line: { key: 'say.wrongPerson', params: { name } },
    });
    expect(result('escaped').line).toEqual({ key: 'say.escaped', params: { name } });
    expect(result('caught').line).toEqual({ key: 'say.town' });
    expect(result('ruleBroken').line).toEqual({ key: 'say.ruleBroken' });
    expect(cue({ t: 'over', winners: [0] })).toMatchObject({
      sfx: 'fanfare',
      line: { key: 'say.over' },
    });
  });

  it('has every line in each language, with variants', () => {
    for (const key of Object.keys(en.say) as (keyof typeof en.say)[]) {
      expect(ar.say[key].length).toBeGreaterThan(0);
    }
    expect(en.say.roundStart).toHaveLength(3);
  });
});
