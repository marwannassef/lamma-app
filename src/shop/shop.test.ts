import { ownedItems, packProductId, roleProductId } from '@/core/entitlements/store';
import {
  firstLockedRole,
  FREE_ROLES,
  roleUnlocked,
  setupUnlocked,
  SHOP_ROLES,
} from '@/games/werewolf/shop';

import { shopCatalog } from './catalog';

describe('Shop items', () => {
  it('names store products after packs and roles', () => {
    expect(packProductId('egypt-food')).toBe('lamma_pack_egypt_food');
    expect(roleProductId('wolfCub')).toBe('lamma_role_wolf_cub');
    expect(roleProductId('serialKiller')).toBe('lamma_role_serial_killer');
  });

  it('sells only Premium packs and the roles outside Basic', () => {
    const items = shopCatalog();
    expect(items.every((i) => i.kind === 'role' || i.pack.tier === 'premium')).toBe(true);
    expect(items.filter((i) => i.kind === 'role')).toHaveLength(SHOP_ROLES.length);
    expect(SHOP_ROLES.some((r) => FREE_ROLES.includes(r))).toBe(false);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    // Store product ids: lowercase letters, digits and underscores only.
    for (const i of items) expect(i.id).toMatch(/^[a-z0-9_]+$/);
  });

  it('reads owned items from what the store says was bought', () => {
    expect(
      ownedItems([
        'lamma_pack_egypt_beach',
        'lamma_premium_annual:annual',
        'lamma_role_cupid',
        'lamma_role_cupid',
      ]),
    ).toEqual(['lamma_pack_egypt_beach', 'lamma_role_cupid']);
  });

  it('unlocks a Werewolf setup once every role in it is free or bought', () => {
    const owned = [roleProductId('hunter')];
    expect(roleUnlocked('seer', [])).toBe(true);
    expect(roleUnlocked('hunter', [])).toBe(false);
    expect(roleUnlocked('hunter', owned)).toBe(true);
    const classic = { werewolf: 2, seer: 1, hunter: 1, villager: 3 };
    expect(setupUnlocked(classic, [])).toBe(false);
    expect(setupUnlocked(classic, owned)).toBe(true);
    expect(setupUnlocked({ ...classic, witch: 0 }, owned)).toBe(true);
    expect(firstLockedRole({ ...classic, witch: 1 }, owned)).toBe('witch');
  });
});
