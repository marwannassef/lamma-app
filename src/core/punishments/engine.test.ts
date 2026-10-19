import { seededRng } from '@/core/rng';

import { deal, draw, losersOf, punishmentTargets, REAL_LEVELS, swap, type Decks } from './engine';
import { poolFor, punishmentText, usePunishments } from '.';

const five = [0, 1, 2, 3, 4];
const sizes = { light: five, medium: five, hard: five, public: five };

describe('punishment engine', () => {
  it('does not repeat until the deck runs out, then reshuffles', () => {
    const rng = seededRng(7);
    let decks: Decks = {};
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = draw('light', decks, sizes, rng);
      decks = r.decks;
      seen.push(r.draw.index);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(decks.light).toEqual([]);
    const again = draw('light', decks, sizes, rng);
    expect(again.decks.light).toHaveLength(4);
  });

  it('mix draws from real levels', () => {
    const rng = seededRng(3);
    const levels = new Set<string>();
    let decks: Decks = {};
    for (let i = 0; i < 40; i++) {
      const r = draw('mix', decks, sizes, rng);
      decks = r.decks;
      levels.add(r.draw.level);
    }
    expect([...levels].sort()).toEqual([...REAL_LEVELS].sort());
  });

  it('finds the losers and groups more than 3 of them', () => {
    expect(losersOf([0, 2, 0, 1])).toEqual([0, 2]);
    expect(punishmentTargets([1, 2, 3])).toEqual([[1], [2], [3]]);
    expect(punishmentTargets([0, 1, 2, 3])).toEqual([[0, 1, 2, 3]]);
    const { cards } = deal([0, 1, 2, 3, 4], 'hard', {}, sizes, seededRng(1));
    expect(cards).toHaveLength(1);
    expect(cards[0]?.players).toEqual([0, 1, 2, 3, 4]);
  });

  it('swaps a card only once', () => {
    const rng = seededRng(9);
    const { cards, decks } = deal([2], 'light', {}, sizes, rng);
    const card = cards[0];
    if (!card) throw new Error('no card');
    const once = swap(card, 'light', decks, sizes, rng);
    expect(once.card.swapped).toBe(true);
    expect(once.card.draw.index).not.toBe(card.draw.index);
    const twice = swap(once.card, 'light', once.decks, sizes, rng);
    expect(twice.card).toBe(once.card);
    expect(twice.decks).toBe(once.decks);
  });
});

describe('punishment store and content', () => {
  it('loads 25 items per level and text per locale', () => {
    const teen = poolFor('teen');
    expect(Object.values(teen).map((l) => l.length)).toEqual([25, 25, 25, 25]);
    // Kids mode drops the Teen-tagged items (content/punishment-levels.json).
    const kids = poolFor('kids');
    expect(kids.medium).not.toContain(6);
    expect(kids.public).not.toContain(12);
    expect(kids.light).toHaveLength(25);
    expect(punishmentText('en', 'light', 0)).toMatch(/alphabet/);
    expect(punishmentText('ar', 'light', 0)).toMatch(/الحروف/);
    expect(punishmentText('xx', 'light', 0)).toBe(punishmentText('en', 'light', 0));
  });

  it('deals nothing when off or when nobody lost, and keeps decks between draws', () => {
    const s = usePunishments.getState();
    s.setLevel('off');
    expect(usePunishments.getState().deal([0], 'teen')).toEqual([]);
    const off = {
      id: 'x',
      players: [0],
      draw: { level: 'light' as const, index: 0 },
      swapped: false,
    };
    expect(usePunishments.getState().swap(off, 'teen')).toBe(off);
    s.setLevel('medium');
    expect(usePunishments.getState().deal([], 'teen')).toEqual([]);
    const [card] = usePunishments.getState().deal([1], 'teen', seededRng(2));
    expect(card?.draw.level).toBe('medium');
    expect(usePunishments.getState().decks.medium).toHaveLength(24);
    expect(usePunishments.getState().swap(card!, 'teen', seededRng(3)).swapped).toBe(true);
  });
});

describe('Kids mode punishments', () => {
  it('never deals a Teen item, even from a deck started in Teen mode', () => {
    const pool = poolFor('kids');
    let decks: Decks = { public: [12, 18, 0] };
    for (let i = 0; i < 60; i++) {
      const r = draw('public', decks, pool, seededRng(i));
      expect([12, 18]).not.toContain(r.draw.index);
      decks = r.decks;
    }
  });
});
