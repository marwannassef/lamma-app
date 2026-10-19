// MMKV switches to an in-memory mock automatically under Jest (JEST_WORKER_ID).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US', regionCode: 'US' }],
  getCalendars: () => [{ timeZone: 'America/New_York' }],
}));

// MMKV's index imports Nitro at load time even though it uses the mock under Jest.
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: { createHybridObject: jest.fn(), getHybridObjectConstructor: jest.fn() },
}));

// require.context is Metro-only; these modules each wrap one call to it.
jest.mock('@/core/i18n/localeFiles', () => ({
  localeFiles: require('./test/fsContext').fsContext(
    'locales',
    true,
    /^\.\/[A-Za-z-]+\/[A-Za-z]+\.json$/,
  ),
}));
jest.mock('@/core/content/packFiles', () => ({
  packFiles: require('./test/fsContext').fsContext('content/packs', false, /\.json$/),
}));
jest.mock('@/core/punishments/punishmentFiles', () => ({
  punishmentFiles: require('./test/fsContext').fsContext('content/punishments', false, /\.json$/),
}));

// Reanimated 4 runs on worklets, which need their JS mock under Jest.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
require('react-native-reanimated').setUpTests();

// Screens navigate imperatively; tests assert on these calls.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
  useLocalSearchParams: () => ({}),
}));

// Screens read safe-area insets; give them fixed values in tests.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Native audio and text-to-speech; tests assert on these calls.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    setPlaybackRate: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    playing: false,
    volume: 1,
    loop: false,
  })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(() => Promise.resolve()) }));

// Gesture handler's native module is not available under Jest.
require('react-native-gesture-handler/jestSetup');
