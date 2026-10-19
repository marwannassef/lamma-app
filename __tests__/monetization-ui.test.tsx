import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import Paywall from '../app/paywall';
import Settings from '../app/settings';
import Welcome from '../app/welcome';
import { useAge } from '../src/core/age';
import { useEntitlements } from '../src/core/entitlements';
import { i18n, initI18n } from '../src/core/i18n';
import { usePlayers } from '../src/core/players';
import { usePunishments } from '../src/core/punishments';
import { storage } from '../src/core/storage';
import BlendInSetup from '../src/games/blendIn/screens/Setup';
import SpySetup from '../src/games/spy/screens/Setup';
import WerewolfSetup from '../src/games/werewolf/screens/Setup';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));

const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockParams,
}));

const pushed = () => (router.push as jest.Mock).mock.calls.map((c) => c[0]);

beforeAll(() => initI18n('en'));
beforeEach(() => {
  storage.clear();
  (router.push as jest.Mock).mockClear();
  useAge.setState({ audience: 'teen', pin: null, signal: 'unknown', teenConfirmed: false });
  useEntitlements.setState({ passTier: null, devPremium: false, softShownAt: 0 });
  usePlayers.setState({ count: 6, names: [] });
  usePunishments.setState({ level: 'mix', decks: {} });
});

describe('free tier caps (monetization §3)', () => {
  it('Spy: the 7th player opens the paywall, locked packs stay visible', () => {
    render(<SpySetup />);
    fireEvent.press(screen.getByTestId('players-plus'));
    expect(pushed()).toContainEqual({
      pathname: '/paywall',
      params: { trigger: 'cap', game: 'spy', max: '12' },
    });
    expect(usePlayers.getState().count).toBe(6);
    expect(screen.getByLabelText(/Sports.*Premium/)).toBeTruthy();
    // Free users play Light punishments only.
    expect(usePunishments.getState().level).toBe('light');
  });

  it('Werewolf: Classic is locked, Basic plays, 9 players opens the paywall', () => {
    usePlayers.setState({ count: 8, names: [] });
    render(<WerewolfSetup />);
    fireEvent.press(screen.getByTestId('setup-classic'));
    expect(pushed().at(-1)).toMatchObject({ params: { trigger: 'locked' } });
    fireEvent.press(screen.getByTestId('players-plus'));
    expect(pushed().at(-1)).toMatchObject({ params: { trigger: 'cap', max: '16' } });
  });

  it('Blend In: Undercover is locked', () => {
    render(<BlendInSetup />);
    fireEvent.press(screen.getByTestId('mode-undercover'));
    expect(pushed().at(-1)).toMatchObject({ params: { trigger: 'locked', game: 'blendIn' } });
  });

  it('Premium (dev preview) lifts the caps', () => {
    useEntitlements.setState({ devPremium: true });
    render(<SpySetup />);
    fireEvent.press(screen.getByTestId('players-plus'));
    expect(usePlayers.getState().count).toBe(7);
    expect(pushed()).toEqual([]);
  });
});

describe('Kids mode', () => {
  it('hides Teen packs and asks once per session before a Teen pack', () => {
    useEntitlements.setState({ devPremium: true });
    render(<SpySetup />);
    fireEvent.press(screen.getByTestId('cat-global-cheeky'));
    expect(screen.getByTestId('teen-confirm')).toBeTruthy();
    fireEvent.press(screen.getByTestId('teen-confirm-yes'));
    expect(useAge.getState().teenConfirmed).toBe(true);
  });

  it('removes Teen packs everywhere in Kids mode', () => {
    useAge.setState({ audience: 'kids', pin: '1234' });
    useEntitlements.setState({ devPremium: true });
    render(<SpySetup />);
    expect(screen.queryByTestId('cat-global-cheeky')).toBeNull();
  });
});

describe('paywall (monetization §4)', () => {
  it('shows the trigger headline, Lifetime preselected, and explains unavailable purchases', async () => {
    Object.assign(mockParams, { trigger: 'cap', max: '12' });
    render(<Paywall />);
    expect(screen.getByText('Your group is big! 🎉 Unlock up to 12 players.')).toBeTruthy();
    expect(screen.getByTestId('product-lifetime').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByText('Best value')).toBeTruthy();
    expect(screen.getByTestId('paywall-rewarded')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('paywall-buy')));
    expect(screen.getByText("Purchases aren't available in this build yet.")).toBeTruthy();
    fireEvent.press(screen.getByTestId('product-partyPass'));
    expect(screen.getByText(/Continue · \$2\.99/)).toBeTruthy();
  });
});

describe('first launch and Settings', () => {
  it('Kids on first launch sets a PIN', () => {
    useAge.setState({ audience: null });
    render(<Welcome />);
    fireEvent.press(screen.getByTestId('audience-kids'));
    fireEvent.changeText(screen.getByTestId('pin'), '2468');
    fireEvent.press(screen.getByTestId('pin-continue'));
    fireEvent.changeText(screen.getByTestId('pin'), '2468');
    fireEvent.press(screen.getByTestId('pin-continue'));
    expect(useAge.getState()).toMatchObject({ audience: 'kids', pin: '2468' });
  });

  it('switching back to Teen in Settings needs the PIN', () => {
    useAge.setState({ audience: 'kids', pin: '2468' });
    render(<Settings />);
    fireEvent.press(screen.getByTestId('audience-teen'));
    fireEvent.changeText(screen.getByTestId('settings-pin'), '1111');
    fireEvent.press(screen.getByTestId('settings-pin-ok'));
    expect(screen.getByText('Wrong PIN. Try again.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('settings-pin'), '2468');
    fireEvent.press(screen.getByTestId('settings-pin-ok'));
    expect(useAge.getState().audience).toBe('teen');
  });

  it('reads in Arabic', async () => {
    await act(() => i18n.changeLanguage('ar'));
    Object.assign(mockParams, { trigger: 'settings' });
    render(<Paywall />);
    expect(screen.getByText('لمّة بريميوم')).toBeTruthy();
    await act(() => i18n.changeLanguage('en'));
  });
});
