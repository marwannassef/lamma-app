import { allPacks, filterPacks, type Pack } from '@/core/content';
import { seededRng } from '@/core/rng';

import {
  blendInReducer,
  clueOrder,
  DEFAULT_SETTINGS,
  escapeChoices,
  GRID_SIZE,
  isOver,
  newGame,
  pickChameleon,
  pickGrid,
  pickPair,
  playable,
  resumeState,
  scoreRound,
  starterFor,
  winnersOf,
  type BlendInEvent,
  type BlendInState,
  type Settings,
} from './logic';

const packs = filterPacks(allPacks, { game: 'spy', regions: ['global', 'eg'], adult: false });
const pack = packs.find((p) => p.id === 'global-food') as Pack;
const memory = { usedByPack: {}, lastPackId: null, lastChameleon: null };

const play = (s: BlendInState, events: BlendInEvent[], seed = 1) =>
  events.reduce((st, e) => blendInReducer(st, e, seededRng(seed)), s);
const peekAll = (s: BlendInState) => play(s, Array(s.players).fill({ t: 'peeked' }));
const clueAll = (s: BlendInState) =>
  play(s, Array(s.players * s.settings.clueRounds).fill({ t: 'nextClue' }));

describe('grid and words (§5)', () => {
  it('has 16 different words including the secret', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 30; i++) {
      const g = pickGrid(pack, [], rng);
      expect(g.grid).toHaveLength(GRID_SIZE);
      expect(new Set(g.grid).size).toBe(GRID_SIZE);
      expect(g.grid).toContain(g.secret);
    }
  });

  it("doesn't repeat a secret word in a topic until all were used", () => {
    const rng = seededRng(5);
    let used: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < pack.words.length; i++) {
      const g = pickGrid(pack, used, rng);
      expect(seen.has(g.secret)).toBe(false);
      seen.add(g.secret);
      used = g.used;
    }
    expect(pickGrid(pack, used, rng).used).toHaveLength(1);
  });

  it('keeps only packs that can fill a grid (and have pairs for Undercover)', () => {
    const small = { ...pack, id: 'small', words: pack.words.slice(0, 10) };
    const noPairs = { ...pack, id: 'nopairs', pairs: undefined };
    expect(playable([pack, small, noPairs], 'classic').map((p) => p.id)).toEqual([
      'global-food',
      'nopairs',
    ]);
    expect(playable([pack, small, noPairs], 'undercover').map((p) => p.id)).toEqual([
      'global-food',
    ]);
  });

  it('picks Undercover pairs from the pack in either order', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const p = pickPair(pack, seededRng(i));
      expect(
        pack.pairs?.some(
          ([a, b]) =>
            (a === p.secret && b === p.undercover) || (b === p.secret && a === p.undercover),
        ),
      ).toBe(true);
      seen.add(`${p.secret}>${p.undercover}`);
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('who goes first (§4, §12)', () => {
  it('never makes the same player Chameleon twice in a row with 4+ players', () => {
    const rng = seededRng(9);
    let last: number | null = null;
    for (let i = 0; i < 100; i++) {
      const c = pickChameleon(5, last, rng);
      expect(c).not.toBe(last);
      last = c;
    }
    // With 3 players it may repeat.
    expect(pickChameleon(3, 0, seededRng(1))).toBeGreaterThanOrEqual(0);
  });

  it('rotates the starter and skips the Chameleon when "never first" is on', () => {
    expect([1, 2, 3, 4, 5, 6].map((r) => starterFor(r, 5, 9, true))).toEqual([0, 1, 2, 3, 4, 0]);
    expect(starterFor(3, 5, 2, true)).toBe(3);
    expect(starterFor(3, 5, 2, false)).toBe(2);
    expect(starterFor(5, 5, 4, true)).toBe(0);
    expect(clueOrder(3, 5)).toEqual([3, 4, 0, 1, 2]);
  });
});

describe('escape choices (§6)', () => {
  it('always include the secret, in random positions, at every difficulty', () => {
    const { grid, secret } = pickGrid(pack, [], seededRng(1));
    for (const [d, n] of [
      ['easy', 4],
      ['normal', 8],
      ['hard', 16],
    ] as const) {
      const positions = new Set<number>();
      for (let i = 0; i < 40; i++) {
        const c = escapeChoices(grid, secret, d, seededRng(i));
        expect(c).toHaveLength(n);
        expect(new Set(c).size).toBe(n);
        expect(c).toContain(secret);
        positions.add(c.indexOf(secret));
      }
      expect(positions.size).toBeGreaterThan(2);
    }
  });
});

describe('scoring (§7, §8)', () => {
  it('scores every outcome', () => {
    expect(scoreRound(4, 1, 'notCaught')).toEqual([0, 2, 0, 0]);
    expect(scoreRound(4, 1, 'escaped')).toEqual([0, 1, 0, 0]);
    expect(scoreRound(4, 1, 'caught')).toEqual([1, 0, 1, 1]);
    expect(scoreRound(4, 1, 'ruleBroken')).toEqual([0, 1, 0, 0]);
  });

  it('ends after N rounds or at 10 points, ties share the win', () => {
    expect(isOver([1, 2], 4, { t: 'rounds', n: 5 })).toBe(false);
    expect(isOver([1, 2], 5, { t: 'rounds', n: 5 })).toBe(true);
    expect(isOver([9, 2], 12, { t: 'target' })).toBe(false);
    expect(isOver([10, 2], 6, { t: 'target' })).toBe(true);
    expect(winnersOf([3, 5, 5, 1])).toEqual([1, 2]);
  });
});

describe('a 5-player Classic game of 5 rounds (§13)', () => {
  it('plays every outcome with correct points', () => {
    let s = newGame(5, DEFAULT_SETTINGS, packs, memory, seededRng(42));
    const totals = () => s.totals;
    const cham = () => s.round.chameleon;
    const innocent = () => (cham() + 1) % 5;

    // Round 1: wrong person accused → Chameleon +2.
    s = clueAll(peekAll(s));
    expect(s.phase).toEqual({ t: 'discuss' });
    s = play(s, [{ t: 'startVote' }, { t: 'accuse', id: innocent() }]);
    expect(s.phase).toMatchObject({ t: 'result', outcome: 'notCaught', accused: innocent() });
    const c1 = cham();
    expect(totals()[c1]).toBe(2);

    // Round 2: caught, escapes by tapping the secret → +1.
    s = play(s, [{ t: 'nextRound', packs }]);
    expect(cham()).not.toBe(c1);
    s = clueAll(peekAll(s));
    s = play(s, [{ t: 'startVote' }, { t: 'accuse', id: cham() }]);
    expect(s.phase.t).toBe('escape');
    s = play(s, [{ t: 'guess', wordId: s.round.secret }]);
    expect(s.phase).toMatchObject({ t: 'result', outcome: 'escaped' });

    // Round 3: caught and guesses wrong → everyone else +1.
    s = play(s, [{ t: 'nextRound', packs }]);
    s = clueAll(peekAll(s));
    s = play(s, [{ t: 'startVote' }, { t: 'accuse', id: cham() }]);
    const wrong = (s.phase as { choices: string[] }).choices.find(
      (w) => w !== s.round.secret,
    ) as string;
    const before = [...totals()];
    s = play(s, [{ t: 'guess', wordId: wrong }]);
    expect(s.phase).toMatchObject({ t: 'result', outcome: 'caught', guess: wrong });
    expect(totals().map((t, i) => t - (before[i] ?? 0))).toEqual(scoreRound(5, cham(), 'caught'));

    // Round 4: a rule is broken → Chameleon +1, round ends at once.
    s = play(s, [{ t: 'nextRound', packs }]);
    s = peekAll(s);
    s = play(s, [{ t: 'nextClue' }, { t: 'ruleBroken' }]);
    expect(s.phase).toMatchObject({ t: 'result', outcome: 'ruleBroken' });

    // Round 5: a tie, then another tie → the Chameleon escapes.
    s = play(s, [{ t: 'nextRound', packs }]);
    s = clueAll(peekAll(s));
    s = play(s, [{ t: 'startVote' }, { t: 'tie', tied: [0, 1] }]);
    expect(s.phase).toEqual({ t: 'vote', among: [0, 1] });
    s = play(s, [{ t: 'accuse', id: 3 }]); // not among the tied: ignored
    expect(s.phase).toEqual({ t: 'vote', among: [0, 1] });
    s = play(s, [{ t: 'tie', tied: [0, 1] }]);
    expect(s.phase).toMatchObject({ t: 'result', outcome: 'notCaught', accused: null });

    expect(s.roundsPlayed).toBe(5);
    s = play(s, [{ t: 'nextRound', packs }]);
    expect(s.phase).toEqual({ t: 'over', winners: winnersOf(s.totals) });
  });

  it('runs two clue rounds when set, and never shows the same topic twice in a row', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      clueRounds: 2,
      length: { t: 'rounds', n: 8 },
    };
    let s = peekAll(newGame(4, settings, packs, memory, seededRng(7)));
    s = play(s, Array(4).fill({ t: 'nextClue' }));
    expect(s.phase).toEqual({ t: 'circle', clueRound: 2, turn: 0 });
    s = play(s, Array(4).fill({ t: 'nextClue' }));
    expect(s.phase).toEqual({ t: 'discuss' });
    let last = s.round.packId;
    for (let i = 0; i < 6; i++) {
      s = play(peekAll(s), [{ t: 'ruleBroken' }, { t: 'nextRound', packs }], i);
      expect(s.round.packId).not.toBe(last);
      last = s.round.packId;
    }
  });
});

describe('Undercover mode (§8)', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, mode: 'undercover' };

  it('deals a close pair and no grid; caught → everyone else +1, no escape', () => {
    let s = newGame(5, settings, packs, memory, seededRng(4));
    expect(s.round.grid).toEqual([]);
    expect(s.round.undercoverWord).toBeDefined();
    expect(s.round.undercoverWord).not.toBe(s.round.secret);
    s = play(clueAll(peekAll(s)), [{ t: 'startVote' }, { t: 'accuse', id: s.round.chameleon }]);
    expect(s.phase).toMatchObject({ t: 'result', outcome: 'caught' });
  });

  it('not caught → Undercover +2', () => {
    let s = newGame(5, settings, packs, memory, seededRng(4));
    const other = (s.round.chameleon + 2) % 5;
    s = play(clueAll(peekAll(s)), [{ t: 'startVote' }, { t: 'accuse', id: other }]);
    expect(s.totals[s.round.chameleon]).toBe(2);
  });
});

describe('robustness', () => {
  it('ignores events outside their phase and bad input', () => {
    const s = newGame(4, DEFAULT_SETTINGS, packs, memory, seededRng(1));
    for (const e of [
      { t: 'nextClue' },
      { t: 'startVote' },
      { t: 'accuse', id: 1 },
      { t: 'guess', wordId: 'x' },
      { t: 'nextRound', packs },
      { t: 'ruleBroken' },
    ] as BlendInEvent[]) {
      expect(blendInReducer(s, e, seededRng(1))).toBe(s);
    }
    const vote = play(clueAll(peekAll(s)), [{ t: 'startVote' }]);
    expect(play(vote, [{ t: 'accuse', id: 9 }])).toBe(vote);
    expect(play(vote, [{ t: 'tie', tied: [1, 1] }])).toBe(vote);
    const escape = play(vote, [{ t: 'accuse', id: vote.round.chameleon }]);
    expect(play(escape, [{ t: 'guess', wordId: 'not-a-choice' }])).toBe(escape);
    expect(play(escape, [{ t: 'peeked' }])).toBe(escape);
  });

  it('never resumes on the secret escape screen', () => {
    const s = newGame(4, DEFAULT_SETTINGS, packs, memory, seededRng(1));
    const escape = play(clueAll(peekAll(s)), [
      { t: 'startVote' },
      { t: 'accuse', id: s.round.chameleon },
    ]);
    expect(resumeState(escape).phase).toEqual({ t: 'vote', among: null });
    expect(resumeState(s)).toBe(s);
  });

  it('first-to-10 games end once someone reaches 10', () => {
    let s = newGame(
      3,
      { ...DEFAULT_SETTINGS, length: { t: 'target' } },
      packs,
      memory,
      seededRng(2),
    );
    s = {
      ...s,
      totals: [10, 0, 0],
      roundsPlayed: 3,
      phase: { t: 'result', outcome: 'ruleBroken', accused: null, guess: null, gain: [0, 0, 0] },
    };
    expect(play(s, [{ t: 'nextRound', packs }]).phase).toEqual({ t: 'over', winners: [0] });
  });
});
