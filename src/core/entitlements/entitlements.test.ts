import { allPacks } from '@/core/content';
import { DEFAULT_CONFIG } from '@/core/remoteConfig';

import { packIsFree, softPaywallDue, tierOf } from '.';

describe('entitlements', () => {
  it('is free unless a server pass says Premium (dev preview only in dev builds)', () => {
    expect(tierOf({ passTier: null, devPremium: false })).toBe('free');
    expect(tierOf({ passTier: 'premium', devPremium: false })).toBe('premium');
    expect(tierOf({ passTier: null, devPremium: true }, true)).toBe('premium');
    expect(tierOf({ passTier: null, devPremium: true }, false)).toBe('free');
  });

  it('frees 4 packs per region by default, and lets the server override the list', () => {
    const free = allPacks.filter((p) => packIsFree(p));
    expect(free.filter((p) => p.region === 'global')).toHaveLength(4);
    expect(free.filter((p) => p.region === 'eg')).toHaveLength(4);
    expect(free.every((p) => p.level === 'kids')).toBe(true);
    const custom = { ...DEFAULT_CONFIG, freePackIds: ['global-sports'] };
    expect(allPacks.filter((p) => packIsFree(p, custom)).map((p) => p.id)).toEqual([
      'global-sports',
    ]);
  });

  it('shows the soft paywall at most once a day', () => {
    const day = 24 * 3_600_000;
    expect(softPaywallDue(0, day, 24)).toBe(true);
    expect(softPaywallDue(day, day + day / 2, 24)).toBe(false);
    expect(softPaywallDue(day, 2 * day, 24)).toBe(true);
  });

  it('caps the free tier as the spec says', () => {
    expect(DEFAULT_CONFIG.caps.spy).toEqual({
      players: 6,
      spies: 1,
      punishmentLevels: ['off', 'light'],
    });
    expect(DEFAULT_CONFIG.caps.werewolf).toEqual({ players: 8, setupTiers: ['basic'] });
    expect(DEFAULT_CONFIG.caps.blendIn).toEqual({
      players: 6,
      modes: ['classic'],
      escape: ['normal'],
    });
  });
});
