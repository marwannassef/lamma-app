import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ContentLevel } from '@/core/content';
import { mathRng, type Rng } from '@/core/rng';
import { storage } from '@/core/storage';

import {
  deal,
  REAL_LEVELS,
  swap,
  type DeckPool,
  type Decks,
  type PunishmentCard,
  type PunishmentLevel,
  type RealLevel,
} from './engine';
import levelsFile from '../../../content/punishment-levels.json';
import { punishmentFiles } from './punishmentFiles';

export * from './engine';

type PunishmentText = Record<RealLevel, string[]>;

const texts: Record<string, PunishmentText> = Object.fromEntries(
  punishmentFiles.keys().map((k) => [k.replace(/^\.\/|\.json$/g, ''), punishmentFiles(k)]),
);

const teenItems = (levelsFile as { teen: Partial<Record<RealLevel, number[]>> }).teen;

/** Items allowed at a content level. Every locale has the same items (content:check enforces it). */
export function poolFor(content: ContentLevel): DeckPool {
  return Object.fromEntries(
    REAL_LEVELS.map((l) => {
      const all = Array.from({ length: texts.en?.[l].length ?? 0 }, (_, i) => i);
      return [l, content === 'teen' ? all : all.filter((i) => !teenItems[l]?.includes(i))];
    }),
  ) as unknown as DeckPool;
}

export function punishmentText(lang: string, level: RealLevel, index: number): string {
  return (texts[lang] ?? texts.en)?.[level][index] ?? '';
}

interface PunishmentState {
  level: PunishmentLevel;
  decks: Decks;
  setLevel(level: PunishmentLevel): void;
  /** Deals cards for the losers; returns [] when punishments are off or nobody lost. */
  deal(losers: readonly number[], content: ContentLevel, rng?: Rng): PunishmentCard[];
  swap(card: PunishmentCard, content: ContentLevel, rng?: Rng): PunishmentCard;
}

export const usePunishments = create<PunishmentState>()(
  persist(
    (set, get) => ({
      level: 'mix',
      decks: {},
      setLevel: (level) => set({ level }),
      deal: (losers, content, rng = mathRng) => {
        const { level, decks } = get();
        if (level === 'off' || losers.length === 0) return [];
        const r = deal(losers, level, decks, poolFor(content), rng);
        set({ decks: r.decks });
        return r.cards;
      },
      swap: (card, content, rng = mathRng) => {
        const { level, decks } = get();
        if (level === 'off') return card;
        const r = swap(card, level, decks, poolFor(content), rng);
        set({ decks: r.decks });
        return r.card;
      },
    }),
    { name: 'punishments', version: 1, storage: createJSONStorage(() => storage) },
  ),
);
