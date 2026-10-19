import type { ContentLevel } from '@/core/content';

/** What the platform says about the user's age (monetization §7). */
export type AgeSignal = 'under13' | '13to17' | '18plus' | 'unknown';
/** "Who's playing tonight?": null until asked at first launch. */
export type Audience = ContentLevel | null;

/** Highest level an age signal allows. Under 13 is Kids, and the PIN can't override it. */
export const capFor = (signal: AgeSignal): ContentLevel => (signal === 'under13' ? 'kids' : 'teen');

/** Effective level = the lower of the age-signal cap and the chosen level. */
export function effectiveLevel(audience: Audience, signal: AgeSignal): ContentLevel {
  if (capFor(signal) === 'kids') return 'kids';
  return audience ?? 'kids';
}

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);
