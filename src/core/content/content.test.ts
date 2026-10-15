import { allPacks, allRegions, defaultRegions, filterPacks, localized, wordLines } from '.';

const pack = (id: string) => {
  const p = allPacks.find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe('content', () => {
  it('bundles Global and Egypt packs; adult only when the build flag is on', () => {
    expect(allRegions).toEqual(['global', 'eg']);
    expect(allPacks.some((p) => p.id === 'egypt-food')).toBe(true);
    expect(allPacks.some((p) => p.id === 'global-food')).toBe(true);
    const adult = allPacks.some((p) => p.adult);
    expect(adult).toBe(process.env.EXPO_PUBLIC_ENABLE_ADULT === 'true');
  });

  it('defaults regions from the device region', () => {
    expect(defaultRegions('EG')).toEqual(['global', 'eg']);
    expect(defaultRegions('US')).toEqual(['global']);
    expect(defaultRegions(undefined)).toEqual(['global']);
    expect(defaultRegions()).toEqual(['global']); // mocked device: US
  });

  it('filters by game, region and adult', () => {
    const fake = [
      { ...pack('global-food') },
      { ...pack('egypt-food') },
      { ...pack('egypt-home'), id: 'x-adult', adult: true },
      { ...pack('global-home'), game: 'taboo' },
    ];
    const ids = (r: string[], adult: boolean) =>
      filterPacks(fake, { game: 'spy', regions: r, adult }).map((p) => p.id);
    expect(ids(['global'], false)).toEqual(['global-food']);
    expect(ids(['global', 'eg'], false)).toEqual(['global-food', 'egypt-food']);
    expect(ids(['eg'], true)).toEqual(['egypt-food', 'x-adult']);
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
