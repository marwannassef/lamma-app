/**
 * Purchases go through RevenueCat (monetization §2), with our server as the source of truth.
 * The RevenueCat SDK, API keys and store products aren't set up in this build yet, so these
 * return "unavailable" and the paywall explains that instead of failing silently.
 */
export type ProductId = 'partyPass' | 'annual' | 'lifetime';
export type PurchaseResult =
  { ok: true } | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

export async function purchase(_product: ProductId): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}

export async function restorePurchases(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}

/** Rewarded ads (AdMob, server-verified) aren't set up in this build yet. */
export async function watchRewardedAd(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
