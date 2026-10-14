// MMKV switches to an in-memory mock automatically under Jest (JEST_WORKER_ID).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US', regionCode: 'US' }],
}));

// MMKV's index imports Nitro at load time even though it uses the mock under Jest.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: jest.fn(), getHybridObjectConstructor: jest.fn() },
}));

jest.mock('@/core/i18n/localeFiles', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const root = path.join(__dirname, 'locales');
  const keys = fs
    .readdirSync(root)
    .flatMap((code) => fs.readdirSync(path.join(root, code)).map((f) => `./${code}/${f}`))
    .filter((k) => k.endsWith('.json'));
  const ctx = (key: string) => JSON.parse(fs.readFileSync(path.join(root, key), 'utf8'));
  ctx.keys = () => keys;
  return { localeFiles: ctx };
});
