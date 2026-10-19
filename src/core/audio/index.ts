import { setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { mathRng } from '@/core/rng';
import { useSettings } from '@/core/settings/store';

import { useAudioControls } from './controls';
import { applyLoops, type Cue } from './cue';
import { mixer } from './mixer';
import { narrator } from './narrator';
import { pickLine, speechLanguage } from './script';

export { nextVolume, useAudioControls, VOLUME_STEPS } from './controls';
export { applyLoops, type Cue } from './cue';
export { HostAudioControls } from './HostAudioControls';
export { DUCK, Mixer, mixer, type Channel } from './mixer';
export { Narrator, narrator } from './narrator';
export { pickLine, speechLanguage } from './script';
export { SOUNDS, type SoundId } from './sounds';

/** Keeps the mixer and narrator in sync with the Sound, Narrator and volume settings. Mount once. */
export function useAudioSettings() {
  const sound = useSettings((s) => s.sound);
  const narration = useSettings((s) => s.narration);
  const volume = useSettings((s) => s.volume);
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(
      () => undefined,
    );
  }, []);
  useEffect(() => mixer.setEnabled(sound), [sound]);
  useEffect(() => narrator.setEnabled(sound && narration), [narration, sound]);
  useEffect(() => mixer.setMaster(volume), [volume]);
}

/** Speaks a narration key (an array of variants, one picked at random) in the UI language. */
export function useNarrate(ns: 'werewolf' | 'blendIn') {
  const { t, i18n } = useTranslation(ns);
  return useCallback(
    (key: string, params: Record<string, unknown> = {}) => {
      const variants = t(key as never, { ...params, returnObjects: true }) as unknown;
      const line = Array.isArray(variants)
        ? pickLine(variants as string[], mathRng)
        : typeof variants === 'string'
          ? variants
          : '';
      narrator.speak(line, speechLanguage(i18n.language));
    },
    [i18n.language, t],
  );
}

/**
 * Plays a game's cue each time its phase key changes, and silences everything when the game
 * screen closes.
 */
export function usePhaseAudio(ns: 'werewolf' | 'blendIn', key: string, cue: () => Cue) {
  const narrate = useNarrate(ns);
  useEffect(() => {
    const c = cue();
    applyLoops(mixer, c);
    if (c.line) narrate(c.line.key, c.line.params);
    // The cue is derived from the same state as the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
      narrator.skip();
      mixer.stopAll();
      useAudioControls.getState().reset();
    },
    [],
  );
}
