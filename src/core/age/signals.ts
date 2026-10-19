import type { AgeSignal } from './levels';

/**
 * Reads the platform age signal: Apple's Declared Age Range (iOS 26+, ranges at 13 and 18) or
 * Google Play Age Signals. Both need a native module that isn't in this build yet, so this
 * returns "unknown", which caps content at Teen (monetization §7) and keeps the user's choice.
 */
export async function readAgeSignal(): Promise<AgeSignal> {
  return 'unknown';
}
