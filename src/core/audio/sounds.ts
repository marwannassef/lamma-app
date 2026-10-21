// Original synthesized sounds (scripts/generate-sounds.py, docs/CREDITS.md).
export const SOUNDS = {
  nightAmbience: require('@/assets/audio/night-ambience.m4a'),
  heartbeat: require('@/assets/audio/heartbeat.m4a'),
  tavern: require('@/assets/audio/tavern.m4a'),
  lounge: require('@/assets/audio/lounge.m4a'),
  dawnSting: require('@/assets/audio/dawn-sting.m4a'),
  nightFall: require('@/assets/audio/night-fall.m4a'),
  revealWolves: require('@/assets/audio/reveal-wolves.m4a'),
  revealVillage: require('@/assets/audio/reveal-village.m4a'),
  fanfare: require('@/assets/audio/fanfare.m4a'),
  chime: require('@/assets/audio/chime.m4a'),
  tick: require('@/assets/audio/tick.m4a'),
  swoosh: require('@/assets/audio/swoosh.m4a'),
  countdown: require('@/assets/audio/countdown.m4a'),
  cityAmbience: require('@/assets/audio/city-ambience.m4a'),
  noirJazz: require('@/assets/audio/noir-jazz.m4a'),
  siren: require('@/assets/audio/siren.m4a'),
  cameraFlash: require('@/assets/audio/camera-flash.m4a'),
  jailClang: require('@/assets/audio/jail-clang.m4a'),
  softKnock: require('@/assets/audio/soft-knock.m4a'),
} as const;

export type SoundId = keyof typeof SOUNDS;
