import { pick, type Rng } from '@/core/rng';

import type { Pack, Word } from './types';

export const RANDOM = 'random';
/** A pack id, or RANDOM for a new category every round. */
export type CategoryChoice = string;

/**
 * The pack for this round. Random mode never repeats the previous round's pack when there is
 * another option, and never picks adult packs: those are only played when chosen explicitly.
 * A chosen pack that is no longer available (filtered out) falls back to random.
 */
export function chooseCategory(
  packs: readonly Pack[],
  choice: CategoryChoice,
  lastPackId: string | null,
  rng: Rng,
): Pack {
  const chosen = choice === RANDOM ? undefined : packs.find((p) => p.id === choice);
  if (chosen) return chosen;
  const pool = packs.filter((p) => !p.adult);
  const fresh = pool.filter((p) => p.id !== lastPackId);
  return pick(rng, fresh.length > 0 ? fresh : pool);
}

/** A word not used yet in this pack. Once every word was used, the pack starts over. */
export function chooseWord(
  pack: Pack,
  used: readonly string[],
  rng: Rng,
): { word: Word; used: string[] } {
  let seen = used.filter((id) => pack.words.some((w) => w.id === id));
  let pool = pack.words.filter((w) => !seen.includes(w.id));
  if (pool.length === 0) {
    seen = [];
    pool = pack.words;
  }
  const word = pick(rng, pool);
  return { word, used: [...seen, word.id] };
}
