import { seededRng } from '@/core/rng';

import { resolveNight, wolfTargets } from '../night';
import { game } from '../testing';
import type { NightActions } from '../types';

const rng = () => seededRng(42);
const acts = (a: Partial<NightActions>): NightActions => ({
  wolfVotes: {},
  witchHeal: false,
  ...a,
});

// Seats used in most tests.
//   0 werewolf, 1 werewolf, 2 seer, 3 doctor, 4 witch, 5 villager, 6 villager
const SEATS = ['werewolf', 'werewolf', 'seer', 'doctor', 'witch', 'villager', 'villager'] as const;
const base = () => game([...SEATS]);

describe('wolf target selection (§7 step 1)', () => {
  it("uses the living Alpha's pick over the pack", () => {
    const s = game(['alpha', 'werewolf', 'werewolf', 'seer', 'villager', 'villager']);
    expect(wolfTargets(s, acts({ wolfVotes: { 0: [3], 1: [4], 2: [4] } }), rng())).toEqual([3]);
  });

  it('falls back to the pack when the Alpha is dead', () => {
    const s = game(['alpha', 'werewolf', 'werewolf', 'seer', 'villager', 'villager'], {
      dead: [0],
    });
    expect(wolfTargets(s, acts({ wolfVotes: { 0: [3], 1: [4], 2: [4] } }), rng())).toEqual([4]);
  });

  it('takes the plurality and breaks ties at random (seeded)', () => {
    const s = game([
      'werewolf',
      'werewolf',
      'werewolf',
      'seer',
      'villager',
      'villager',
      'villager',
    ]);
    expect(wolfTargets(s, acts({ wolfVotes: { 0: [4], 1: [4], 2: [5] } }), rng())).toEqual([4]);
    const tie = acts({ wolfVotes: { 0: [4], 1: [5] } });
    const picks = new Set(
      Array.from({ length: 20 }, (_, i) => wolfTargets(s, tie, seededRng(i))[0]),
    );
    expect([...picks].sort()).toEqual([4, 5]);
    expect(wolfTargets(s, tie, seededRng(5))).toEqual(wolfTargets(s, tie, seededRng(5)));
  });

  it('resolves two kills, the second excluding the first', () => {
    const s = { ...base(), wolfKills: 2 as const };
    expect(wolfTargets(s, acts({ wolfVotes: { 0: [5, 6], 1: [5, 2] } }), rng())).toEqual(
      expect.arrayContaining([5]),
    );
    const t = wolfTargets(s, acts({ wolfVotes: { 0: [5, 6], 1: [5, 6] } }), rng());
    expect(t).toEqual([5, 6]);
  });

  it('has no attack when no wolf voted, and ignores pack members and the dead', () => {
    expect(wolfTargets(base(), acts({}), rng())).toEqual([]);
    expect(wolfTargets(base(), acts({ wolfVotes: { 0: [1], 1: [1] } }), rng())).toEqual([]);
    const s = game([...SEATS], { dead: [5] });
    expect(wolfTargets(s, acts({ wolfVotes: { 0: [5], 1: [6] } }), rng())).toEqual([6]);
  });
});

describe('night resolution (§7)', () => {
  it('kills the wolf victim', () => {
    const { report, state } = resolveNight(base(), acts({ wolfVotes: { 0: [5], 1: [5] } }), rng());
    expect(report.deaths).toEqual([{ playerId: 5, cause: 'wolves' }]);
    expect(state.players[5]?.alive).toBe(false);
  });

  it('Doctor saves the victim', () => {
    const { report } = resolveNight(
      base(),
      acts({ wolfVotes: { 0: [5] }, doctorTarget: 5 }),
      rng(),
    );
    expect(report.deaths).toEqual([]);
    expect(report.saves).toEqual([{ playerId: 5, by: 'doctor' }]);
  });

  it('Doctor + heal on the same target: the heal is not consumed', () => {
    const { report, state } = resolveNight(
      base(),
      acts({ wolfVotes: { 0: [5] }, doctorTarget: 5, witchHeal: true }),
      rng(),
    );
    expect(report.saves).toEqual([{ playerId: 5, by: 'doctor' }]);
    expect(report.witchHealConsumed).toBe(false);
    expect(state.witch.healUsed).toBe(false);
  });

  it('heal when the Doctor protected someone else: the heal is consumed', () => {
    const { report, state } = resolveNight(
      base(),
      acts({ wolfVotes: { 0: [5] }, doctorTarget: 6, witchHeal: true }),
      rng(),
    );
    expect(report.saves).toEqual([{ playerId: 5, by: 'witch' }]);
    expect(report.witchHealConsumed).toBe(true);
    expect(state.witch.healUsed).toBe(true);
  });

  it('the heal only covers the primary victim, and only once per game', () => {
    const two = { ...base(), wolfKills: 2 as const };
    const r = resolveNight(
      two,
      acts({ wolfVotes: { 0: [5, 6], 1: [5, 6] }, witchHeal: true }),
      rng(),
    );
    expect(r.report.deaths).toEqual([{ playerId: 6, cause: 'wolves' }]);
    const used = { ...base(), witch: { healUsed: true, poisonUsed: false } };
    expect(
      resolveNight(used, acts({ wolfVotes: { 0: [5] }, witchHeal: true }), rng()).report.deaths,
    ).toEqual([{ playerId: 5, cause: 'wolves' }]);
  });

  it('a dead Doctor or Witch protects nobody', () => {
    const s = game([...SEATS], { dead: [3, 4] });
    const { report } = resolveNight(
      s,
      acts({ wolfVotes: { 0: [5] }, doctorTarget: 5, witchHeal: true, witchPoison: 6 }),
      rng(),
    );
    expect(report.deaths).toEqual([{ playerId: 5, cause: 'wolves' }]);
  });

  it('wolves attacking the Serial Killer: immune', () => {
    const s = game(['werewolf', 'serialKiller', 'seer', 'villager', 'villager']);
    const { report } = resolveNight(s, acts({ wolfVotes: { 0: [1] } }), rng());
    expect(report.deaths).toEqual([]);
    expect(report.saves).toEqual([{ playerId: 1, by: 'immune' }]);
  });

  it('Serial Killer kills, even a wolf; the Doctor blocks; the heal does not', () => {
    const s = game(['werewolf', 'serialKiller', 'doctor', 'witch', 'villager', 'villager']);
    expect(resolveNight(s, acts({ serialKillerTarget: 0 }), rng()).report.deaths).toEqual([
      { playerId: 0, cause: 'serialKiller' },
    ]);
    const blocked = resolveNight(s, acts({ serialKillerTarget: 4, doctorTarget: 4 }), rng());
    expect(blocked.report.deaths).toEqual([]);
    expect(blocked.report.saves).toEqual([{ playerId: 4, by: 'doctor' }]);
    const healed = resolveNight(s, acts({ serialKillerTarget: 4, witchHeal: true }), rng());
    expect(healed.report.deaths).toEqual([{ playerId: 4, cause: 'serialKiller' }]);
    expect(healed.report.witchHealConsumed).toBe(false);
  });

  it('poison kills through protection and is consumed', () => {
    const { report, state } = resolveNight(
      base(),
      acts({ witchPoison: 5, doctorTarget: 5 }),
      rng(),
    );
    expect(report.deaths).toEqual([{ playerId: 5, cause: 'poison' }]);
    expect(report.witchPoisonConsumed).toBe(true);
    expect(state.witch.poisonUsed).toBe(true);
    const used = { ...base(), witch: { healUsed: false, poisonUsed: true } };
    expect(resolveNight(used, acts({ witchPoison: 5 }), rng()).report.deaths).toEqual([]);
  });

  it('Cursed bitten: converts instead of dying and joins the pack next night', () => {
    const s = game(['werewolf', 'cursed', 'seer', 'villager', 'villager', 'villager']);
    const { report, state } = resolveNight(s, acts({ wolfVotes: { 0: [1] } }), rng());
    expect(report.deaths).toEqual([]);
    expect(report.conversions).toEqual([1]);
    expect(state.players[1]).toMatchObject({ role: 'werewolf', dealtRole: 'cursed', alive: true });
    // Next night the new wolf votes with the pack.
    expect(wolfTargets(state, acts({ wolfVotes: { 0: [3], 1: [3] } }), rng())).toEqual([3]);
  });

  it('a lover dies to poison: the partner dies of heartbreak', () => {
    const s = { ...base(), lovers: [5, 2] as [number, number] };
    const { report } = resolveNight(s, acts({ witchPoison: 5 }), rng());
    expect(report.deaths).toEqual([
      { playerId: 5, cause: 'poison' },
      { playerId: 2, cause: 'heartbreak' },
    ]);
  });

  it('Wolf Cub killed at night: two kills the next night, then back to one', () => {
    const s = game(['wolfCub', 'werewolf', 'seer', 'witch', 'villager', 'villager']);
    const first = resolveNight(s, acts({ witchPoison: 0 }), rng());
    expect(first.report.nextNight.wolfKills).toBe(2);
    expect(first.state.wolfKills).toBe(2);
    const second = resolveNight(first.state, acts({ wolfVotes: { 1: [4, 5] } }), rng());
    expect(second.report.deaths.map((d) => d.playerId).sort()).toEqual([4, 5]);
    expect(second.state.wolfKills).toBe(1);
  });

  it('Seer dies: the Apprentice is promoted', () => {
    const s = game(['werewolf', 'seer', 'apprenticeSeer', 'villager', 'villager']);
    const { report, state } = resolveNight(s, acts({ wolfVotes: { 0: [1] } }), rng());
    expect(report.nextNight.promotedApprentice).toBe(2);
    expect(state.players[2]).toMatchObject({ role: 'seer', dealtRole: 'apprenticeSeer' });
  });

  it('Hunter and Mayor deaths queue their effects', () => {
    const s = {
      ...game(['werewolf', 'hunter', 'mayor', 'witch', 'villager', 'villager']),
      mayor: 2,
    };
    const { report } = resolveNight(s, acts({ wolfVotes: { 0: [1] }, witchPoison: 2 }), rng());
    expect(report.pending).toEqual({ hunterShot: 1, mayorHandoff: 2 });
  });

  it('de-duplicates deaths, keeping the first cause', () => {
    const s = game(['werewolf', 'serialKiller', 'witch', 'villager', 'villager', 'villager']);
    const { report } = resolveNight(
      s,
      acts({ wolfVotes: { 0: [3] }, serialKillerTarget: 3, witchPoison: 3 }),
      rng(),
    );
    expect(report.deaths).toEqual([{ playerId: 3, cause: 'wolves' }]);
  });

  it("remembers the Doctor's last target", () => {
    expect(resolveNight(base(), acts({ doctorTarget: 6 }), rng()).state.doctorLastTarget).toBe(6);
    const deadDoc = game([...SEATS], { dead: [3], doctorLastTarget: 2 });
    expect(resolveNight(deadDoc, acts({}), rng()).state.doctorLastTarget).toBe(2);
  });
});
