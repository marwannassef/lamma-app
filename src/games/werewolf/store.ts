import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mathRng } from '@/core/rng';
import { storage } from '@/core/storage';

import {
  DEFAULT_RULES,
  gameReducer,
  newStory,
  resumePhase,
  type GameEvent,
  type GameState,
  type HouseRules,
  type RoleCounts,
  type Theme,
  type Tier,
} from './engine';
import type { Member } from '@/core/room';
import { regionTheme } from './theme';

export type SetupChoice =
  | { kind: 'curated'; tier: Tier }
  | { kind: 'custom'; roles: RoleCounts }
  | { kind: 'surprise'; roles: RoleCounts }
  | { kind: 'saved'; id: string };

/** A named custom setup (§5.6), offered again as a card at the same player count. */
export interface SavedSetup {
  id: string;
  name: string;
  players: number;
  roles: RoleCounts;
}

/** The most saved setups kept; the oldest goes first. */
export const MAX_SAVED = 20;

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
  savedSetups: SavedSetup[];
  /** The theme picked in setup (§15.4). */
  theme: Theme;
  /** The theme of the last game started; it goes first on the home screen. */
  lastTheme: Theme | null;
  /** A network game's players in seat order, so a relaunched host gives them their seats back. */
  netMembers: Member[] | null;
  setNetMembers(members: Member[] | null): void;
  setTheme(theme: Theme): void;
  setRules(patch: Partial<HouseRules>): void;
  setCustomRoles(roles: RoleCounts): void;
  /** Saves a setup and returns its id. */
  saveSetup(name: string, players: number, roles: RoleCounts): string;
  deleteSetup(id: string): void;
  start(game: GameState, tier: Tier | null): void;
  dispatch(e: GameEvent): void;
  markScored(): void;
  quit(): void;
}

/** Fills in fields a game saved by an older app version doesn't have. */
function upgrade(g: GameState): GameState {
  const phase = g.phase.t === 'morning' && !g.phase.story ? { ...g.phase, story: [] } : g.phase;
  return {
    ...g,
    theme: g.theme ?? 'werewolf',
    kids: g.kids ?? false,
    story: g.story ?? newStory(),
    rules: { ...DEFAULT_RULES, ...g.rules },
    phase,
  };
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
      savedSetups: [],
      theme: regionTheme(),
      lastTheme: null,
      netMembers: null,
      setNetMembers: (netMembers) => set({ netMembers }),
      setTheme: (theme) => set({ theme }),
      setRules: (patch) => set((s) => ({ rules: { ...s.rules, ...patch } })),
      setCustomRoles: (customRoles) => set({ customRoles }),
      saveSetup: (name, players, roles) => {
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({
          savedSetups: [...s.savedSetups, { id, name: name.trim(), players, roles }].slice(
            -MAX_SAVED,
          ),
        }));
        return id;
      },
      deleteSetup: (id) => set((s) => ({ savedSetups: s.savedSetups.filter((x) => x.id !== id) })),
      start: (game, tier) =>
        set((s) => ({
          game,
          scored: false,
          lastTheme: game.theme,
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
        return {
          ...current,
          ...p,
          rules: { ...DEFAULT_RULES, ...p.rules },
          game: p.game ? resumePhase(upgrade(p.game)) : null,
        };
      },
    },
  ),
);
