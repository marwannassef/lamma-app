import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Pack } from '@/core/content';
import { mathRng, type Rng } from '@/core/rng';
import { storage } from '@/core/storage';

import { emptyVerdict, RANDOM, setupRound, type CategoryChoice, type Verdict } from './logic';

export interface ActiveRound {
  no: number;
  packId: string;
  wordId: string;
  spies: number[];
  firstAsker: number;
  /** Category choice when the round started (the pill only shows in random mode). */
  choice: CategoryChoice;
  verdicts: Verdict[];
  /** Points from this round once scored; null before. */
  gain: number[] | null;
}

interface SpyState {
  spies: number;
  choice: CategoryChoice;
  spySeesCategory: boolean;
  lastPackId: string | null;
  usedByPack: Record<string, string[]>;
  /** In memory only: an unfinished round is dropped when the app restarts. */
  round: ActiveRound | null;
  setSpies(n: number): void;
  setChoice(choice: CategoryChoice): void;
  setSpySeesCategory(on: boolean): void;
  start(input: { players: number; spies: number; packs: Pack[]; no: number; rng?: Rng }): void;
  setVerdict(spyIndex: number, patch: Partial<Verdict>): void;
  setGain(gain: number[]): void;
}

export const useSpy = create<SpyState>()(
  persist(
    (set, get) => ({
      spies: 1,
      choice: RANDOM,
      spySeesCategory: true,
      lastPackId: null,
      usedByPack: {},
      round: null,
      setSpies: (spies) => set({ spies }),
      setChoice: (choice) => set({ choice }),
      setSpySeesCategory: (spySeesCategory) => set({ spySeesCategory }),
      start: ({ players, spies, packs, no, rng = mathRng }) => {
        const s = get();
        const r = setupRound({
          players,
          spies,
          packs,
          choice: s.choice,
          lastPackId: s.lastPackId,
          usedByPack: s.usedByPack,
          rng,
        });
        set({
          lastPackId: r.packId,
          usedByPack: { ...s.usedByPack, [r.packId]: r.used },
          round: {
            no,
            packId: r.packId,
            wordId: r.wordId,
            spies: r.spies,
            firstAsker: r.firstAsker,
            choice: s.choice,
            verdicts: r.spies.map(emptyVerdict),
            gain: null,
          },
        });
      },
      setVerdict: (k, patch) =>
        set((s) => {
          if (!s.round) return {};
          const verdicts = s.round.verdicts.map((v, i) => {
            if (i !== k) return v;
            const next = { ...v, ...patch };
            // "Escaped" makes the guess question irrelevant.
            if (next.caught === false) next.guessed = null;
            return next;
          });
          return { round: { ...s.round, verdicts } };
        }),
      setGain: (gain) => set((s) => (s.round ? { round: { ...s.round, gain } } : {})),
    }),
    {
      name: 'spy',
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: ({ round: _round, ...rest }) => rest,
    },
  ),
);
