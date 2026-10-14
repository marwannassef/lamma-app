import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/core/storage';

export type Appearance = 'system' | 'light' | 'dark';
/** 'system' or a locale code that has a folder under locales/. */
export type LanguagePref = 'system' | string;

interface SettingsState {
  language: LanguagePref;
  appearance: Appearance;
  haptics: boolean;
  sound: boolean;
  /** Enabled content regions; null means "pick from the device region". */
  regions: string[] | null;
  /** Only meaningful in builds with ADULT_ENABLED. */
  adultMode: boolean;
  setLanguage(language: LanguagePref): void;
  setAppearance(appearance: Appearance): void;
  setHaptics(on: boolean): void;
  setSound(on: boolean): void;
  setRegions(regions: string[]): void;
  setAdultMode(on: boolean): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'system',
      appearance: 'system',
      haptics: true,
      sound: true,
      regions: null,
      adultMode: false,
      setLanguage: (language) => set({ language }),
      setAppearance: (appearance) => set({ appearance }),
      setHaptics: (haptics) => set({ haptics }),
      setSound: (sound) => set({ sound }),
      setRegions: (regions) => set({ regions }),
      setAdultMode: (adultMode) => set({ adultMode }),
    }),
    { name: 'settings', version: 1, storage: createJSONStorage(() => storage) },
  ),
);
