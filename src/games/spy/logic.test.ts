import type { Pack } from '@/core/content';
import { seededRng } from '@/core/rng';

import {
  chooseCategory,
  chooseWord,
  clampSpies,
  emptyVerdict,
  maxSpies,
  RANDOM,
  roundResult,
  scoreRound,
  setupRound,
  spyWon,
  verdictsComplete,
  type Verdict,
} from './logic';

const makePack = (id: string, n = 3): Pack => ({
  id,
  region: 'global',
  game: 'spy',
  emoji: '🍕',
  name: { en: id },
  display: { primary: 'ui' },
  words: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, text: { en: `${id} ${i}` } })),
});
const packs = [makePack('a'), makePack('b'), makePack('c')];

const escaped: Verdict = { caught: false, guessed: null };
const caughtGuessed: Verdict = { caught: true, guessed: true };
const caughtWrong: Verdict = { caught: true, guessed: false };

describe('spies', () => {
  it('allows 2 spies from 7 players and clamps', () => {
    expect(maxSpies(6)).toBe(1);
    expect(maxSpies(7)).toBe(2);
    expect(clampSpies(2, 6)).toBe(1);
    expect(clampSpies(2, 7)).toBe(2);
    expect(clampSpies(0, 7)).toBe(1);
    expect(clampSpies(5, 12)).toBe(2);
  });
});

describe('chooseCategory', () => {
  it('returns the chosen pack when available', () => {
    expect(chooseCategory(packs, 'b', 'b', seededRng(1)).id).toBe('b');
  });

  it('never repeats the last pack in random mode', () => {
    const rng = seededRng(5);
    let last: string | null = null;
    for (let i = 0; i < 200; i++) {
      const p = chooseCategory(packs, RANDOM, last, rng);
      expect(p.id).not.toBe(last);
      last = p.id;
    }
  });

  it('falls back to random when the chosen pack is unavailable', () => {
    expect(['a', 'c']).toContain(chooseCategory(packs, 'gone', 'b', seededRng(2)).id);
  });

  it('repeats only when a single pack exists', () => {
    expect(chooseCategory([packs[0]!], RANDOM, 'a', seededRng(1)).id).toBe('a');
  });
});

describe('chooseWord', () => {
  it('does not repeat until the pack is exhausted, then starts over', () => {
    const rng = seededRng(11);
    const pack = makePack('w', 4);
    let used: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = chooseWord(pack, used, rng);
      expect(seen).not.toContain(r.word.id);
      seen.push(r.word.id);
      used = r.used;
    }
    expect(used).toHaveLength(4);
    const fresh = chooseWord(pack, used, rng);
    expect(fresh.used).toEqual([fresh.word.id]);
  });

  it('ignores used ids that are no longer in the pack', () => {
    const r = chooseWord(makePack('w', 2), ['old-id', 'w-0'], seededRng(1));
    expect(r.word.id).toBe('w-1');
    expect(r.used).toEqual(['w-0', 'w-1']);
  });
});

describe('setupRound', () => {
  it('picks spies, a word, the first asker and tracks used words', () => {
    const r = setupRound({
      players: 8,
      spies: 2,
      packs,
      choice: 'a',
      lastPackId: null,
      usedByPack: { a: ['a-0'] },
      rng: seededRng(4),
    });
    expect(r.packId).toBe('a');
    expect(r.wordId).not.toBe('a-0');
    expect(r.used).toEqual(['a-0', r.wordId]);
    expect(r.spies).toHaveLength(2);
    expect(r.spies[0]).toBeLessThan(r.spies[1]!);
    expect(r.firstAsker).toBeGreaterThanOrEqual(0);
    expect(r.firstAsker).toBeLessThan(8);
  });

  it('clamps spies to what the player count allows', () => {
    const r = setupRound({
      players: 5,
      spies: 2,
      packs,
      choice: RANDOM,
      lastPackId: 'a',
      usedByPack: {},
      rng: seededRng(9),
    });
    expect(r.spies).toHaveLength(1);
    expect(r.packId).not.toBe('a');
  });
});

describe('verdicts', () => {
  it('is complete only when every spy is answered', () => {
    expect(verdictsComplete([emptyVerdict()])).toBe(false);
    expect(verdictsComplete([{ caught: true, guessed: null }])).toBe(false);
    expect(verdictsComplete([escaped])).toBe(true);
    expect(verdictsComplete([caughtWrong, escaped])).toBe(true);
    expect(verdictsComplete([caughtGuessed, emptyVerdict()])).toBe(false);
  });

  it('a spy wins by escaping or guessing', () => {
    expect(spyWon(escaped)).toBe(true);
    expect(spyWon(caughtGuessed)).toBe(true);
    expect(spyWon(caughtWrong)).toBe(false);
  });
});

describe('scoreRound', () => {
  it('not caught: spy +2', () => {
    expect(scoreRound(4, [2], [escaped])).toEqual([0, 0, 2, 0]);
  });

  it('caught but guessed: spy +1', () => {
    expect(scoreRound(4, [0], [caughtGuessed])).toEqual([1, 0, 0, 0]);
  });

  it('caught and wrong: every non-spy +1', () => {
    expect(scoreRound(4, [1], [caughtWrong])).toEqual([1, 0, 1, 1]);
  });

  it('two spies are scored independently', () => {
    expect(scoreRound(7, [0, 3], [escaped, caughtWrong])).toEqual([2, 1, 1, 0, 1, 1, 1]);
    expect(scoreRound(7, [0, 3], [caughtWrong, caughtWrong])).toEqual([0, 2, 2, 0, 2, 2, 2]);
    expect(scoreRound(7, [0, 3], [caughtGuessed, escaped])).toEqual([1, 0, 0, 2, 0, 0, 0]);
  });

  it('treats a missing verdict as not caught', () => {
    expect(scoreRound(3, [0], [])).toEqual([2, 0, 0]);
  });
});

describe('roundResult', () => {
  it('names the winner', () => {
    expect(roundResult([caughtWrong])).toBe('players');
    expect(roundResult([caughtWrong, caughtWrong])).toBe('players');
    expect(roundResult([escaped])).toBe('spy');
    expect(roundResult([caughtGuessed])).toBe('spy');
    expect(roundResult([escaped, caughtGuessed])).toBe('spies');
    expect(roundResult([escaped, caughtWrong])).toBe('split');
  });
});
