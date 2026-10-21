/**
 * Pure helpers for store purchases (monetization §2), kept apart from the native SDK so they can be
 * tested on their own.
 */
export type ProductId = 'partyPass' | 'annual' | 'lifetime';

/** Store product IDs: create these in App Store Connect and Google Play (docs/store-setup.md). */
export const STORE_PRODUCTS: Record<ProductId, string> = {
  partyPass: 'lamma_party_pass_7d',
  annual: 'lamma_premium_annual',
  lifetime: 'lamma_premium_lifetime',
};

/**
 * RevenueCat entitlement unlocked by Annual and Lifetime (its identifier in the dashboard). The Party
 * Pass must not be attached to it: a consumable would unlock it forever.
 */
export const ENTITLEMENT = 'lamma_pro';

/**
 * Single items sold in the Shop, one store product each (non-consumable): a word pack or a
 * Werewolf role card. Premium includes all of them.
 */
export const ITEM_PREFIX = { pack: 'lamma_pack_', role: 'lamma_role_' } as const;
const snake = (id: string) => id.replace(/-/g, '_').replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
/** "egypt-food" → "lamma_pack_egypt_food" */
export const packProductId = (packId: string) => ITEM_PREFIX.pack + snake(packId);
/** "wolfCub" → "lamma_role_wolf_cub" */
export const roleProductId = (role: string) => ITEM_PREFIX.role + snake(role);
/** Shop items among the products a customer bought (store ids may carry a ":basePlan" suffix). */
export const ownedItems = (purchased: readonly string[]): string[] => [
  ...new Set(
    purchased
      .map(baseProductIdOf)
      .filter((id) => id.startsWith(ITEM_PREFIX.pack) || id.startsWith(ITEM_PREFIX.role)),
  ),
];
const baseProductIdOf = (storeId: string) => storeId.split(':')[0] ?? storeId;

export const PARTY_PASS_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

/** Google reports subscriptions as "product:basePlan"; compare on the product part. */
export const baseProductId = (storeId: string) => storeId.split(':')[0] ?? storeId;

export function productIdFor(storeId: string): ProductId | null {
  const base = baseProductId(storeId);
  const hit = (Object.keys(STORE_PRODUCTS) as ProductId[]).find((p) => STORE_PRODUCTS[p] === base);
  return hit ?? null;
}

/**
 * When the Party Pass runs out: each pass adds 7 days, starting from its purchase or from the end of
 * the pass before it if that one was still running (stacking, §2). Null if none was ever bought.
 */
export function partyPassUntil(
  transactions: readonly { productIdentifier: string; purchaseDate: string }[],
  days = PARTY_PASS_DAYS,
): number | null {
  const times = transactions
    .filter((t) => baseProductId(t.productIdentifier) === STORE_PRODUCTS.partyPass)
    .map((t) => Date.parse(t.purchaseDate))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  let until: number | null = null;
  for (const at of times) until = Math.max(until ?? 0, at) + days * DAY;
  return until;
}
