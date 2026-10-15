// Pure Spy rules. No React, no storage; randomness comes from the injected Rng.
import type { Pack, Word } from '@/core/content';
import { int, pick, shuffle, type Rng } from '@/core/rng';

export const RANDOM = 'random';
/** A pack id, or RANDOM for a new category every round. */
export type CategoryChoice = string;

/** One spy, or up to two once there are 7+ players. */
export const maxSpies = (players: number) => (players >= 7 ? 2 : 1);

export const clampSpies = (spies: number, players: number) =>
  Math.min(maxSpies(players), Math.max(1, spies));

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

export interface RoundSetup {
  packId: string;
  wordId: string;
  /** 0-based player indices, ascending. */
  spies: number[];
  firstAsker: number;
  /** Updated used-word ids for this pack. */
  used: string[];
}

export function setupRound(input: {
  players: number;
  spies: number;
  packs: readonly Pack[];
  choice: CategoryChoice;
  lastPackId: string | null;
  usedByPack: Readonly<Record<string, readonly string[]>>;
  rng: Rng;
}): RoundSetup {
  const { players, packs, choice, lastPackId, usedByPack, rng } = input;
  const pack = chooseCategory(packs, choice, lastPackId, rng);
  const { word, used } = chooseWord(pack, usedByPack[pack.id] ?? [], rng);
  const seats = Array.from({ length: players }, (_, i) => i);
  const spies = shuffle(rng, seats)
    .slice(0, clampSpies(input.spies, players))
    .sort((a, b) => a - b);
  return { packId: pack.id, wordId: word.id, spies, firstAsker: int(rng, players), used };
}

/** What the group says happened to one spy. null = not answered yet. */
export interface Verdict {
  caught: boolean | null;
  guessed: boolean | null;
}

export const emptyVerdict = (): Verdict => ({ caught: null, guessed: null });

/** Every spy has an answer: escaped, or caught plus whether they guessed the word. */
export const verdictsComplete = (verdicts: readonly Verdict[]) =>
  verdicts.every((v) => v.caught === false || (v.caught === true && v.guessed !== null));

/** A spy "wins" by escaping, or by being caught but guessing the word. */
export const spyWon = (v: Verdict) => v.caught === false || v.guessed === true;

/**
 * Points per player. For each spy: not caught → spy +2; caught but guessed → spy +1;
 * caught and wrong → every non-spy +1.
 */
export function scoreRound(
  players: number,
  spies: readonly number[],
  verdicts: readonly Verdict[],
): number[] {
  const gain = Array<number>(players).fill(0);
  const add = (player: number, points: number) => {
    gain[player] = (gain[player] as number) + points;
  };
  spies.forEach((spy, k) => {
    const v = verdicts[k] ?? emptyVerdict();
    if (!v.caught) add(spy, 2);
    else if (v.guessed) add(spy, 1);
    else for (let p = 0; p < players; p++) if (!spies.includes(p)) add(p, 1);
  });
  return gain;
}

export type RoundResult = 'players' | 'spy' | 'spies' | 'split';

export function roundResult(verdicts: readonly Verdict[]): RoundResult {
  const wins = verdicts.filter(spyWon).length;
  if (wins === 0) return 'players';
  if (wins < verdicts.length) return 'split';
  return verdicts.length > 1 ? 'spies' : 'spy';
}
