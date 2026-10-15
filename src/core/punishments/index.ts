import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { mathRng, type Rng } from '@/core/rng';
import { storage } from '@/core/storage';

import {
  deal,
  REAL_LEVELS,
  swap,
  type DeckSizes,
  type Decks,
  type PunishmentCard,
  type PunishmentLevel,
  type RealLevel,
} from './engine';
import { punishmentFiles } from './punishmentFiles';

export * from './engine';

type PunishmentText = Record<RealLevel, string[]>;

const texts: Record<string, PunishmentText> = Object.fromEntries(
  punishmentFiles.keys().map((k) => [k.replace(/^\.\/|\.json$/g, ''), punishmentFiles(k)]),
);

/** Deck sizes are the same in every locale (content:check enforces it). */
export const deckSizes: DeckSizes = Object.fromEntries(
  REAL_LEVELS.map((l) => [l, texts.en?.[l].length ?? 0]),
) as DeckSizes;

export function punishmentText(lang: string, level: RealLevel, index: number): string {
  return (texts[lang] ?? texts.en)?.[level][index] ?? '';
}

interface PunishmentState {
  level: PunishmentLevel;
  decks: Decks;
  setLevel(level: PunishmentLevel): void;
  /** Deals cards for the losers; returns [] when punishments are off or nobody lost. */
  deal(losers: readonly number[], rng?: Rng): PunishmentCard[];
  swap(card: PunishmentCard, rng?: Rng): PunishmentCard;
}

export const usePunishments = create<PunishmentState>()(
  persist(
    (set, get) => ({
      level: 'mix',
      decks: {},
      setLevel: (level) => set({ level }),
      deal: (losers, rng = mathRng) => {
        const { level, decks } = get();
        if (level === 'off' || losers.length === 0) return [];
        const r = deal(losers, level, decks, deckSizes, rng);
        set({ decks: r.decks });
        return r.cards;
      },
      swap: (card, rng = mathRng) => {
        const { level, decks } = get();
        if (level === 'off') return card;
        const r = swap(card, level, decks, deckSizes, rng);
        set({ decks: r.decks });
        return r.card;
      },
    }),
    { name: 'punishments', version: 1, storage: createJSONStorage(() => storage) },
  ),
);
