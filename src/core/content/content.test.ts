import { allPacks, allRegions, defaultRegions, filterPacks, localized, wordLines } from '.';

const pack = (id: string) => {
  const p = allPacks.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('content', () => {
  it('bundles Global and Egypt packs, every one with a level and tier, none adult', () => {
    expect(allRegions).toEqual(['global', 'eg']);
    expect(allPacks.some((p) => p.id === 'egypt-food')).toBe(true);
    expect(allPacks.some((p) => p.id === 'global-food')).toBe(true);
    for (const p of allPacks) {
      expect(['kids', 'teen']).toContain(p.level);
      expect(['free', 'premium']).toContain(p.tier);
    }
    expect(allPacks.filter((p) => p.level === 'teen').map((p) => p.id)).toEqual([
      'egypt-cheeky',
      'global-cheeky',
    ]);
    const words = allPacks.flatMap((p) => p.words.map((w) => w.text.en?.toLowerCase()));
    for (const banned of ['wedding night', 'condom', 'nightgown'])
      expect(words).not.toContain(banned);
  });

  it('defaults regions from the device region', () => {
    expect(defaultRegions('EG')).toEqual(['global', 'eg']);
    expect(defaultRegions('US')).toEqual(['global']);
    expect(defaultRegions(undefined)).toEqual(['global']);
    expect(defaultRegions()).toEqual(['global']); // mocked device: US
  });

  it('filters by game, region and content level', () => {
    const fake = [
      { ...pack('global-food') },
      { ...pack('egypt-food') },
      { ...pack('egypt-home'), id: 'x-teen', level: 'teen' as const },
      { ...pack('global-home'), game: 'taboo' },
    ];
    const ids = (r: string[], teen: boolean) =>
      filterPacks(fake, { game: 'spy', regions: r, level: teen ? 'teen' : 'kids' }).map(
        (p) => p.id,
      );
    expect(ids(['global'], false)).toEqual(['global-food']);
    expect(ids(['global', 'eg'], false)).toEqual(['global-food', 'egypt-food']);
    expect(ids(['eg'], true)).toEqual(['egypt-food', 'x-teen']);
  });

  it('removes Teen words (and their pairs) from Kids packs in Kids mode', () => {
    const base = pack('global-food');
    const mixed = {
      ...base,
      words: base.words.map((w, i) => (i === 0 ? { ...w, level: 'teen' as const } : w)),
    };
    const first = base.words[0]?.id as string;
    const [kids] = filterPacks([mixed], { game: 'spy', regions: ['global'], level: 'kids' });
    expect(kids?.words.some((w) => w.id === first)).toBe(false);
    expect(kids?.pairs?.some((p) => p.includes(first))).toBe(false);
    const [teen] = filterPacks([mixed], { game: 'spy', regions: ['global'], level: 'teen' });
    expect(teen).toBe(mixed);
  });

  it('lays out card lines per pack display rules', () => {
    const eg = pack('egypt-food');
    const koshari = eg.words.find((w) => w.id === 'koshari');
    expect(wordLines(eg, koshari!, 'ar')).toEqual(['Koshari', 'koshary', 'كشري']);
    const gl = pack('global-food');
    const pizza = gl.words.find((w) => w.id === 'pizza')!;
    expect(wordLines(gl, pizza, 'en')).toEqual(['Pizza', 'بيتزا']);
    expect(wordLines(gl, pizza, 'ar')).toEqual(['بيتزا', 'Pizza']);
    expect(wordLines(gl, pizza, 'fr')).toEqual(['Pizza', 'بيتزا']);
    const bare = { ...gl, display: { primary: 'fr' } };
    expect(wordLines(bare, pizza, 'ar')).toEqual(['بيتزا']);
  });

  it('localizes with fallbacks', () => {
    expect(localized({ en: 'A', ar: 'ب' }, 'ar')).toBe('ب');
    expect(localized({ en: 'A' }, 'ar')).toBe('A');
    expect(localized({ fr: 'F' }, 'ar')).toBe('F');
    expect(localized({}, 'ar')).toBe('');
  });
});
