import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/core/storage';

export type Tier = 'free' | 'premium';

interface EntitlementState {
  /**
   * Premium only ever comes from a server-signed pass (monetization §9, rule 1). Until the
   * backend exists there is no pass, so everyone is on the free tier.
   */
  passTier: Tier | null;
  /**
   * What the store (RevenueCat) says the user owns: an active Annual or Lifetime, and when the
   * Party Pass runs out. Kept so Premium also works offline until the signed pass exists (§6, §9).
   */
  storePremium: boolean;
  partyPassUntil: number | null;
  setStore(s: { storePremium: boolean; partyPassUntil: number | null }): void;
  /** Developer builds only: preview Premium without a purchase. Ignored in store builds. */
  devPremium: boolean;
  /** Last time the soft "Loved it?" card was shown (ms). */
  softShownAt: number;
  setDevPremium(on: boolean): void;
  markSoftShown(now?: number): void;
}

export const useEntitlements = create<EntitlementState>()(
  persist(
    (set) => ({
      passTier: null,
      storePremium: false,
      partyPassUntil: null,
      devPremium: false,
      softShownAt: 0,
      setStore: (s) => set(s),
      setDevPremium: (devPremium) => set({ devPremium }),
      markSoftShown: (now = Date.now()) => set({ softShownAt: now }),
    }),
    { name: 'entitlements', version: 1, storage: createJSONStorage(() => storage) },
  ),
);

export const tierOf = (
  s: Pick<EntitlementState, 'passTier' | 'devPremium'> &
    Partial<Pick<EntitlementState, 'storePremium' | 'partyPassUntil'>>,
  dev = __DEV__,
  now = Date.now(),
): Tier =>
  s.passTier === 'premium' ||
  s.storePremium ||
  (s.partyPassUntil != null && s.partyPassUntil > now) ||
  (dev && s.devPremium)
    ? 'premium'
    : 'free';
