import { player } from './roles';
import type { GameState, PlayerId, VoteChoice } from './types';

export type VoteOutcome =
  | { t: 'execute'; playerId: PlayerId }
  | { t: 'none' }
  /** A tie with a living Mayor: the Mayor decides among the tied players. */
  | { t: 'mayorTieBreak'; tied: PlayerId[] };

/**
 * What the host's vote entry means (§2.5 step 7): the most-pointed player is executed; a tie
 * goes to a living Mayor, otherwise nobody is executed; "No execution" executes nobody.
 */
export function resolveVote(state: GameState, choice: VoteChoice): VoteOutcome {
  if (choice.t === 'none') return { t: 'none' };
  if (choice.t === 'player') {
    if (!player(state, choice.id).alive) throw new Error('only living players can be executed');
    return { t: 'execute', playerId: choice.id };
  }
  const tied = choice.tied.filter((id) => player(state, id).alive);
  const mayorAlive = state.mayor != null && player(state, state.mayor).alive;
  if (mayorAlive && tied.length > 1) return { t: 'mayorTieBreak', tied };
  return { t: 'none' };
}

/** The Mayor picks one of the tied players, or spares everyone (null). */
export function mayorTieBreak(tied: readonly PlayerId[], pickId: PlayerId | null): VoteOutcome {
  if (pickId == null) return { t: 'none' };
  if (!tied.includes(pickId)) throw new Error('the Mayor must pick one of the tied players');
  return { t: 'execute', playerId: pickId };
}
