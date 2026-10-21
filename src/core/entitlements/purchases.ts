import { Platform } from 'react-native';
import type PurchasesSdk from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { useEntitlements } from './state';
import { ENTITLEMENT, partyPassUntil, productIdFor, type ProductId } from './store';

export { STORE_PRODUCTS, type ProductId } from './store';

/**
 * Purchases go through RevenueCat (monetization §2). The public SDK keys come from
 * EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY; until they're set (and on
 * web) every call returns "unavailable" and the paywall says so instead of failing silently.
 *
 * Until our backend exists (§9, P4), RevenueCat's receipt-checked customer info decides Premium;
 * the backend will take that over and sign it into the offline pass.
 */
export type PurchaseResult =
  { ok: true } | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

type Sdk = typeof PurchasesSdk;

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

let sdk: Sdk | null = null;

/** Loaded lazily, so builds without the native module (web, old dev clients) still run. */
function load(): Sdk | null {
  if (sdk) return sdk;
  if (!apiKey || Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = (require('react-native-purchases') as { default: Sdk }).default;
  } catch {
    sdk = null;
  }
  return sdk;
}

/** Copies what the store says the user owns into the entitlement store. */
export function applyCustomerInfo(
  info: Pick<CustomerInfo, 'entitlements' | 'nonSubscriptionTransactions'>,
) {
  useEntitlements.getState().setStore({
    storePremium: info.entitlements.active[ENTITLEMENT] != null,
    partyPassUntil: partyPassUntil(info.nonSubscriptionTransactions),
  });
}

let configured = false;

/** Call once at launch. Returns whether purchases are available in this build. */
export function configurePurchases(): boolean {
  const Purchases = load();
  if (!Purchases || !apiKey) return false;
  if (configured) return true;
  try {
    Purchases.configure({ apiKey });
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    void Purchases.getCustomerInfo().then(applyCustomerInfo, () => undefined);
    configured = true;
  } catch {
    return false;
  }
  return configured;
}

async function packages(): Promise<Partial<Record<ProductId, PurchasesPackage>>> {
  const Purchases = load();
  if (!Purchases || !configurePurchases()) return {};
  const offerings = await Purchases.getOfferings();
  const found: Partial<Record<ProductId, PurchasesPackage>> = {};
  for (const p of offerings.current?.availablePackages ?? []) {
    const id = productIdFor(p.product.identifier);
    if (id) found[id] = p;
  }
  return found;
}

/** The store's localized prices, for the paywall. Empty when the store isn't reachable. */
export async function storePrices(): Promise<Partial<Record<ProductId, string>>> {
  try {
    const found = await packages();
    return Object.fromEntries(
      Object.entries(found).map(([id, p]) => [id, p.product.priceString]),
    ) as Partial<Record<ProductId, string>>;
  } catch {
    return {};
  }
}

export async function purchase(product: ProductId): Promise<PurchaseResult> {
  const Purchases = load();
  if (!Purchases) return { ok: false, reason: 'unavailable' };
  try {
    const pkg = (await packages())[product];
    if (!pkg) return { ok: false, reason: 'unavailable' };
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      reason: (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'failed',
    };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const Purchases = load();
  if (!Purchases || !configurePurchases()) return { ok: false, reason: 'unavailable' };
  try {
    applyCustomerInfo(await Purchases.restorePurchases());
    return { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Rewarded ads (AdMob, server-verified) aren't set up in this build yet. */
export async function watchRewardedAd(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
