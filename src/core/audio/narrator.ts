import * as Speech from 'expo-speech';

import { mixer as defaultMixer, type Mixer } from './mixer';

type SpeechApi = Pick<typeof Speech, 'speak' | 'stop'>;

/**
 * The narrator reads lines with the device's text-to-speech voice (§10: v1 ships full device
 * TTS; recorded voice packs come later). It ducks the background while speaking and remembers
 * the last line for "replay".
 */
export class Narrator {
  private enabled = true;
  private pending = 0;
  last: { text: string; language: string } | null = null;

  constructor(
    private speech: SpeechApi = Speech,
    private mixer: Mixer = defaultMixer,
  ) {}

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.skip();
  }

  private done = () => {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending === 0) this.mixer.duck(false);
  };

  speak(text: string, language: string) {
    if (!text) return;
    this.last = { text, language };
    if (!this.enabled || this.mixer.isPaused) return;
    this.pending += 1;
    this.mixer.duck(true);
    this.speech.speak(text, {
      language,
      rate: 0.95,
      volume: this.mixer.master,
      useApplicationAudioSession: true,
      onDone: this.done,
      onStopped: this.done,
      onError: this.done,
    });
  }

  /** Says the last line again (host control). */
  replay() {
    if (this.last) this.speak(this.last.text, this.last.language);
  }

  /** Stops the current line and anything queued (host control). */
  skip() {
    this.pending = 0;
    void this.speech.stop();
    this.mixer.duck(false);
  }
}

export const narrator = new Narrator();
