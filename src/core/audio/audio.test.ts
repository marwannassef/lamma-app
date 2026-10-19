import type { AudioPlayer } from 'expo-audio';

import { seededRng } from '@/core/rng';

import { nextVolume, VOLUME_STEPS } from './controls';
import { applyLoops } from './cue';
import { DUCK, Mixer } from './mixer';
import { Narrator } from './narrator';
import { pickLine, speechLanguage } from './script';
import type { SoundId } from './sounds';

type Fake = AudioPlayer & { id: SoundId; finish(): void };

function fakes() {
  const made: Fake[] = [];
  const create = (id: SoundId) => {
    let listener: ((s: { didJustFinish: boolean }) => void) | null = null;
    const p: { playing: boolean; [k: string]: unknown } = {
      id,
      playing: false,
      volume: 1,
      loop: false,
      play: jest.fn((): void => {
        p.playing = true;
      }),
      pause: jest.fn((): void => {
        p.playing = false;
      }),
      remove: jest.fn(),
      setPlaybackRate: jest.fn(),
      addListener: jest.fn((_: string, fn: typeof listener) => {
        listener = fn;
        return { remove: jest.fn() };
      }),
      finish: () => listener?.({ didJustFinish: true }),
    };
    made.push(p as unknown as Fake);
    return p as unknown as AudioPlayer;
  };
  return { made, mixer: new Mixer(create) };
}

describe('Mixer', () => {
  it('plays a loop, keeps it when cued again and swaps it for another sound', () => {
    const { made, mixer } = fakes();
    mixer.playLoop('ambience', 'nightAmbience', 0.7);
    expect(made[0]).toMatchObject({ id: 'nightAmbience', loop: true, volume: 0.7, playing: true });
    mixer.playLoop('ambience', 'nightAmbience', 0.4);
    expect(made).toHaveLength(1);
    expect(made[0]?.volume).toBe(0.4);
    made[0]?.pause();
    mixer.playLoop('ambience', 'nightAmbience', 0.4);
    expect(made[0]?.playing).toBe(true);
    mixer.playLoop('ambience', 'heartbeat');
    expect(made[0]?.remove).toHaveBeenCalled();
    expect(made[1]?.id).toBe('heartbeat');
  });

  it('applies the host volume and ducks while the narrator speaks', () => {
    const { made, mixer } = fakes();
    mixer.playLoop('music', 'tavern', 0.5);
    mixer.setMaster(0.6);
    expect(made[0]?.volume).toBeCloseTo(0.3);
    mixer.duck(true);
    expect(made[0]?.volume).toBeCloseTo(0.3 * DUCK);
    mixer.duck(false);
    mixer.setLoopVolume('music', 1);
    expect(made[0]?.volume).toBeCloseTo(0.6);
    mixer.setMaster(5);
    expect(mixer.master).toBe(1);
    mixer.setLoopVolume('ambience', 1); // nothing playing there: no-op
  });

  it('changes the playback rate of a channel', () => {
    const { made, mixer } = fakes();
    mixer.setRate('music', 1.25);
    mixer.playLoop('music', 'tavern');
    mixer.setRate('music', 1.25);
    expect(made[0]?.setPlaybackRate).toHaveBeenCalledWith(1.25);
  });

  it('frees a stinger when it finishes', () => {
    const { made, mixer } = fakes();
    mixer.sfx('chime', 0.5);
    expect(made[0]).toMatchObject({ volume: 0.5, playing: true });
    made[0]?.finish();
    expect(made[0]?.remove).toHaveBeenCalled();
  });

  it('holds everything while paused and stays silent while sound is off', () => {
    const { made, mixer } = fakes();
    mixer.playLoop('ambience', 'nightAmbience');
    mixer.pause();
    expect(mixer.isPaused).toBe(true);
    expect(made[0]?.playing).toBe(false);
    mixer.sfx('chime');
    mixer.playLoop('music', 'tavern');
    expect(made[1]?.playing).toBe(false);
    mixer.resume();
    expect(made[0]?.playing && made[1]?.playing).toBe(true);
    mixer.setEnabled(false);
    expect(made[0]?.remove).toHaveBeenCalled();
    mixer.playLoop('music', 'tavern');
    mixer.sfx('chime');
    mixer.resume();
    expect(made).toHaveLength(2);
  });

  it('starts and stops the loops a cue names', () => {
    const { made, mixer } = fakes();
    applyLoops(mixer, {
      loops: { ambience: { id: 'nightAmbience', volume: 1 } },
      sfx: 'nightFall',
    });
    expect(made.map((p) => p.id)).toEqual(['nightAmbience', 'nightFall']);
    applyLoops(mixer, { loops: { ambience: null } });
    expect(made[0]?.remove).toHaveBeenCalled();
    applyLoops(mixer, {});
  });
});

describe('Narrator', () => {
  const setup = () => {
    const { mixer } = fakes();
    const speech = { speak: jest.fn(), stop: jest.fn(() => Promise.resolve()) };
    const duck = jest.spyOn(mixer, 'duck');
    return { mixer, speech, duck, narrator: new Narrator(speech, mixer) };
  };

  it('speaks in the given language and ducks the background until the line ends', () => {
    const { speech, duck, narrator } = setup();
    narrator.speak('Night falls', 'en-US');
    expect(speech.speak).toHaveBeenCalledWith(
      'Night falls',
      expect.objectContaining({ language: 'en-US' }),
    );
    expect(duck).toHaveBeenLastCalledWith(true);
    narrator.speak('Wolves wake', 'en-US');
    speech.speak.mock.calls[0][1].onDone();
    expect(duck).toHaveBeenLastCalledWith(true);
    speech.speak.mock.calls[1][1].onDone();
    expect(duck).toHaveBeenLastCalledWith(false);
  });

  it('replays the last line and skips the current one', () => {
    const { speech, duck, narrator } = setup();
    narrator.replay();
    expect(speech.speak).not.toHaveBeenCalled();
    narrator.speak('', 'en-US');
    narrator.speak('Point!', 'ar-EG');
    narrator.replay();
    expect(speech.speak).toHaveBeenLastCalledWith(
      'Point!',
      expect.objectContaining({ language: 'ar-EG' }),
    );
    narrator.skip();
    expect(speech.stop).toHaveBeenCalled();
    expect(duck).toHaveBeenLastCalledWith(false);
  });

  it('stays quiet while off or paused, but remembers the line for replay', () => {
    const { mixer, speech, narrator } = setup();
    narrator.setEnabled(false);
    narrator.speak('Night falls', 'en-US');
    mixer.pause();
    narrator.setEnabled(true);
    narrator.speak('Night falls', 'en-US');
    expect(speech.speak).not.toHaveBeenCalled();
    expect(narrator.last?.text).toBe('Night falls');
  });
});

describe('script helpers', () => {
  it('picks one of the variants with the injected rng', () => {
    expect(pickLine('One', seededRng(1))).toBe('One');
    expect(pickLine([], seededRng(1))).toBe('');
    const lines = ['a', 'b', 'c'];
    const seen = new Set(Array.from({ length: 30 }, (_, i) => pickLine(lines, seededRng(i))));
    expect(seen).toEqual(new Set(lines));
  });

  it('maps the UI language to a speech voice', () => {
    expect(speechLanguage('ar')).toBe('ar-EG');
    expect(speechLanguage('en')).toBe('en-US');
    expect(speechLanguage('fr')).toBe('fr');
  });

  it('cycles the host volume', () => {
    expect(nextVolume(1)).toBe(VOLUME_STEPS[1]);
    expect(nextVolume(0.3)).toBe(1);
    expect(nextVolume(0.42)).toBe(1);
  });
});
