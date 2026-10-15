import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mathRng } from '@/core/rng';
import { storage } from '@/core/storage';

import {
  DEFAULT_RULES,
  gameReducer,
  resumePhase,
  type GameEvent,
  type GameState,
  type HouseRules,
  type RoleCounts,
  type Tier,
} from './engine';

export type SetupChoice = { kind: 'curated'; tier: Tier } | { kind: 'custom'; roles: RoleCounts };

interface WerewolfState {
  /** The game in progress. Persisted after every event so a relaunch can resume. */
  game: GameState | null;
  /** Whether the finished game's points were already added to the scoreboard. */
  scored: boolean;
  rules: HouseRules;
  /** Last tier played per player count (preselection, §5.4). */
  lastTierByCount: Record<number, Tier>;
  /** Recently played tiers, newest last (the "Try next" nudge). */
  recentTiers: Tier[];
  /** Last custom roles, so Custom reopens where it was left. */
  customRoles: RoleCounts | null;
  setRules(patch: Partial<HouseRules>): void;
  setCustomRoles(roles: RoleCounts): void;
  start(game: GameState, tier: Tier | null): void;
  dispatch(e: GameEvent): void;
  markScored(): void;
  quit(): void;
}

export const useWerewolf = create<WerewolfState>()(
  persist(
    (set, get) => ({
      game: null,
      scored: false,
      rules: DEFAULT_RULES,
      lastTierByCount: {},
      recentTiers: [],
      customRoles: null,
      setRules: (patch) => set((s) => ({ rules: { ...s.rules, ...patch } })),
      setCustomRoles: (customRoles) => set({ customRoles }),
      start: (game, tier) =>
        set((s) => ({
          game,
          scored: false,
          ...(tier && {
            lastTierByCount: { ...s.lastTierByCount, [game.players.length]: tier },
            recentTiers: [...s.recentTiers, tier].slice(-5),
          }),
        })),
      dispatch: (e) => {
        const game = get().game;
        if (!game) return;
        const next = gameReducer(game, e, { now: Date.now(), rng: mathRng });
        if (next !== game) set({ game: next });
      },
      markScored: () => set({ scored: true }),
      quit: () => set({ game: null, scored: false }),
    }),
    {
      name: 'werewolf',
      version: 1,
      storage: createJSONStorage(() => storage),
      // A relaunch never resumes on a secret screen (§4).
      merge: (persisted, current) => {
        const p = persisted as Partial<WerewolfState>;
        return { ...current, ...p, game: p.game ? resumePhase(p.game) : null };
      },
    },
  ),
);
