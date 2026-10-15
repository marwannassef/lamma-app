import type { RoleId } from './types';

/**
 * Role weights for the balance score (§5.5). Starting values: tune them from playtests here,
 * in this one place. A setup's score is the sum of weight × count (Villagers count +1 each).
 */
export const ROLE_WEIGHTS: Record<RoleId, number> = {
  villager: 1,
  werewolf: -6,
  alpha: -8,
  wolfCub: -8,
  loneWolf: -5,
  sorcerer: -3,
  seer: 7,
  apprenticeSeer: 4,
  witch: 4,
  hunter: 3,
  cupid: -3,
  mayor: 2,
  lycan: -1,
  cursed: -3,
  tanner: -2,
  serialKiller: -8,
  doctor: 5,
};

export type BalanceLabel =
  'villageFriendly' | 'leansVillage' | 'balanced' | 'leansWolves' | 'wolfFriendly';

export function balanceLabel(score: number): BalanceLabel {
  if (score >= 6) return 'villageFriendly';
  if (score >= 3) return 'leansVillage';
  if (score >= -2) return 'balanced';
  if (score >= -5) return 'leansWolves';
  return 'wolfFriendly';
}
