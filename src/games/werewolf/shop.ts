import { roleProductId } from '@/core/entitlements';

import { ALL_ROLES, type RoleCounts, type RoleId } from './engine';

/** Roles every free game has: the ones in the Basic setups (monetization §3). */
export const FREE_ROLES: readonly RoleId[] = ['villager', 'werewolf', 'seer', 'doctor'];

/** Role cards sold one by one in the Shop. Premium includes all of them. */
export const SHOP_ROLES: readonly RoleId[] = ALL_ROLES.filter((r) => !FREE_ROLES.includes(r));

/** Whether a free user may play with this role: free, or its card was bought. */
export const roleUnlocked = (role: RoleId, owned: readonly string[]) =>
  FREE_ROLES.includes(role) || owned.includes(roleProductId(role));

/** Whether a free user may play this setup: every role in it is unlocked. */
export const setupUnlocked = (roles: RoleCounts, owned: readonly string[]) =>
  (Object.keys(roles) as RoleId[]).every((r) => !roles[r] || roleUnlocked(r, owned));

/** The first role of a setup still to buy, for the paywall's "Buy just this" offer. */
export const firstLockedRole = (roles: RoleCounts, owned: readonly string[]) =>
  (Object.keys(roles) as RoleId[]).find((r) => roles[r] && !roleUnlocked(r, owned));
