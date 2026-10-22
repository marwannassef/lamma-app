import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/core/storage';

/** 'auto' = light by day, dark by night (device local time). */
export type Appearance = 'system' | 'light' | 'dark' | 'auto';
/** 'system' or a locale code that has a folder under locales/. */
export type LanguagePref = 'system' | string;

interface SettingsState {
  language: LanguagePref;
  appearance: Appearance;
  haptics: boolean;
  sound: boolean;
  /** The narrator voice (text-to-speech). */
  narration: boolean;
  /** Host volume for music, ambience and the narrator, 0–1. */
  volume: number;
  /** Enabled content regions; null means "pick from the device region". */
  regions: string[] | null;
  /** How the home screen shows the games: a searchable list or the 3D wheel. */
  homeView: 'wheel' | 'list';
  setHomeView(view: 'wheel' | 'list'): void;
  /** This phone's name in network games (what the other phones see). */
  myName: string;
  setMyName(name: string): void;
  /** Random id for network games, so a phone rejoins its own seat. Not tied to the person. */
  deviceId: string;
  setLanguage(language: LanguagePref): void;
  setAppearance(appearance: Appearance): void;
  setHaptics(on: boolean): void;
  setSound(on: boolean): void;
  setNarration(on: boolean): void;
  setVolume(v: number): void;
  setRegions(regions: string[]): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'system',
      appearance: 'system',
      haptics: true,
      sound: true,
      narration: true,
      volume: 1,
      regions: null,
      homeView: 'wheel',
      setHomeView: (homeView) => set({ homeView }),
      myName: '',
      setMyName: (myName) => set({ myName }),
      deviceId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      setLanguage: (language) => set({ language }),
      setAppearance: (appearance) => set({ appearance }),
      setHaptics: (haptics) => set({ haptics }),
      setSound: (sound) => set({ sound }),
      setNarration: (narration) => set({ narration }),
      setVolume: (volume) => set({ volume }),
      setRegions: (regions) => set({ regions }),
    }),
    { name: 'settings', version: 1, storage: createJSONStorage(() => storage) },
  ),
);
