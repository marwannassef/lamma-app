export interface ScoreRow {
  player: number;
  points: number;
  gain: number;
  leader: boolean;
}

/** Scores resized to the roster: extra players start at 0, removed players are dropped. */
export function fitScores(scores: readonly number[], count: number): number[] {
  return Array.from({ length: count }, (_, i) => scores[i] ?? 0);
}

/** Rows sorted by points (ties by seat). Leaders are marked once anyone has points. */
export function rankScores(scores: readonly number[], gains: readonly number[] = []): ScoreRow[] {
  const top = Math.max(0, ...scores);
  return scores
    .map((points, player) => ({
      player,
      points,
      gain: gains[player] ?? 0,
      leader: top > 0 && points === top,
    }))
    .sort((a, b) => b.points - a.points || a.player - b.player);
}
