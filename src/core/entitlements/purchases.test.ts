import type * as PurchasesModule from './purchases';
import type * as StateModule from './state';
import { tierOf } from './state';
import { baseProductId, partyPassUntil, productIdFor, STORE_PRODUCTS } from './store';

const DAY = 24 * 60 * 60 * 1000;
const at = (iso: string) => Date.parse(iso);
const pass = (purchaseDate: string) => ({
  productIdentifier: STORE_PRODUCTS.partyPass,
  purchaseDate,
});

describe('store products', () => {
  it('maps store IDs (including Google "product:basePlan") to our products', () => {
    expect(productIdFor('lamma_premium_annual:annual')).toBe('annual');
    expect(productIdFor('lamma_premium_lifetime')).toBe('lifetime');
    expect(productIdFor('lamma_party_pass_7d')).toBe('partyPass');
    expect(productIdFor('something_else')).toBeNull();
    expect(baseProductId('a:b')).toBe('a');
  });

  it('gives each Party Pass 7 days and stacks passes bought while one is running', () => {
    expect(partyPassUntil([])).toBeNull();
    expect(partyPassUntil([pass('2026-10-01T10:00:00Z')])).toBe(at('2026-10-08T10:00:00Z'));
    // Bought again on day 3: the second week starts when the first one ends.
    expect(partyPassUntil([pass('2026-10-03T10:00:00Z'), pass('2026-10-01T10:00:00Z')])).toBe(
      at('2026-10-01T10:00:00Z') + 14 * DAY,
    );
    // Bought again after the first ran out: a fresh 7 days.
    expect(partyPassUntil([pass('2026-10-01T10:00:00Z'), pass('2026-10-20T10:00:00Z')])).toBe(
      at('2026-10-27T10:00:00Z'),
    );
    expect(
      partyPassUntil([{ productIdentifier: 'lamma_premium_lifetime', purchaseDate: '2026-10-01' }]),
    ).toBeNull();
    expect(partyPassUntil([pass('not a date')])).toBeNull();
  });

  it('makes the tier Premium from the store, a running Party Pass, or the signed pass', () => {
    const base = { passTier: null, devPremium: false };
    const now = at('2026-10-10T00:00:00Z');
    expect(tierOf(base, false, now)).toBe('free');
    expect(tierOf({ ...base, storePremium: true }, false, now)).toBe('premium');
    expect(tierOf({ ...base, partyPassUntil: now + DAY }, false, now)).toBe('premium');
    expect(tierOf({ ...base, partyPassUntil: now - DAY }, false, now)).toBe('free');
    expect(tierOf({ ...base, passTier: 'premium' }, false, now)).toBe('premium');
    expect(tierOf({ ...base, devPremium: true }, false, now)).toBe('free');
    expect(tierOf({ ...base, devPremium: true }, true, now)).toBe('premium');
  });
});

describe('purchases (RevenueCat)', () => {
  const info = (premium: boolean, passes: string[] = []) => ({
    entitlements: { active: premium ? { lamma_pro: {} } : {} },
    nonSubscriptionTransactions: passes.map(pass),
  });
  const pkg = (identifier: string, priceString: string) => ({
    product: { identifier, priceString },
  });

  function withSdk(key: string | undefined, sdk: Record<string, jest.Mock>) {
    let mod: typeof PurchasesModule = undefined as never;
    let state: typeof StateModule = undefined as never;
    let configured = false;
    jest.isolateModules(() => {
      if (key) process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = key;
      else delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
      jest.doMock('react-native-purchases', () => ({ __esModule: true, default: sdk }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require('./purchases');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      state = require('./state');
      // The SDK loads lazily; load it here so this test's fake is the one in use.
      configured = mod.configurePurchases();
    });
    return { mod, state, configured };
  }

  const fakeSdk = () => ({
    configure: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getCustomerInfo: jest.fn(async () => info(false)),
    getOfferings: jest.fn(async () => ({
      current: {
        availablePackages: [
          pkg('lamma_party_pass_7d', 'EGP 59'),
          pkg('lamma_premium_annual:annual', 'EGP 299'),
          pkg('lamma_premium_lifetime', 'EGP 479'),
        ],
      },
    })),
    purchasePackage: jest.fn(async () => ({ customerInfo: info(true) })),
    restorePurchases: jest.fn(async () => info(false, [new Date().toISOString()])),
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    jest.dontMock('react-native-purchases');
  });

  it('is unavailable until an API key is set', async () => {
    const sdk = fakeSdk();
    const { mod, configured } = withSdk(undefined, sdk);
    expect(configured).toBe(false);
    expect(mod.configurePurchases()).toBe(false);
    const noKey = { ok: false, reason: 'unavailable', detail: 'no RevenueCat key in this build' };
    expect(await mod.purchase('lifetime')).toEqual(noKey);
    expect(await mod.restorePurchases()).toEqual(noKey);
    expect(await mod.storePrices()).toEqual({});
    expect(sdk.configure).not.toHaveBeenCalled();
  });

  it('configures once, shows store prices, buys and restores', async () => {
    const sdk = fakeSdk();
    const { mod, state, configured } = withSdk('appl_test', sdk);
    expect(configured).toBe(true);
    expect(mod.configurePurchases()).toBe(true);
    expect(sdk.configure).toHaveBeenCalledTimes(1);
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: 'appl_test' });
    expect(await mod.storePrices()).toEqual({
      partyPass: 'EGP 59',
      annual: 'EGP 299',
      lifetime: 'EGP 479',
    });

    expect(await mod.purchase('annual')).toEqual({ ok: true });
    expect(sdk.purchasePackage).toHaveBeenCalledWith(pkg('lamma_premium_annual:annual', 'EGP 299'));
    expect(state.useEntitlements.getState().storePremium).toBe(true);

    // A pass bought just now comes back.
    expect(await mod.restorePurchases()).toEqual({ ok: true, found: true });
    expect(state.useEntitlements.getState().storePremium).toBe(false);
    expect(state.useEntitlements.getState().partyPassUntil).toBeGreaterThan(Date.now());

    // Nothing on this store account (an old pass, long expired): restore works, finds nothing.
    sdk.restorePurchases.mockResolvedValueOnce(info(false, ['2020-01-01T00:00:00Z']));
    expect(await mod.restorePurchases()).toEqual({ ok: true, found: false });
  });

  it('tells a cancelled purchase apart from a failed one', async () => {
    const sdk = fakeSdk();
    const { mod } = withSdk('appl_test', sdk);
    sdk.purchasePackage.mockRejectedValueOnce({ userCancelled: true });
    expect(await mod.purchase('lifetime')).toEqual({ ok: false, reason: 'cancelled' });
    sdk.purchasePackage.mockRejectedValueOnce(new Error('store down'));
    expect(await mod.purchase('lifetime')).toEqual({
      ok: false,
      reason: 'failed',
      detail: 'store down',
    });
    sdk.getOfferings.mockResolvedValueOnce({ current: null } as never);
    expect(await mod.purchase('lifetime')).toEqual({
      ok: false,
      reason: 'unavailable',
      detail: 'the current offering has no Lamma products',
    });
    sdk.getOfferings.mockResolvedValueOnce({
      current: { availablePackages: [pkg('lamma_premium_annual', '$14.99')] },
    } as never);
    expect(await mod.purchase('lifetime')).toEqual({
      ok: false,
      reason: 'unavailable',
      detail: 'lamma_premium_lifetime is not in the current offering',
    });
    sdk.getOfferings.mockRejectedValueOnce({
      readableErrorCode: 'CONFIGURATION_ERROR',
      message: 'None of the products could be fetched',
    });
    expect(await mod.purchase('lifetime')).toEqual({
      ok: false,
      reason: 'failed',
      detail: 'CONFIGURATION_ERROR: None of the products could be fetched',
    });
    sdk.restorePurchases.mockRejectedValueOnce(new Error('offline'));
    expect(await mod.restorePurchases()).toEqual({
      ok: false,
      reason: 'failed',
      detail: 'offline',
    });
    sdk.getOfferings.mockRejectedValueOnce(new Error('offline'));
    expect(await mod.storePrices()).toEqual({});
  });
});
