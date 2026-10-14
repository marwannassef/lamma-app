import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/core/storage';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MAX_NAME_LENGTH = 14;
const DEFAULT_PLAYERS = 5;

export const clampPlayers = (n: number) => Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, n));

interface PlayersState {
  count: number;
  /** Optional custom names by player index; blank means "Player N". Kept beyond `count`. */
  names: string[];
  setCount(count: number): void;
  setName(index: number, name: string): void;
}

/** The roster, shared by every game. Player indices are 0-based. */
export const usePlayers = create<PlayersState>()(
  persist(
    (set) => ({
      count: DEFAULT_PLAYERS,
      names: [],
      setCount: (count) => set({ count: clampPlayers(count) }),
      setName: (index, name) =>
        set((s) => {
          const names = s.names.slice();
          names[index] = name.slice(0, MAX_NAME_LENGTH);
          return { names };
        }),
    }),
    { name: 'players', version: 1, storage: createJSONStorage(() => storage) },
  ),
);

export const customName = (names: readonly string[], index: number) => (names[index] ?? '').trim();

/** Returns a function that gives each player's display name. */
export function usePlayerName() {
  const { t } = useTranslation();
  const names = usePlayers((s) => s.names);
  return (index: number) => customName(names, index) || t('players.defaultName', { n: index + 1 });
}
