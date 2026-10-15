import { isCrossLover, isPackWolf, living, teamOf } from './roles';
import type { GameState, PlayerId, WinResult } from './types';

const packWolfAlive = (s: GameState) =>
  living(s).filter((p) => isPackWolf(p.role) && !isCrossLover(s, p.id));

/**
 * Checks for a winner after a batch of deaths, in the order of §8. `executed` is the player the
 * day vote just executed (for the Tanner). Returns null while the game goes on.
 */
export function checkWin(state: GameState, executed: PlayerId | null = null): WinResult | null {
  const alive = living(state);
  const solo = (ids: PlayerId[], outcome: WinResult['outcome']): WinResult => ({
    outcome,
    winners: ids,
    soloWinners: ids,
  });

  // 1. Tanner executed by the day vote.
  if (executed != null && state.players[executed]?.role === 'tanner') {
    return solo([executed], 'tanner');
  }
  // 2. Everyone is dead.
  if (alive.length === 0) return { outcome: 'draw', winners: [], soloWinners: [] };
  // 3. Cross-team lovers are the last two alive.
  if (state.lovers && alive.length === 2 && alive.every((p) => isCrossLover(state, p.id))) {
    return solo([...state.lovers], 'lovers');
  }
  // 4. Serial Killer alive with at most one other player.
  const killer = alive.find((p) => p.role === 'serialKiller');
  if (killer && alive.length <= 2) return solo([killer.id], 'serialKiller');

  const wolves = packWolfAlive(state);
  // 5. Wolves reach parity (no Serial Killer alive).
  if (!killer && wolves.length > 0 && wolves.length >= alive.length - wolves.length) {
    const loneWins = wolves.length === 1 && wolves[0]?.role === 'loneWolf';
    const winners = state.players
      .filter(
        (p) =>
          teamOf(p.role) === 'wolves' &&
          !isCrossLover(state, p.id) &&
          (p.role !== 'loneWolf' || loneWins),
      )
      .map((p) => p.id);
    return {
      outcome: 'wolves',
      winners,
      soloWinners: loneWins ? [wolves[0]?.id as PlayerId] : [],
    };
  }
  // 6. No pack wolves and no Serial Killer: the village wins.
  if (!killer && wolves.length === 0) {
    const winners = state.players
      .filter((p) => teamOf(p.role) === 'village' && !isCrossLover(state, p.id))
      .map((p) => p.id);
    return { outcome: 'village', winners, soloWinners: [] };
  }
  // 7. The game goes on.
  return null;
}

/** Scoreboard points (§8): +1 per winner, +2 for solo winners, 0 for everyone else. */
export function scoreGame(result: WinResult, players: number): number[] {
  return Array.from({ length: players }, (_, id) =>
    result.soloWinners.includes(id) ? 2 : result.winners.includes(id) ? 1 : 0,
  );
}
