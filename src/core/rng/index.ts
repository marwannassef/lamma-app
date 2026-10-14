/** Source of randomness. Inject it into game logic so tests can use a seeded one. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
}

export const mathRng: Rng = { next: () => Math.random() };

/** Deterministic RNG (mulberry32) for tests and reproducible runs. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Integer in [0, n). */
export function int(rng: Rng, n: number): number {
  return Math.floor(rng.next() * n);
}

/** Random element. Throws on an empty array, which is always a caller bug. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() from an empty array');
  return items[int(rng, items.length)] as T;
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(rng, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
