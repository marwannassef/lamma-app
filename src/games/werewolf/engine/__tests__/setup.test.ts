import { seededRng } from '@/core/rng';

import { CURATED } from '../../content/presets';
import { balanceLabel } from '../balance';
import { ALL_ROLES, CORE_ROLES } from '../roles';
import {
  balance,
  balanceScore,
  dealRoles,
  estimatedMinutes,
  fillVillagers,
  maxRounds,
  packSizeFor,
  packWolves,
  preselect,
  recommendedSetups,
  surpriseMe,
  total,
  tryNextTier,
  validateSetup,
} from '../setup';

describe('curated setups (§5.2)', () => {
  it.each(CURATED.map((s) => [`${s.players} ${s.tier}`, s] as const))('%s is valid', (_n, s) => {
    expect(total(s.roles)).toBe(s.players);
    expect(balanceScore(s.roles)).toBe(s.score);
    expect(validateSetup(s.roles, s.players).errors).toEqual([]);
  });

  it('offers Basic for every count from 4 to 16', () => {
    for (let n = 4; n <= 16; n++) {
      expect(recommendedSetups(n, ALL_ROLES).some((s) => s.tier === 'basic')).toBe(true);
      expect(recommendedSetups(n).some((s) => s.tier === 'basic')).toBe(true);
    }
  });

  it('hides setups with roles that are not shipped yet and orders by tier', () => {
    const core = recommendedSetups(7, CORE_ROLES).map((s) => s.tier);
    expect(core).toEqual(['basic', 'classic']); // Party uses the Wolf Cub (expansion)
    expect(recommendedSetups(7, ALL_ROLES).map((s) => s.tier)).toEqual([
      'basic',
      'classic',
      'party',
    ]);
  });
});

describe('balance and length', () => {
  it('labels scores', () => {
    expect([6, 3, 2, -2, -3, -6].map(balanceLabel)).toEqual([
      'villageFriendly',
      'leansVillage',
      'balanced',
      'balanced',
      'leansWolves',
      'wolfFriendly',
    ]);
    expect(balance({ werewolf: 1, seer: 1, villager: 2 })).toEqual({
      score: 3,
      label: 'leansVillage',
    });
  });

  it('fills villagers and sizes the pack', () => {
    expect(fillVillagers({ werewolf: 2, seer: 1 }, 8)).toEqual({
      werewolf: 2,
      seer: 1,
      villager: 5,
    });
    expect([4, 6, 7, 9, 10, 15, 16].map(packSizeFor)).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });

  it('estimates the game length', () => {
    const roles = { werewolf: 2, seer: 1, doctor: 1, villager: 4 }; // 6 non-wolves vs 2
    expect(maxRounds(roles)).toBe(2);
    expect(estimatedMinutes(roles, 120)).toBe(8);
    expect(estimatedMinutes(roles, null)).toBe(10);
  });
});

describe('custom setup rules (§5.6)', () => {
  const errors = (roles: object, n: number) => validateSetup(roles, n).errors;
  const warnings = (roles: object, n: number) => validateSetup(roles, n).warnings;

  it('enforces every hard rule', () => {
    expect(errors({ seer: 1, villager: 3 }, 5)).toEqual(
      expect.arrayContaining(['wrongTotal', 'noKiller']),
    );
    expect(errors({ werewolf: 3, villager: 3 }, 6)).toContain('tooManyKillers');
    expect(errors({ werewolf: 1, lycan: 1, villager: 3 }, 5)).toContain('needsSeer');
    expect(errors({ alpha: 1, seer: 1, villager: 5 }, 7)).toContain('alphaNeedsPack');
    expect(errors({ wolfCub: 1, seer: 1, villager: 5 }, 7)).toContain('cubNeedsPack');
    expect(errors({ loneWolf: 1, werewolf: 1, seer: 1, villager: 5 }, 8)).toContain(
      'loneWolfNeedsPack',
    );
    expect(errors({ werewolf: 1, seer: 2, villager: 4 }, 7)).toContain('tooManyOfRole');
    expect(errors({ werewolf: 1, seer: 1, villager: -1, doctor: 6 }, 7)).toContain(
      'tooManySpecials',
    );
    expect(errors({ serialKiller: 1, seer: 1, villager: 7 }, 9)).toEqual([]);
  });

  it('raises every soft warning', () => {
    expect(warnings({ werewolf: 1, seer: 1, doctor: 1, villager: 3 }, 6)).toContain(
      'favorsVillage',
    );
    expect(warnings({ werewolf: 2, alpha: 1, villager: 4 }, 7)).toContain('favorsWolves');
    expect(warnings({ werewolf: 3, seer: 1, villager: 5 }, 9)).toContain('bigPack');
    expect(warnings({ werewolf: 1, cupid: 1, villager: 3 }, 5)).toContain('smallTableTwist');
    expect(warnings({ werewolf: 1, serialKiller: 1, seer: 1, villager: 5 }, 8)).toContain(
      'earlySerialKiller',
    );
    expect(
      warnings({ werewolf: 2, seer: 1, doctor: 1, witch: 1, hunter: 1, cupid: 1 }, 7),
    ).toContain('noVillagers');
    expect(
      warnings({ werewolf: 2, seer: 1, apprenticeSeer: 1, sorcerer: 1, villager: 5 }, 10),
    ).not.toContain('manyInfoRoles'); // exactly three is fine
  });

  it('warns about more than three information roles', () => {
    // Only one Seer and one Apprentice allowed, so this needs two Sorcerers (also an error).
    const r = validateSetup(
      { werewolf: 3, seer: 1, apprenticeSeer: 1, sorcerer: 2, villager: 5 },
      12,
    );
    expect(r.warnings).toContain('manyInfoRoles');
    expect(r.errors).toContain('tooManyOfRole');
  });
});

describe('preselection (§5.4)', () => {
  const cards = recommendedSetups(10, ALL_ROLES);

  it('prefers the last tier, then experience, then Basic; never Chaos by default', () => {
    expect(preselect(cards, { lastTier: 'party', experience: 'first' })?.tier).toBe('party');
    expect(preselect(cards, { lastTier: null, experience: 'played' })?.tier).toBe('classic');
    expect(preselect(cards, { experience: 'experts' })?.tier).toBe('party');
    expect(preselect(cards, {})?.tier).toBe('basic');
    expect(preselect(recommendedSetups(4, ALL_ROLES), { lastTier: 'classic' })?.tier).toBe('basic');
  });

  it('nudges to the next tier after three of the same', () => {
    expect(tryNextTier(['basic', 'basic', 'basic'], cards)).toBe('classic');
    expect(tryNextTier(['basic', 'classic', 'basic'], cards)).toBeNull();
    expect(tryNextTier(['basic', 'basic'], cards)).toBeNull();
    expect(tryNextTier(['party', 'party', 'party'], cards)).toBeNull(); // never nudges into Chaos
  });
});

describe('Surprise me', () => {
  it('always returns a valid, balanced setup from 7 players (seeded)', () => {
    for (let n = 7; n <= 16; n++) {
      for (const tier of ['classic', 'party', 'chaos'] as const) {
        for (let seed = 1; seed <= 5; seed++) {
          const roles = surpriseMe(n, tier, seededRng(seed * 100 + n));
          if (!roles) continue;
          expect(total(roles)).toBe(n);
          expect(validateSetup(roles, n).errors).toEqual([]);
          expect(Math.abs(balanceScore(roles))).toBeLessThanOrEqual(2);
          expect(packWolves(roles)).toBe(packSizeFor(n));
        }
      }
    }
  });

  it('finds setups for typical tables and is repeatable', () => {
    expect(surpriseMe(10, 'party', seededRng(1))).not.toBeNull();
    expect(surpriseMe(10, 'party', seededRng(7))).toEqual(surpriseMe(10, 'party', seededRng(7)));
    expect(surpriseMe(6, 'party', seededRng(1))).toBeNull();
    // Nothing balanced can be built from wolves and villagers alone.
    expect(surpriseMe(16, 'chaos', seededRng(1), ['werewolf', 'villager'])).toBeNull();
  });
});

describe('dealing', () => {
  it('deals every role once per count, deterministically with a seed', () => {
    const roles = { werewolf: 2, seer: 1, doctor: 1, villager: 3 };
    const a = dealRoles(roles, 7, seededRng(3));
    expect(a).toEqual(dealRoles(roles, 7, seededRng(3)));
    expect([...a].sort()).toEqual(
      ['doctor', 'seer', 'villager', 'villager', 'villager', 'werewolf', 'werewolf'].sort(),
    );
    expect(() => dealRoles(roles, 8, seededRng(3))).toThrow();
  });
});
