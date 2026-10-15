import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/core/storage';

import { fitScores } from './scoreboard';

export { fitScores, rankScores, type ScoreRow } from './scoreboard';

interface SessionState {
  scores: number[];
  /** Points each player got in the latest scored round. */
  lastGain: number[];
  /** Number of the next round to start (1-based). */
  round: number;
  /** Starts a round and returns its number. */
  startRound(): number;
  addPoints(gain: readonly number[]): void;
  /** Clears scores and the round counter. */
  reset(): void;
}

/** Scoreboard and round counter for the current game night. */
export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      scores: [],
      lastGain: [],
      round: 1,
      startRound: () => {
        const n = get().round;
        set({ round: n + 1, lastGain: [] });
        return n;
      },
      addPoints: (gain) =>
        set((s) => {
          const scores = fitScores(s.scores, gain.length).map((p, i) => p + (gain[i] ?? 0));
          return { scores, lastGain: gain.slice() };
        }),
      reset: () => set({ scores: [], lastGain: [], round: 1 }),
    }),
    { name: 'session', version: 1, storage: createJSONStorage(() => storage) },
  ),
);
