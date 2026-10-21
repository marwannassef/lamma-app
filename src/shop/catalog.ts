import { allPacks, type Pack } from '@/core/content';
import { packIsFree, packProductId, roleProductId } from '@/core/entitlements';
import { DEFAULT_CONFIG, type RemoteConfig } from '@/core/remoteConfig';
import type { RoleId } from '@/games/werewolf/engine';
import { SHOP_ROLES } from '@/games/werewolf/shop';

/** One thing sold on its own in the Shop: a Premium word pack or a Werewolf role card. */
export type ShopItem =
  { id: string; kind: 'pack'; pack: Pack } | { id: string; kind: 'role'; role: RoleId };

/** Every Shop item: Premium-tier word packs (for Spy and Blend In) and the extra role cards. */
export function shopCatalog(config: RemoteConfig = DEFAULT_CONFIG): ShopItem[] {
  return [
    ...allPacks
      .filter((p) => !packIsFree(p, config))
      .map((pack): ShopItem => ({ id: packProductId(pack.id), kind: 'pack', pack })),
    ...SHOP_ROLES.map((role): ShopItem => ({ id: roleProductId(role), kind: 'role', role })),
  ];
}

export const findItem = (id: string, config?: RemoteConfig) =>
  shopCatalog(config).find((i) => i.id === id);
