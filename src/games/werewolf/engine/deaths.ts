import { player } from './roles';
import type { Death, Effect, GameState, Pending, PlayerId } from './types';

export interface DeathsResult {
  state: GameState;
  /** Everyone who died in this batch, once each, first cause kept (includes heartbreak). */
  deaths: Death[];
  pending: Pending;
  /** Apprentice promoted because the Seer died. */
  promotedApprentice?: PlayerId;
}

/**
 * Applies a batch of deaths with every cascade and trigger (§7 steps 6–8). Night resolution,
 * executions and the Hunter's shot all go through here, so roles behave the same day or night.
 */
export function applyDeaths(state: GameState, incoming: readonly Death[]): DeathsResult {
  const players = state.players.map((p) => ({ ...p }));
  const deaths: Death[] = [];
  const kill = (d: Death) => {
    const p = players[d.playerId];
    if (!p || !p.alive || deaths.some((x) => x.playerId === d.playerId)) return false;
    p.alive = false;
    deaths.push(d);
    return true;
  };
  incoming.forEach(kill);

  // Lovers: a lover's death takes their partner, repeated until nothing changes.
  let changed = true;
  while (changed && state.lovers) {
    changed = false;
    const [a, b] = state.lovers;
    for (const [dead, partner] of [
      [a, b],
      [b, a],
    ] as const) {
      if (!players[dead]?.alive && players[partner]?.alive) {
        changed = kill({ playerId: partner, cause: 'heartbreak' }) || changed;
      }
    }
  }

  let wolfKills = state.wolfKills;
  let promotedApprentice: PlayerId | undefined;
  const pending: Pending = {};
  for (const d of deaths) {
    const role = state.players[d.playerId]?.role;
    if (role === 'wolfCub') wolfKills = 2;
    if (role === 'hunter') pending.hunterShot = d.playerId;
    if (state.mayor === d.playerId) pending.mayorHandoff = d.playerId;
    if (role === 'seer') {
      const apprentice = players.find((p) => p.alive && p.role === 'apprenticeSeer');
      if (apprentice) {
        apprentice.role = 'seer';
        promotedApprentice = apprentice.id;
      }
    }
  }

  return { state: { ...state, players, wolfKills }, deaths, pending, promotedApprentice };
}

/** Interactive effects for the pending triggers: Hunter's shot first, then the Mayor's badge. */
export function effectsFor(pending: Pending): Effect[] {
  const queue: Effect[] = [];
  if (pending.hunterShot != null) queue.push({ t: 'hunterShot', hunter: pending.hunterShot });
  if (pending.mayorHandoff != null) queue.push({ t: 'mayorHandoff', mayor: pending.mayorHandoff });
  return queue;
}

/** The Hunter's last shot: a public death that cascades like any other. */
export function hunterShot(state: GameState, target: PlayerId): DeathsResult {
  if (!player(state, target).alive) throw new Error('the Hunter must shoot a living player');
  return applyDeaths(state, [{ playerId: target, cause: 'hunter' }]);
}

/** The dying Mayor hands the badge to a living player, or to nobody. */
export function mayorHandoff(state: GameState, to: PlayerId | null): GameState {
  if (to != null && !player(state, to).alive) throw new Error('the badge goes to a living player');
  return { ...state, mayor: to };
}
