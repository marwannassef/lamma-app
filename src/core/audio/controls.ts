import { create } from 'zustand';

import { mixer } from './mixer';
import { narrator } from './narrator';

interface AudioControls {
  paused: boolean;
  togglePause(): void;
  /** Clears a pause when a game ends, so the next one starts with sound. */
  reset(): void;
}

/** Host controls state (§10): pausing stops the narrator and holds every loop. */
export const useAudioControls = create<AudioControls>()((set, get) => ({
  paused: false,
  togglePause: () => {
    if (get().paused) {
      mixer.resume();
      set({ paused: false });
    } else {
      narrator.skip();
      mixer.pause();
      set({ paused: true });
    }
  },
  reset: () => {
    mixer.resume();
    set({ paused: false });
  },
}));

/** Host volume steps, cycled by the volume button. */
export const VOLUME_STEPS = [1, 0.6, 0.3] as const;

export const nextVolume = (v: number) =>
  VOLUME_STEPS[(VOLUME_STEPS.findIndex((s) => Math.abs(s - v) < 0.01) + 1) % VOLUME_STEPS.length] ??
  1;
