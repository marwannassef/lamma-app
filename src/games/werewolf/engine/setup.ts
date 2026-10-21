import { int, shuffle, type Rng } from '@/core/rng';

import { CURATED, type CuratedSetup, type Tier } from '../content/presets';
import { balanceLabel, ROLE_WEIGHTS, type BalanceLabel } from './balance';
import { ALL_ROLES, CORE_ROLES, isPackWolf, ROLES } from './roles';
import type { RoleCounts, RoleId } from './types';

export type { CuratedSetup, Tier };

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;
export const TIERS: readonly Tier[] = ['basic', 'gentle', 'classic', 'party', 'chaos'];

const count = (roles: RoleCounts, r: RoleId) => roles[r] ?? 0;
export const total = (roles: RoleCounts) => ALL_ROLES.reduce((sum, r) => sum + count(roles, r), 0);
export const packWolves = (roles: RoleCounts) =>
  ALL_ROLES.filter(isPackWolf).reduce((sum, r) => sum + count(roles, r), 0);
const killers = (roles: RoleCounts) => packWolves(roles) + count(roles, 'serialKiller');
const specials = (roles: RoleCounts) => total(roles) - count(roles, 'villager');

/** Recommended pack size for a table (§5.1 rule 1). */
export function packSizeFor(players: number): number {
  if (players <= 6) return 1;
  if (players <= 9) return 2;
  if (players <= 15) return 3;
  return 4;
}

/** Villagers fill whatever the other roles leave, so the total equals the player count. */
export function fillVillagers(roles: RoleCounts, players: number): RoleCounts {
  const others = specials({ ...roles, villager: 0 });
  return { ...roles, villager: Math.max(0, players - others) };
}

export function balanceScore(roles: RoleCounts): number {
  return ALL_ROLES.reduce((sum, r) => sum + ROLE_WEIGHTS[r] * count(roles, r), 0);
}

export interface Balance {
  score: number;
  label: BalanceLabel;
}
export const balance = (roles: RoleCounts): Balance => {
  const score = balanceScore(roles);
  return { score, label: balanceLabel(score) };
};

/** Rounds the game lasts if the village guesses wrong every day (§5.3). */
export function maxRounds(roles: RoleCounts): number {
  const wolves = packWolves(roles);
  return Math.max(1, Math.ceil((total(roles) - wolves - wolves) / 2));
}

/** Estimated minutes: rounds × (discussion + 2 min). Untimed discussion counts as 3 min. */
export function estimatedMinutes(roles: RoleCounts, discussionSeconds: number | null): number {
  return maxRounds(roles) * ((discussionSeconds ?? 180) / 60 + 2);
}

export type SetupError =
  | 'wrongTotal'
  | 'noKiller'
  | 'tooManyKillers'
  | 'tooManySpecials'
  | 'needsSeer'
  | 'alphaNeedsPack'
  | 'cubNeedsPack'
  | 'loneWolfNeedsPack'
  | 'tooManyOfRole';

export type SetupWarning =
  | 'favorsVillage'
  | 'favorsWolves'
  | 'bigPack'
  | 'smallTableTwist'
  | 'earlySerialKiller'
  | 'noVillagers'
  | 'manyInfoRoles';

/** Hard rules (Start disabled with the reason shown) and soft warnings (§5.6). */
export function validateSetup(
  roles: RoleCounts,
  players: number,
): { errors: SetupError[]; warnings: SetupWarning[] } {
  const errors: SetupError[] = [];
  const warnings: SetupWarning[] = [];
  const pack = packWolves(roles);

  if (total(roles) !== players) errors.push('wrongTotal');
  if (pack === 0 && count(roles, 'serialKiller') === 0) errors.push('noKiller');
  if (killers(roles) * 2 >= players) errors.push('tooManyKillers');
  if (specials(roles) > players) errors.push('tooManySpecials');
  if (
    count(roles, 'seer') === 0 &&
    (count(roles, 'apprenticeSeer') || count(roles, 'sorcerer') || count(roles, 'lycan'))
  ) {
    errors.push('needsSeer');
  }
  if (count(roles, 'alpha') && pack < 2) errors.push('alphaNeedsPack');
  if (count(roles, 'wolfCub') && pack < 2) errors.push('cubNeedsPack');
  if (count(roles, 'loneWolf') && pack < 3) errors.push('loneWolfNeedsPack');
  if (ALL_ROLES.some((r) => count(roles, r) > ROLES[r].maxPerGame)) errors.push('tooManyOfRole');

  const score = balanceScore(roles);
  if (score > 5) warnings.push('favorsVillage');
  if (score < -5) warnings.push('favorsWolves');
  if (pack * 3 >= players) warnings.push('bigPack');
  if (players < 7 && (count(roles, 'cupid') || count(roles, 'tanner'))) {
    warnings.push('smallTableTwist');
  }
  if (players < 9 && count(roles, 'serialKiller')) warnings.push('earlySerialKiller');
  if (players >= 7 && count(roles, 'villager') === 0) warnings.push('noVillagers');
  if (count(roles, 'seer') + count(roles, 'apprenticeSeer') + count(roles, 'sorcerer') > 3) {
    warnings.push('manyInfoRoles');
  }
  return { errors, warnings };
}

const usesOnly = (roles: RoleCounts, available: readonly RoleId[]) =>
  ALL_ROLES.every((r) => !count(roles, r) || available.includes(r));

/**
 * Curated setups for this table, in tier order. Setups using roles that aren't available yet
 * are hidden (never greyed out). Basic exists for every count from 4 to 20.
 */
export function recommendedSetups(
  players: number,
  available: readonly RoleId[] = CORE_ROLES,
): CuratedSetup[] {
  return CURATED.filter((s) => s.players === players && usesOnly(s.roles, available)).sort(
    (a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier),
  );
}

export type Experience = 'first' | 'played' | 'experts';
const TIER_FOR: Record<Experience, Tier> = { first: 'basic', played: 'classic', experts: 'party' };

/**
 * Which recommended card starts selected (§5.4): the last setup used at this count if it's
 * still offered, else the group's experience tier, else Basic. Chaos is never preselected
 * unless it was the last setup used.
 */
export function preselect(
  cards: readonly CuratedSetup[],
  opts: { lastTier?: Tier | null; experience?: Experience | null },
): CuratedSetup | undefined {
  const byTier = (t: Tier | null | undefined) => (t ? cards.find((c) => c.tier === t) : undefined);
  return (
    byTier(opts.lastTier) ??
    byTier(opts.experience ? TIER_FOR[opts.experience] : null) ??
    byTier('basic') ??
    cards[0]
  );
}

/** After the same tier is played 3 times in a row, the next tier gets a "Try next" badge. */
export function tryNextTier(recentTiers: readonly Tier[], cards: readonly CuratedSetup[]) {
  const last = recentTiers.slice(-3);
  if (last.length < 3 || new Set(last).size !== 1) return null;
  const tier = last[0] as Tier;
  for (const next of TIERS.slice(TIERS.indexOf(tier) + 1)) {
    if (next !== 'chaos' && cards.some((c) => c.tier === next)) return next;
  }
  return null;
}

/** Roles each tier adds on top of the one before (§5.1 rule 4). */
const TIER_ROLES: Record<Tier, RoleId[]> = {
  basic: ['werewolf', 'seer', 'doctor'],
  gentle: ['werewolf', 'seer', 'doctor'],
  classic: ['alpha', 'hunter', 'witch'],
  party: ['cupid', 'tanner', 'mayor', 'wolfCub', 'apprenticeSeer', 'lycan', 'sorcerer'],
  chaos: ['serialKiller', 'loneWolf'],
};

const rolesUpTo = (tier: Tier) => [
  ...new Set(TIERS.slice(0, TIERS.indexOf(tier) + 1).flatMap((t) => TIER_ROLES[t])),
];

/** Plain-Villager minimum (§5.1 rule 3) for the 7+ tables Surprise me serves. */
const minVillagers = (players: number) => (players >= 10 ? 2 : 1);

/**
 * "Surprise me" (§5.4, from 7 players): a random setup from the roles of the group's tier and
 * the one below, keeping the pack size and every hard rule, scoring −2 to +2. Returns null if
 * 500 tries find nothing (the UI then shows the Party card).
 */
export function surpriseMe(
  players: number,
  tier: Tier,
  rng: Rng,
  available: readonly RoleId[] = ALL_ROLES,
): RoleCounts | null {
  if (players < 7) return null;
  const below = TIERS[Math.max(0, TIERS.indexOf(tier) - 1)] as Tier;
  const pool = [...new Set([...rolesUpTo(below), ...TIER_ROLES[tier]])].filter((r) =>
    available.includes(r),
  );
  const wolfRoles = pool.filter((r) => isPackWolf(r) && r !== 'werewolf');
  const otherRoles = pool.filter((r) => !isPackWolf(r));
  const pack = packSizeFor(players);

  for (let attempt = 0; attempt < 500; attempt++) {
    const roles: RoleCounts = { werewolf: 0 };
    // Pack: plain werewolves plus at most one of each special wolf role.
    for (const r of shuffle(rng, wolfRoles)) {
      if (packWolves(roles) < pack && rng.next() < 0.5) roles[r] = 1;
    }
    roles.werewolf = pack - packWolves({ ...roles, werewolf: 0 });
    // A few village/neutral specials, each at most once.
    const extras = shuffle(rng, otherRoles).slice(0, 1 + int(rng, Math.min(otherRoles.length, 5)));
    for (const r of extras) roles[r] = 1;
    if (!roles.seer && pool.includes('seer') && rng.next() < 0.85) roles.seer = 1;
    const filled = fillVillagers(roles, players);
    const score = balanceScore(filled);
    if (
      validateSetup(filled, players).errors.length === 0 &&
      (filled.villager as number) >= minVillagers(players) &&
      score >= -2 &&
      score <= 2
    ) {
      return Object.fromEntries(Object.entries(filled).filter(([, n]) => n)) as RoleCounts;
    }
  }
  return null;
}

/** Deals roles to seats at random. */
export function dealRoles(roles: RoleCounts, players: number, rng: Rng): RoleId[] {
  const deck = ALL_ROLES.flatMap((r) => Array<RoleId>(count(roles, r)).fill(r));
  if (deck.length !== players) throw new Error(`setup has ${deck.length} roles for ${players}`);
  return shuffle(rng, deck);
}
