import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import { SOUNDS, type SoundId } from './sounds';

/** Looping channels (§10 "layered channels"); one-shot stingers play on their own players. */
export type Channel = 'ambience' | 'music';

/** How much the background drops while the narrator speaks. */
export const DUCK = 0.6;

interface Loop {
  id: SoundId;
  player: AudioPlayer;
  volume: number;
}

/**
 * The app's sound board. Loops keep their own volume; the effective volume also applies the
 * host volume and ducking. Everything is a no-op while sound is off or the host paused.
 */
export class Mixer {
  private loops: Partial<Record<Channel, Loop>> = {};
  private enabled = true;
  private paused = false;
  private ducked = false;
  /** Host volume, 0–1. */
  master = 1;

  constructor(
    private create: (id: SoundId) => AudioPlayer = (id) => createAudioPlayer(SOUNDS[id]),
  ) {}

  get isPaused() {
    return this.paused;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stopAll();
  }

  private apply(loop: Loop) {
    loop.player.volume = loop.volume * this.master * (this.ducked ? DUCK : 1);
  }

  playLoop(channel: Channel, id: SoundId, volume = 1) {
    if (!this.enabled) return;
    const current = this.loops[channel];
    if (current?.id === id) {
      current.volume = volume;
      this.apply(current);
      if (!this.paused && !current.player.playing) current.player.play();
      return;
    }
    this.stopLoop(channel);
    const player = this.create(id);
    player.loop = true;
    const loop = { id, player, volume };
    this.loops[channel] = loop;
    this.apply(loop);
    if (!this.paused) player.play();
  }

  setLoopVolume(channel: Channel, volume: number) {
    const loop = this.loops[channel];
    if (!loop) return;
    loop.volume = volume;
    this.apply(loop);
  }

  setRate(channel: Channel, rate: number) {
    this.loops[channel]?.player.setPlaybackRate(rate);
  }

  stopLoop(channel: Channel) {
    const loop = this.loops[channel];
    if (!loop) return;
    loop.player.pause();
    loop.player.remove();
    delete this.loops[channel];
  }

  /** A one-shot stinger. The player frees itself when it finishes. */
  sfx(id: SoundId, volume = 1) {
    if (!this.enabled || this.paused) return;
    const player = this.create(id);
    player.volume = volume * this.master;
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) {
        sub.remove();
        player.remove();
      }
    });
    player.play();
  }

  duck(on: boolean) {
    this.ducked = on;
    Object.values(this.loops).forEach((l) => l && this.apply(l));
  }

  setMaster(volume: number) {
    this.master = Math.max(0, Math.min(1, volume));
    Object.values(this.loops).forEach((l) => l && this.apply(l));
  }

  pause() {
    this.paused = true;
    Object.values(this.loops).forEach((l) => l?.player.pause());
  }

  resume() {
    this.paused = false;
    if (!this.enabled) return;
    Object.values(this.loops).forEach((l) => l?.player.play());
  }

  stopAll() {
    (Object.keys(this.loops) as Channel[]).forEach((c) => this.stopLoop(c));
  }
}

export const mixer = new Mixer();
