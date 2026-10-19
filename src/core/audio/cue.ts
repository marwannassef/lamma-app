import type { Channel, Mixer } from './mixer';
import type { SoundId } from './sounds';

/** What a game phase sounds like: loops to (re)start or stop, a stinger, and a narration line. */
export type Loop = { id: SoundId; volume: number } | null;

export interface Cue {
  /** `null` stops the channel; a missing channel keeps playing as it is. */
  loops?: Partial<Record<Channel, Loop>>;
  sfx?: SoundId;
  /** An i18n key holding the line's variants, and its interpolation params. */
  line?: { key: string; params?: Record<string, unknown> };
}

export function applyLoops(mixer: Mixer, cue: Cue) {
  for (const [channel, loop] of Object.entries(cue.loops ?? {}) as [Channel, Loop][]) {
    if (loop) mixer.playLoop(channel, loop.id, loop.volume);
    else mixer.stopLoop(channel);
  }
  if (cue.sfx) mixer.sfx(cue.sfx);
}
