import { seededRng, shuffle } from '@/core/rng';
import { useSession } from '@/core/session';

import { spyRoomGame, spyViewFor } from './net';
import { useSpy, type ActiveRound } from './store';

const round = (patch: Partial<ActiveRound> = {}): ActiveRound => ({
  no: 3,
  players: 6,
  network: true,
  seen: [],
  revealed: false,
  packId: 'global-food',
  wordId: 'pizza',
  spies: [1, 4],
  firstAsker: 2,
  choice: 'random',
  verdicts: [
    { caught: null, guessed: null },
    { caught: null, guessed: null },
  ],
  gain: null,
  ...patch,
});

const opts = { spySeesCategory: true, totals: [] };

describe('Spy on everyone’s phone: what each phone sees', () => {
  it('gives players the word and spies never the word', () => {
    expect(spyViewFor(round(), 0, opts).card).toEqual({
      spy: false,
      packId: 'global-food',
      wordId: 'pizza',
    });
    expect(spyViewFor(round(), 1, opts).card).toEqual({ spy: true, packId: 'global-food' });
    // "Spy sees category" off: not even the category.
    expect(spyViewFor(round(), 4, { ...opts, spySeesCategory: false }).card).toEqual({
      spy: true,
      packId: null,
    });
    expect(JSON.stringify(spyViewFor(round(), 4, opts))).not.toContain('pizza');
  });

  it('a phone sees the same thing whoever the other spies are, until the reveal', () => {
    const rng = seededRng(3);
    for (const seat of [0, 1, 2, 3, 4, 5]) {
      const base = round();
      const mine = base.spies.includes(seat);
      for (let i = 0; i < 6; i++) {
        // Move the other spy (or both spies, for a player) to other seats.
        const others = shuffle(
          rng,
          [0, 1, 2, 3, 4, 5].filter((s) => s !== seat),
        );
        const spies = (mine ? [seat, others[0] as number] : others.slice(0, 2)).sort(
          (a, b) => a - b,
        );
        expect(spyViewFor({ ...base, spies }, seat, opts)).toEqual(spyViewFor(base, seat, opts));
      }
    }
  });

  it('shows the answer, the points and everyone’s totals once the host gets there', () => {
    expect(spyViewFor(round(), 0, opts).answer).toBeNull();
    const shown = spyViewFor(round({ revealed: true, seen: [0, 3] }), 0, {
      ...opts,
      totals: [2, 1],
    });
    expect(shown).toMatchObject({
      seen: true,
      seenCount: 2,
      answer: { packId: 'global-food', wordId: 'pizza', spies: [1, 4] },
      totals: [2, 1, 0, 0, 0, 0],
    });
    expect(spyViewFor(round({ gain: [0, 2, 0, 0, 0, 0] }), 3, opts).gain).toEqual([
      0, 2, 0, 0, 0, 0,
    ]);
  });
});

describe('Spy room game', () => {
  beforeEach(() => {
    useSpy.setState({ round: round(), spySeesCategory: true });
    useSession.setState({ scores: [1, 0, 2] });
  });

  it('lets a phone say it has seen its card, and nothing else', () => {
    const game = spyRoomGame(false);
    expect(game.players()).toBe(6);
    game.act(2, { t: 'seen' });
    game.act(2, { t: 'seen' });
    game.act(9, { t: 'seen' }); // no such seat
    game.act(3, { t: 'reveal' });
    expect(useSpy.getState().round?.seen).toEqual([2]);
    expect(useSpy.getState().round?.revealed).toBe(false);
    expect(game.viewFor(2)).toMatchObject({ seen: true, totals: [1, 0, 2, 0, 0, 0] });
  });

  it('has no game outside a network round', () => {
    useSpy.setState({ round: round({ network: false }) });
    const game = spyRoomGame(true);
    expect(game.players()).toBeNull();
    expect(game.viewFor(0)).toBeNull();
    game.act(0, { t: 'seen' });
    expect(useSpy.getState().round?.seen).toEqual([]);
    useSpy.getState().endRound();
    expect(useSpy.getState().round).toBeNull();
  });
});
