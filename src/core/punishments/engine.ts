import { int, pick, shuffle, type Rng } from '@/core/rng';

export const REAL_LEVELS = ['light', 'medium', 'hard', 'public'] as const;
export type RealLevel = (typeof REAL_LEVELS)[number];
export type PunishmentLevel = 'off' | RealLevel | 'mix';
export const LEVELS: readonly PunishmentLevel[] = [
  'off',
  'light',
  'medium',
  'hard',
  'public',
  'mix',
];

/** Remaining item indices per level. Indices, not text, so decks survive a language switch. */
export type Decks = Partial<Record<RealLevel, number[]>>;
export type DeckSizes = Record<RealLevel, number>;

export interface Draw {
  level: RealLevel;
  index: number;
}

/**
 * Draws without repeats until a level's deck runs out, then reshuffles it.
 * `mix` picks a real level at random for each draw. Returns the new decks; inputs are untouched.
 */
export function draw(
  level: Exclude<PunishmentLevel, 'off'>,
  decks: Decks,
  sizes: DeckSizes,
  rng: Rng,
): { draw: Draw; decks: Decks } {
  const real: RealLevel = level === 'mix' ? pick(rng, REAL_LEVELS) : level;
  let deck = decks[real];
  if (!deck || deck.length === 0) {
    deck = shuffle(
      rng,
      Array.from({ length: sizes[real] }, (_, i) => i),
    );
  }
  const index = deck[deck.length - 1] as number;
  return { draw: { level: real, index }, decks: { ...decks, [real]: deck.slice(0, -1) } };
}

export interface PunishmentCard {
  id: string;
  /** Players this card is for. More than one means a group punishment. */
  players: number[];
  draw: Draw;
  swapped: boolean;
}

/** Players who gained nothing this round. */
export const losersOf = (gain: readonly number[]) =>
  gain.flatMap((g, player) => (g === 0 ? [player] : []));

/** More than 3 losers share one group punishment; otherwise each loser gets their own. */
export function punishmentTargets(losers: readonly number[]): number[][] {
  if (losers.length > 3) return [losers.slice()];
  return losers.map((p) => [p]);
}

/** Deals one card per target. */
export function deal(
  losers: readonly number[],
  level: Exclude<PunishmentLevel, 'off'>,
  decks: Decks,
  sizes: DeckSizes,
  rng: Rng,
): { cards: PunishmentCard[]; decks: Decks } {
  let current = decks;
  const cards = punishmentTargets(losers).map((players, i) => {
    const r = draw(level, current, sizes, rng);
    current = r.decks;
    return { id: `p${i}-${int(rng, 1e9)}`, players, draw: r.draw, swapped: false };
  });
  return { cards, decks: current };
}

/** Replaces a card's punishment once. A card that was already swapped is returned unchanged. */
export function swap(
  card: PunishmentCard,
  level: Exclude<PunishmentLevel, 'off'>,
  decks: Decks,
  sizes: DeckSizes,
  rng: Rng,
): { card: PunishmentCard; decks: Decks } {
  if (card.swapped) return { card, decks };
  const r = draw(level, decks, sizes, rng);
  return { card: { ...card, draw: r.draw, swapped: true }, decks: r.decks };
}
