import { router } from 'expo-router';

import type { Pack } from '@/core/content';
import { DEFAULT_CONFIG, useRemoteConfig, type RemoteConfig } from '@/core/remoteConfig';

import { tierOf, useEntitlements, type Tier } from './state';

export { PREMIUM_PREVIEW_ALLOWED, tierOf, useEntitlements, type Tier } from './state';

/** Where the paywall was opened from (monetization §4). */
export type PaywallTrigger = 'cap' | 'locked' | 'gameEnd' | 'offline' | 'settings';

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
