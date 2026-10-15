import { pick, type Rng } from '@/core/rng';

import { applyDeaths } from './deaths';
import { isPackWolf, living, player } from './roles';
import type { Death, GameState, NightActions, NightReport, PlayerId } from './types';

/** Players the pack may attack: alive and not a pack member. */
export const wolfTargetable = (s: GameState, id: PlayerId) => {
  const p = s.players[id];
  return !!p && p.alive && !isPackWolf(p.role);
};

/** Most-voted target among `votes` (ties broken with `rng`), or undefined if nobody voted. */
function plurality(votes: PlayerId[], rng: Rng): PlayerId | undefined {
  if (votes.length === 0) return undefined;
  const tally = new Map<PlayerId, number>();
  for (const v of votes) tally.set(v, (tally.get(v) ?? 0) + 1);
  const best = Math.max(...tally.values());
  const tied = [...tally.entries()]
    .filter(([, n]) => n === best)
    .map(([id]) => id)
    .sort((a, b) => a - b);
  return pick(rng, tied);
}

/**
 * The pack's victims, primary first (§7 step 1). The living Alpha's pick wins; otherwise the
 * plurality of living pack wolves' votes, ties broken at random. With two kills the second
 * pick is resolved the same way, excluding the first. Invalid picks (dead, pack) are ignored.
 */
export function wolfTargets(state: GameState, actions: NightActions, rng: Rng): PlayerId[] {
  const voters = living(state).filter((p) => isPackWolf(p.role));
  const valid = (ids: PlayerId[] | undefined) =>
    (ids ?? []).filter((id) => wolfTargetable(state, id));
  const alpha = voters.find((p) => p.role === 'alpha');
  const alphaPicks = alpha ? valid(actions.wolfVotes[alpha.id]) : [];

  const targets: PlayerId[] = [];
  for (let slot = 0; slot < state.wolfKills; slot++) {
    const fromAlpha = alphaPicks.filter((id) => !targets.includes(id))[0];
    if (fromAlpha != null) {
      targets.push(fromAlpha);
      continue;
    }
    const votes = voters
      .flatMap((w) => {
        const picks = valid(actions.wolfVotes[w.id]);
        // First slot uses each wolf's first pick; the second slot uses all of their picks.
        return slot === 0 ? picks.slice(0, 1) : picks;
      })
      .filter((id) => !targets.includes(id));
    const t = plurality(votes, rng);
    if (t == null) break;
    targets.push(t);
  }
  return targets;
}

/** Resolves the night in exactly the order of §7. Pure: returns the new state and a report. */
export function resolveNight(
  state: GameState,
  actions: NightActions,
  rng: Rng,
): { state: GameState; report: NightReport } {
  const doctorAlive = living(state).some((p) => p.role === 'doctor');
  const witchAlive = living(state).some((p) => p.role === 'witch');
  const killerAlive = living(state).some((p) => p.role === 'serialKiller');
  const report: NightReport = {
    deaths: [],
    saves: [],
    conversions: [],
    witchHealConsumed: false,
    witchPoisonConsumed: false,
    pending: {},
    nextNight: { wolfKills: 1 },
  };
  const deaths: Death[] = [];
  let players = state.players.map((p) => ({ ...p }));

  // 1. Wolf targets.
  const targets = wolfTargets(state, actions, rng);
  // 2. Protection.
  const protectedSet = new Set<PlayerId>(
    doctorAlive && actions.doctorTarget != null ? [actions.doctorTarget] : [],
  );
  const canHeal = witchAlive && actions.witchHeal && !state.witch.healUsed;

  // 3. Wolf attacks, primary first.
  targets.forEach((t, i) => {
    const victim = players[t] as (typeof players)[number];
    if (protectedSet.has(t)) report.saves.push({ playerId: t, by: 'doctor' });
    else if (i === 0 && canHeal) {
      report.saves.push({ playerId: t, by: 'witch' });
      report.witchHealConsumed = true;
    } else if (victim.role === 'serialKiller') report.saves.push({ playerId: t, by: 'immune' });
    else if (victim.role === 'cursed') {
      players = players.map((p) => (p.id === t ? { ...p, role: 'werewolf' } : p));
      report.conversions.push(t);
    } else deaths.push({ playerId: t, cause: 'wolves' });
  });

  // 4. Serial Killer (the Doctor can block; the Witch's heal can't).
  const sk = actions.serialKillerTarget;
  if (killerAlive && sk != null && player(state, sk).alive) {
    if (protectedSet.has(sk)) report.saves.push({ playerId: sk, by: 'doctor' });
    else deaths.push({ playerId: sk, cause: 'serialKiller' });
  }

  // 5. Witch poison: unblockable.
  const poison = actions.witchPoison;
  if (witchAlive && poison != null && !state.witch.poisonUsed && player(state, poison).alive) {
    deaths.push({ playerId: poison, cause: 'poison' });
    report.witchPoisonConsumed = true;
  }

  // 6–8. Lovers, triggers and de-duplication.
  const after = applyDeaths({ ...state, players, wolfKills: 1 }, deaths);
  report.deaths = after.deaths;
  report.pending = after.pending;
  report.nextNight = {
    wolfKills: after.state.wolfKills,
    ...(after.promotedApprentice != null && { promotedApprentice: after.promotedApprentice }),
  };

  return {
    state: {
      ...after.state,
      witch: {
        healUsed: state.witch.healUsed || report.witchHealConsumed,
        poisonUsed: state.witch.poisonUsed || report.witchPoisonConsumed,
      },
      doctorLastTarget: doctorAlive ? (actions.doctorTarget ?? null) : state.doctorLastTarget,
      lastReport: report,
    },
    report,
  };
}
