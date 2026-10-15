import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Pack } from '@/core/content';
import { mathRng } from '@/core/rng';
import { useSession } from '@/core/session';
import { storage } from '@/core/storage';

import {
  blendInReducer,
  DEFAULT_SETTINGS,
  newGame,
  resumeState,
  type BlendInEvent,
  type BlendInState,
  type Memory,
  type Settings,
} from './logic';

interface BlendInStore {
  settings: Settings;
  /** Remembered across games: used secret words, last topic and last Chameleon. */
  memory: Memory;
  game: BlendInState | null;
  setSettings(patch: Partial<Settings>): void;
  start(players: number, packs: readonly Pack[]): void;
  dispatch(e: BlendInEvent): void;
  quit(): void;
}

const memoryOf = (g: BlendInState): Memory => ({
  usedByPack: g.usedByPack,
  lastPackId: g.lastPackId,
  lastChameleon: g.lastChameleon,
});

export const useBlendIn = create<BlendInStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      memory: { usedByPack: {}, lastPackId: null, lastChameleon: null },
      game: null,
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      start: (players, packs) => {
        const game = newGame(players, get().settings, packs, get().memory, mathRng);
        set({ game, memory: memoryOf(game) });
      },
      dispatch: (e) => {
        const game = get().game;
        if (!game) return;
        const next = blendInReducer(game, e, mathRng);
        if (next === game) return;
        // Each scored round goes onto the shared Lamma scoreboard once.
        if (next.phase.t === 'result' && game.phase.t !== 'result') {
          useSession.getState().addPoints(next.phase.gain);
        }
        set({ game: next, memory: memoryOf(next) });
      },
      quit: () => set({ game: null }),
    }),
    {
      name: 'blend-in',
      version: 1,
      storage: createJSONStorage(() => storage),
      merge: (persisted, current) => {
        const p = persisted as Partial<BlendInStore>;
        return { ...current, ...p, game: p.game ? resumeState(p.game) : null };
      },
    },
  ),
);
