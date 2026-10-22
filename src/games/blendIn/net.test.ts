import { allPacks, filterPacks } from '@/core/content';
import { seededRng } from '@/core/rng';

import { blendInReducer, DEFAULT_SETTINGS, newGame, type BlendInState } from './logic';
import { blendInRoomGame, blendInViewFor } from './net';
import { useBlendIn } from './store';

const packs = filterPacks(allPacks, { game: 'spy', regions: ['global', 'eg'], level: 'kids' });
const memory = { usedByPack: {}, lastPackId: null, lastChameleon: null };
const game = (patch: Partial<BlendInState['settings']> = {}) =>
  newGame(5, { ...DEFAULT_SETTINGS, ...patch }, packs, memory, seededRng(4), true);
const play = (s: BlendInState, ...events: Parameters<typeof blendInReducer>[1][]) =>
  events.reduce((st, e) => blendInReducer(st, e, seededRng(1)), s);

describe('Blend In on everyone’s phone: what each phone sees', () => {
  it('gives everyone the grid, and the secret to all but the Chameleon', () => {
    const g = game();
    const cham = g.round.chameleon;
    const other = (cham + 1) % 5;
    expect(blendInViewFor(g, other).card).toEqual({
      kind: 'grid',
      grid: g.round.grid,
      secret: g.round.secret,
    });
    expect(blendInViewFor(g, cham).card).toEqual({
      kind: 'grid',
      grid: g.round.grid,
      secret: null,
    });
  });

  it('in Undercover, everyone gets a word and the odd one out is not told', () => {
    const g = game({ mode: 'undercover' });
    const odd = g.round.chameleon;
    const other = (odd + 1) % 5;
    expect(blendInViewFor(g, other).card).toEqual({ kind: 'word', wordId: g.round.secret });
    expect(blendInViewFor(g, odd).card).toEqual({ kind: 'word', wordId: g.round.undercoverWord });
    // Same shape for both: nothing in the view says "you're the odd one".
    expect(Object.keys(blendInViewFor(g, odd))).toEqual(Object.keys(blendInViewFor(g, other)));
  });

  it('a phone sees the same thing whoever the Chameleon is, until the round is over', () => {
    const base = play(game(), { t: 'seen', seat: 0 });
    for (let seat = 0; seat < 5; seat++) {
      if (seat === base.round.chameleon) continue;
      for (let cham = 0; cham < 5; cham++) {
        if (cham === seat) continue;
        const moved = { ...base, round: { ...base.round, chameleon: cham } };
        expect(blendInViewFor(moved, seat)).toEqual(blendInViewFor(base, seat));
      }
    }
  });

  it('follows the round: who has looked, whose turn, and the answer at the end', () => {
    let g = game();
    expect(blendInViewFor(g, 0).phase).toEqual({ t: 'look', seen: 0, total: 5 });
    g = play(g, ...[0, 1, 2, 3, 4].map((seat) => ({ t: 'seen', seat }) as const));
    expect(blendInViewFor(g, 0)).toMatchObject({
      seen: true,
      phase: { t: 'circle', clueRound: 1, clueRounds: 1, speaker: g.round.order[0] },
    });
    g = play(g, { t: 'ruleBroken' });
    expect(blendInViewFor(g, 0).phase).toMatchObject({
      t: 'result',
      outcome: 'ruleBroken',
      chameleon: g.round.chameleon,
      secret: g.round.secret,
    });
    // One-phone peeks read as "looking" to anyone listening.
    const onePhone = newGame(5, DEFAULT_SETTINGS, packs, memory, seededRng(4));
    expect(blendInViewFor(onePhone, 0)).toMatchObject({
      seen: false,
      phase: { t: 'look', seen: 0, total: 5 },
    });
  });

  it('shows the escape choices on the caught Chameleon’s phone only', () => {
    let g = game();
    g = play(g, ...[0, 1, 2, 3, 4].map((seat) => ({ t: 'seen', seat }) as const));
    g = play(g, ...Array(5).fill({ t: 'nextClue' }), { t: 'startVote' });
    g = play(g, { t: 'accuse', id: g.round.chameleon });
    expect(g.phase.t).toBe('escape');
    const cham = g.round.chameleon;
    expect(blendInViewFor(g, cham).escapeChoices).toContain(g.round.secret);
    expect(blendInViewFor(g, (cham + 1) % 5).escapeChoices).toBeNull();
    expect(blendInViewFor(g, (cham + 1) % 5).phase).toEqual({ t: 'escape', chameleon: cham });
  });
});

describe('Blend In room game', () => {
  beforeEach(() => useBlendIn.setState({ game: game() }));

  it('lets a phone say it has looked, and only the Chameleon guess', () => {
    const room = blendInRoomGame(false);
    expect(room.players()).toBe(5);
    room.act(1, { t: 'seen' });
    room.act(1, 'nope' as never);
    expect(useBlendIn.getState().game?.phase).toEqual({ t: 'look', seen: [1] });

    let g = useBlendIn.getState().game as BlendInState;
    g = play(g, ...[0, 2, 3, 4].map((seat) => ({ t: 'seen', seat }) as const));
    g = play(g, ...Array(5).fill({ t: 'nextClue' }), { t: 'startVote' });
    g = play(g, { t: 'accuse', id: g.round.chameleon });
    useBlendIn.setState({ game: g });
    const cham = g.round.chameleon;
    room.act((cham + 1) % 5, { t: 'guess', wordId: g.round.secret }); // not theirs to send
    room.act(cham, { t: 'guess', wordId: 42 });
    expect(useBlendIn.getState().game?.phase.t).toBe('escape');
    room.act(cham, { t: 'guess', wordId: g.round.secret });
    expect(useBlendIn.getState().game?.phase).toMatchObject({ t: 'result', outcome: 'escaped' });
    expect(room.viewFor(cham)).toMatchObject({ phase: { t: 'result' } });
  });

  it('has no game outside a network game', () => {
    useBlendIn.setState({ game: newGame(5, DEFAULT_SETTINGS, packs, memory, seededRng(4)) });
    const room = blendInRoomGame(true);
    expect(room.players()).toBeNull();
    expect(room.viewFor(0)).toBeNull();
    room.act(0, { t: 'seen' });
    expect(useBlendIn.getState().game?.phase).toEqual({ t: 'peek', seat: 0 });
  });
});
