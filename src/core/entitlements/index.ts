import { router } from 'expo-router';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Pack } from '@/core/content';
import { DEFAULT_CONFIG, useRemoteConfig, type RemoteConfig } from '@/core/remoteConfig';
import { storage } from '@/core/storage';

export type Tier = 'free' | 'premium';

/** Where the paywall was opened from (monetization §4). */
export type PaywallTrigger = 'cap' | 'locked' | 'gameEnd' | 'offline' | 'settings';

interface EntitlementState {
  /**
   * Premium only ever comes from a server-signed pass (monetization §9, rule 1). Until the
   * backend exists there is no pass, so everyone is on the free tier.
   */
  passTier: Tier | null;
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
      devPremium: false,
      softShownAt: 0,
      setDevPremium: (devPremium) => set({ devPremium }),
      markSoftShown: (now = Date.now()) => set({ softShownAt: now }),
    }),
    { name: 'entitlements', version: 1, storage: createJSONStorage(() => storage) },
  ),
);

export const tierOf = (
  s: Pick<EntitlementState, 'passTier' | 'devPremium'>,
  dev = __DEV__,
): Tier => (s.passTier === 'premium' || (dev && s.devPremium) ? 'premium' : 'free');

export const useTier = (): Tier => useEntitlements((s) => tierOf(s));
export const useIsPremium = () => useTier() === 'premium';

/** Free users get the server's free list, or each pack's own tier until there is one. */
export function packIsFree(pack: Pack, config: RemoteConfig = DEFAULT_CONFIG): boolean {
  return config.freePackIds ? config.freePackIds.includes(pack.id) : pack.tier === 'free';
}

export function usePackLocked() {
  const tier = useTier();
  const config = useRemoteConfig();
  return (pack: Pack) => tier === 'free' && !packIsFree(pack, config);
}

/** Whether the soft end-of-game card may show now (free users, once per day). */
export function softPaywallDue(lastShown: number, now: number, hours: number): boolean {
  return now - lastShown >= hours * 3_600_000;
}

/** Opens the paywall at the point the user hit a limit. Never on app start. */
export function openPaywall(trigger: PaywallTrigger, params: { game?: string; max?: number } = {}) {
  router.push({
    pathname: '/paywall',
    params: {
      trigger,
      ...(params.game && { game: params.game }),
      ...(params.max && { max: String(params.max) }),
    },
  });
}
