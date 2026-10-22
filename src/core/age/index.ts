import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ContentLevel } from '@/core/content';
import { storage } from '@/core/storage';

import { capFor, effectiveLevel, isValidPin, type AgeSignal, type Audience } from './levels';
import { readAgeSignal } from './signals';

export { capFor, effectiveLevel, isValidPin, type AgeSignal, type Audience };

interface AgeState {
  audience: Audience;
  /** 4-digit parent PIN, set at first launch. Turning on Teens and adults always needs it. */
  pin: string | null;
  signal: AgeSignal;
  /** The table confirmed cheeky words this session (not persisted). */
  teenConfirmed: boolean;
  setAudience(audience: ContentLevel): void;
  setPin(pin: string): void;
  /** Choosing or switching to Teen needs the PIN; returns whether it was accepted. */
  unlockTeen(pin: string): boolean;
  confirmTeen(): void;
  refreshSignal(): Promise<void>;
}

export const useAge = create<AgeState>()(
  persist(
    (set, get) => ({
      audience: null,
      pin: null,
      signal: 'unknown',
      teenConfirmed: false,
      setAudience: (audience) => {
        // With a PIN set, Teen is only reachable through unlockTeen.
        if (audience === 'teen' && get().audience !== 'teen' && get().pin) return;
        set({ audience });
      },
      setPin: (pin) => isValidPin(pin) && set({ pin }),
      unlockTeen: (pin) => {
        const s = get();
        if (capFor(s.signal) === 'kids' || (s.pin && pin !== s.pin)) return false;
        set({ audience: 'teen' });
        return true;
      },
      confirmTeen: () => set({ teenConfirmed: true }),
      refreshSignal: async () => {
        set({ signal: await readAgeSignal() });
      },
    }),
    {
      name: 'age',
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: ({ teenConfirmed: _t, ...rest }) => rest,
    },
  ),
);

/** The content level the whole app uses right now. */
export const useContentLevel = (): ContentLevel =>
  useAge((s) => effectiveLevel(s.audience, s.signal));
