import { mayorTieBreak, resolveVote } from '../day';
import { applyDeaths, effectsFor, hunterShot, mayorHandoff } from '../deaths';
import { packOf, seerSees, sorcererSees } from '../roles';
import { game } from '../testing';
import { checkWin, scoreGame } from '../win';

describe('applyDeaths (day and night)', () => {
  it('Hunter lover chain: the shot kills a lover, whose partner dies too', () => {
    const s = {
      ...game(['werewolf', 'hunter', 'villager', 'villager', 'seer']),
      lovers: [2, 4] as [number, number],
    };
    const execution = applyDeaths(s, [{ playerId: 1, cause: 'execution' }]);
    expect(effectsFor(execution.pending)).toEqual([{ t: 'hunterShot', hunter: 1 }]);
    const shot = hunterShot(execution.state, 2);
    expect(shot.deaths).toEqual([
      { playerId: 2, cause: 'hunter' },
      { playerId: 4, cause: 'heartbreak' },
    ]);
    expect(() => hunterShot(shot.state, 2)).toThrow();
  });

  it('a Hunter killed by heartbreak still gets the shot', () => {
    const s = {
      ...game(['werewolf', 'hunter', 'villager', 'villager']),
      lovers: [1, 2] as [number, number],
    };
    expect(applyDeaths(s, [{ playerId: 2, cause: 'wolves' }]).pending).toEqual({ hunterShot: 1 });
  });

  it('Wolf Cub executed by day: two kills next night', () => {
    const s = game(['wolfCub', 'werewolf', 'seer', 'villager', 'villager', 'villager']);
    expect(applyDeaths(s, [{ playerId: 0, cause: 'execution' }]).state.wolfKills).toBe(2);
  });

  it('the Mayor passes the badge to a living player or nobody', () => {
    const s = { ...game(['werewolf', 'mayor', 'villager', 'villager']), mayor: 1 };
    const r = applyDeaths(s, [{ playerId: 1, cause: 'execution' }]);
    expect(effectsFor(r.pending)).toEqual([{ t: 'mayorHandoff', mayor: 1 }]);
    expect(mayorHandoff(r.state, 2).mayor).toBe(2);
    expect(mayorHandoff(r.state, null).mayor).toBeNull();
    expect(() => mayorHandoff(r.state, 1)).toThrow();
  });

  it('rejects unknown seats', () => {
    expect(() => hunterShot(game(['werewolf', 'hunter', 'villager', 'villager']), 9)).toThrow();
  });

  it('ignores players who are already dead', () => {
    const s = game(['werewolf', 'villager', 'villager', 'villager'], { dead: [1] });
    expect(applyDeaths(s, [{ playerId: 1, cause: 'execution' }]).deaths).toEqual([]);
  });
});

describe('what information roles see', () => {
  it('Seer sees wolves and the Lycan as werewolves; the Sorcerer as innocent', () => {
    const s = game(['werewolf', 'lycan', 'sorcerer', 'seer', 'villager']);
    expect([0, 1, 2, 4].map((id) => seerSees(s, id))).toEqual([
      'werewolf',
      'werewolf',
      'innocent',
      'innocent',
    ]);
    expect(sorcererSees(s, 3)).toBe(true);
    expect(sorcererSees(s, 0)).toBe(false);
    expect(packOf(s).map((p) => p.id)).toEqual([0]); // the pack doesn't include the Sorcerer
  });
});

describe('win check (§8)', () => {
  it('Tanner executed wins alone, even if the wolves reach parity in the same event', () => {
    const s = game(['werewolf', 'tanner', 'villager'], { dead: [1] });
    expect(checkWin(s, 1)).toEqual({ outcome: 'tanner', winners: [1], soloWinners: [1] });
    // A Tanner dying at night doesn't count.
    expect(checkWin(s)?.outcome).toBe('wolves');
  });

  it('everyone dead is a draw', () => {
    const s = game(['werewolf', 'villager'], { dead: [0, 1] });
    expect(checkWin(s)).toEqual({ outcome: 'draw', winners: [], soloWinners: [] });
  });

  it('cross-team lovers as the last two win; same-team lovers do not', () => {
    const s = {
      ...game(['werewolf', 'villager', 'seer', 'villager'], { dead: [2, 3] }),
      lovers: [0, 1] as [number, number],
    };
    expect(checkWin(s)).toEqual({ outcome: 'lovers', winners: [0, 1], soloWinners: [0, 1] });
    const same = {
      ...game(['werewolf', 'villager', 'villager'], { dead: [0] }),
      lovers: [1, 2] as [number, number],
    };
    expect(checkWin(same)?.outcome).toBe('village');
  });

  it('Serial Killer wins with at most one other alive', () => {
    const s = game(['werewolf', 'serialKiller', 'villager'], { dead: [2] });
    expect(checkWin(s)).toEqual({ outcome: 'serialKiller', winners: [1], soloWinners: [1] });
  });

  it('a living Serial Killer blocks the wolf parity win', () => {
    const s = game(['werewolf', 'werewolf', 'serialKiller', 'villager', 'villager'], { dead: [4] });
    expect(checkWin(s)).toBeNull();
  });

  it('wolves win at parity, with the Sorcerer; dead wolves win too', () => {
    const s = game(['werewolf', 'werewolf', 'sorcerer', 'seer', 'villager'], { dead: [1, 3, 4] });
    expect(checkWin(s)).toEqual({ outcome: 'wolves', winners: [0, 1, 2], soloWinners: [] });
  });

  it('Lone Wolf wins only as the sole living pack wolf', () => {
    const alone = game(['loneWolf', 'werewolf', 'werewolf', 'villager', 'seer'], {
      dead: [1, 2, 4],
    });
    expect(checkWin(alone)).toEqual({ outcome: 'wolves', winners: [0, 1, 2], soloWinners: [0] });
    const withPack = game(['loneWolf', 'werewolf', 'werewolf', 'villager', 'seer'], {
      dead: [2, 4],
    });
    expect(checkWin(withPack)).toEqual({ outcome: 'wolves', winners: [1, 2], soloWinners: [] });
  });

  it('village wins when no wolves and no Serial Killer remain; cross-team lovers lose', () => {
    const s = {
      ...game(['werewolf', 'werewolf', 'seer', 'villager', 'villager', 'tanner'], { dead: [0] }),
      lovers: [1, 3] as [number, number],
    };
    // Wolf 1 is a cross-team lover, so it doesn't count as a pack wolf for the village win.
    expect(checkWin(s)).toEqual({ outcome: 'village', winners: [2, 4], soloWinners: [] });
  });

  it('the game goes on otherwise', () => {
    expect(checkWin(game(['werewolf', 'seer', 'villager', 'villager']))).toBeNull();
  });

  it('scores +1 for winners and +2 for solo winners', () => {
    expect(scoreGame({ outcome: 'wolves', winners: [0, 1, 2], soloWinners: [0] }, 4)).toEqual([
      2, 1, 1, 0,
    ]);
  });
});

describe('day vote', () => {
  const s = { ...game(['werewolf', 'mayor', 'villager', 'villager', 'seer']), mayor: 1 };

  it('executes the most-pointed player', () => {
    expect(resolveVote(s, { t: 'player', id: 2 })).toEqual({ t: 'execute', playerId: 2 });
    expect(() =>
      resolveVote(game(['werewolf', 'villager', 'villager'], { dead: [2] }), {
        t: 'player',
        id: 2,
      }),
    ).toThrow();
  });

  it('"No execution" executes nobody', () => {
    expect(resolveVote(s, { t: 'none' })).toEqual({ t: 'none' });
  });

  it('a tie goes to a living Mayor, who can pick or spare everyone', () => {
    expect(resolveVote(s, { t: 'tie', tied: [0, 2] })).toEqual({
      t: 'mayorTieBreak',
      tied: [0, 2],
    });
    expect(mayorTieBreak([0, 2], 0)).toEqual({ t: 'execute', playerId: 0 });
    expect(mayorTieBreak([0, 2], null)).toEqual({ t: 'none' });
    expect(() => mayorTieBreak([0, 2], 3)).toThrow();
  });

  it('a tie without a living Mayor executes nobody', () => {
    expect(resolveVote({ ...s, mayor: null }, { t: 'tie', tied: [0, 2] })).toEqual({ t: 'none' });
    const deadMayor = {
      ...game(['werewolf', 'mayor', 'villager', 'villager'], { dead: [1] }),
      mayor: 1,
    };
    expect(resolveVote(deadMayor, { t: 'tie', tied: [0, 2] })).toEqual({ t: 'none' });
  });
});
