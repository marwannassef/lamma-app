import { Platform } from 'react-native';
import type PurchasesSdk from 'react-native-purchases';
import type { CustomerInfo, PurchasesPackage, PurchasesStoreProduct } from 'react-native-purchases';

import { useEntitlements } from './state';
import {
  ENTITLEMENT,
  ownedItems,
  partyPassUntil,
  productIdFor,
  STORE_PRODUCTS,
  type ProductId,
} from './store';

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
  | { ok: true }
  | {
      ok: false;
      reason: 'unavailable' | 'cancelled' | 'failed';
      /** A short technical reason, shown small on the paywall so a failed test can be diagnosed. */
      detail?: string;
    };

const NO_KEY: PurchaseResult = {
  ok: false,
  reason: 'unavailable',
  detail: 'no RevenueCat key in this build',
};

/** RevenueCat's readable error code and message, e.g. "CONFIGURATION_ERROR: …". */
export function errorDetail(e: unknown): string {
  const err = e as { readableErrorCode?: string; code?: string; message?: string } | null;
  const code = err?.readableErrorCode ?? err?.code;
  const message = err?.message ?? String(e);
  return code ? `${code}: ${message}` : message;
}

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
  info: Pick<CustomerInfo, 'entitlements' | 'nonSubscriptionTransactions'> &
    Partial<Pick<CustomerInfo, 'allPurchasedProductIdentifiers'>>,
) {
  useEntitlements.getState().setStore({
    storePremium: info.entitlements.active[ENTITLEMENT] != null,
    partyPassUntil: partyPassUntil(info.nonSubscriptionTransactions),
    owned: ownedItems([
      ...(info.allPurchasedProductIdentifiers ?? []),
      ...info.nonSubscriptionTransactions.map((t) => t.productIdentifier),
    ]),
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
  if (!Purchases) return NO_KEY;
  let found: Partial<Record<ProductId, PurchasesPackage>>;
  try {
    found = await packages();
  } catch (e) {
    return { ok: false, reason: 'failed', detail: errorDetail(e) };
  }
  const pkg = found[product];
  if (!pkg) {
    const detail = Object.keys(found).length
      ? `${STORE_PRODUCTS[product]} is not in the current offering`
      : 'the current offering has no Lamma products';
    return { ok: false, reason: 'unavailable', detail };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyCustomerInfo(customerInfo);
    return { ok: true };
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'failed', detail: errorDetail(e) };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const Purchases = load();
  if (!Purchases || !configurePurchases()) return NO_KEY;
  try {
    applyCustomerInfo(await Purchases.restorePurchases());
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'failed', detail: errorDetail(e) };
  }
}

async function storeItems(ids: readonly string[]): Promise<PurchasesStoreProduct[]> {
  const Purchases = load();
  if (!Purchases || !configurePurchases() || ids.length === 0) return [];
  return Purchases.getProducts([...ids], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
}

/** Localized prices of Shop items the store sells, by product id. Missing ones aren't on sale yet. */
export async function itemPrices(ids: readonly string[]): Promise<Record<string, string>> {
  try {
    const products = await storeItems(ids);
    return Object.fromEntries(products.map((p) => [p.identifier.split(':')[0], p.priceString]));
  } catch {
    return {};
  }
}

/** Buys one Shop item (a word pack or a role card). */
export async function buyItem(id: string): Promise<PurchaseResult> {
  const Purchases = load();
  if (!Purchases) return NO_KEY;
  let product: PurchasesStoreProduct | undefined;
  try {
    product = (await storeItems([id])).find((p) => p.identifier.split(':')[0] === id);
  } catch (e) {
    return { ok: false, reason: 'failed', detail: errorDetail(e) };
  }
  if (!product) return { ok: false, reason: 'unavailable', detail: `${id} is not on sale yet` };
  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);
    applyCustomerInfo(customerInfo);
    return { ok: true };
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return { ok: false, reason: 'cancelled' };
    return { ok: false, reason: 'failed', detail: errorDetail(e) };
  }
}

/** Rewarded ads (AdMob, server-verified) aren't set up in this build yet. */
export async function watchRewardedAd(): Promise<PurchaseResult> {
  return { ok: false, reason: 'unavailable' };
}
