import { int, mathRng, pick, seededRng, shuffle } from '.';

describe('rng', () => {
  it('seeded rng is deterministic and in [0, 1)', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const xs = Array.from({ length: 100 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b.next()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('int, pick and shuffle', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 50; i++) expect(int(rng, 3)).toBeLessThan(3);
    expect(['a', 'b']).toContain(pick(rng, ['a', 'b']));
    expect(() => pick(rng, [])).toThrow();
    const items = [1, 2, 3, 4, 5, 6];
    const out = shuffle(rng, items);
    expect(out).not.toBe(items);
    expect([...out].sort()).toEqual(items);
  });

  it('mathRng works', () => {
    expect(mathRng.next()).toBeLessThan(1);
  });
});
