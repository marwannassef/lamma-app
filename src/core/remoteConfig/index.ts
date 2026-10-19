import type { PunishmentLevel } from '@/core/punishments';

/**
 * Values the server will control (monetization §3–6). Until the backend exists these defaults
 * are used; the same shape will come from the remote config endpoint.
 */
export interface RemoteConfig {
  /** Pack ids free users can play. null = use each pack's own `tier`. */
  freePackIds: string[] | null;
  caps: {
    spy: { players: number; spies: number; punishmentLevels: PunishmentLevel[] };
    werewolf: { players: number; setupTiers: string[] };
    blendIn: { players: number; modes: string[]; escape: string[] };
  };
  /** Soft "Loved it?" card after a game: at most once per this many hours. */
  softPaywallHours: number;
  prices: { partyPass: string; annual: string; lifetime: string };
}

export const DEFAULT_CONFIG: RemoteConfig = {
  freePackIds: null,
  caps: {
    spy: { players: 6, spies: 1, punishmentLevels: ['off', 'light'] },
    werewolf: { players: 8, setupTiers: ['basic'] },
    blendIn: { players: 6, modes: ['classic'], escape: ['normal'] },
  },
  softPaywallHours: 24,
  // Shown until the store returns localized prices.
  prices: { partyPass: '$2.99', annual: '$14.99', lifetime: '$24.99' },
};

export const useRemoteConfig = (): RemoteConfig => DEFAULT_CONFIG;
