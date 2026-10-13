import { i18n, initI18n, isRTL, localeMeta, resolveLanguage, supportedLanguages } from '.';

describe('i18n', () => {
  it('discovers every locale folder', () => {
    expect(supportedLanguages).toEqual(['ar', 'en']);
    expect(localeMeta.ar?.dir).toBe('rtl');
  });

  it('resolves the language preference', () => {
    expect(resolveLanguage('ar')).toBe('ar');
    expect(resolveLanguage('system')).toBe('en'); // mocked device locale
    expect(resolveLanguage('xx')).toBe('en');
  });

  it('knows which languages are RTL', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('en')).toBe(false);
  });

  it('uses CLDR plural forms for Arabic', async () => {
    initI18n('en');
    await i18n.changeLanguage('ar');
    expect(i18n.t('players.count', { count: 2 })).toBe('لاعبين اتنين');
    expect(i18n.t('players.count', { count: 5 })).toBe('5 لاعبين');
    expect(i18n.t('players.count', { count: 11 })).toBe('11 لاعب');
    await i18n.changeLanguage('en');
    expect(i18n.t('players.count', { count: 1 })).toBe('1 player');
  });
});
