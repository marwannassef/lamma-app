import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import Paywall from '../app/paywall';
import Settings from '../app/settings';
import Shop from '../app/shop';
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
  useEntitlements.setState({ passTier: null, devPremium: false, softShownAt: 0, owned: [] });
  usePlayers.setState({ count: 6, names: [] });
  usePunishments.setState({ level: 'mix', decks: {} });
});

describe('Shop: single packs and role cards', () => {
  it('lists packs and role cards, and explains when buying is unavailable', async () => {
    render(<Shop />);
    expect(screen.getByTestId('shop-premium')).toBeTruthy();
    expect(screen.getByTestId('shop-lamma_pack_global_sports')).toBeTruthy();
    // Free packs aren't sold.
    expect(screen.queryByTestId('shop-lamma_pack_global_food')).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('buy-lamma_pack_global_sports')));
    expect(screen.getByTestId('shop-message')).toBeTruthy();
    fireEvent.press(screen.getByTestId('shop-tab-roles'));
    expect(screen.getByTestId('shop-lamma_role_hunter')).toBeTruthy();
    expect(screen.queryByTestId('shop-lamma_role_seer')).toBeNull();
  });

  it('shows Owned for bought items and In Premium for everything with Premium', () => {
    useEntitlements.setState({ owned: ['lamma_pack_global_sports'] });
    const { unmount } = render(<Shop />);
    expect(screen.getByText(/Owned/)).toBeTruthy();
    unmount();
    useEntitlements.setState({ devPremium: true });
    render(<Shop />);
    expect(screen.queryByTestId('shop-premium')).toBeNull();
    expect(screen.getAllByText(/In Premium/).length).toBeGreaterThan(1);
  });

  it('a bought pack plays in Spy; a locked one offers itself in the paywall', () => {
    useEntitlements.setState({ owned: ['lamma_pack_global_sports'] });
    render(<SpySetup />);
    fireEvent.press(screen.getByTestId('tab-customize'));
    expect(screen.queryByLabelText(/Sports.*Premium/)).toBeNull();
    fireEvent.press(screen.getByLabelText(/Instruments.*Premium/));
    expect(pushed().at(-1)).toMatchObject({
      params: { trigger: 'locked', item: 'lamma_pack_global_instruments' },
    });
  });

  it('Werewolf: owning the role cards of a setup unlocks it and opens Custom', () => {
    usePlayers.setState({ count: 8, names: [] });
    useEntitlements.setState({ owned: ['lamma_role_witch'] });
    render(<WerewolfSetup />);
    // Classic at 8 players is Werewolf, Seer, Witch and Villagers.
    fireEvent.press(screen.getByTestId('setup-classic'));
    expect(pushed()).toHaveLength(0);
    fireEvent.press(screen.getByTestId('tab-customize'));
    fireEvent.press(screen.getByTestId('setup-custom'));
    expect(screen.getByTestId('custom-witch-plus')).toBeTruthy();
    fireEvent.press(screen.getByTestId('custom-hunter-locked'));
    expect(pushed().at(-1)).toMatchObject({ params: { item: 'lamma_role_hunter' } });
  });

  it('the paywall offers to buy just the locked item', () => {
    mockParams.trigger = 'locked';
    mockParams.item = 'lamma_role_cupid';
    render(<Paywall />);
    expect(screen.getByTestId('paywall-item')).toBeTruthy();
    expect(screen.getByText('Cupid')).toBeTruthy();
    delete mockParams.item;
  });
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
    fireEvent.press(screen.getByTestId('tab-customize'));
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
    expect(pushed().at(-1)).toMatchObject({ params: { trigger: 'cap', max: '20' } });
  });

  it('Blend In: Undercover is locked', () => {
    render(<BlendInSetup />);
    fireEvent.press(screen.getByTestId('tab-customize'));
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
    fireEvent.press(screen.getByTestId('tab-customize'));
    fireEvent.press(screen.getByTestId('cat-global-cheeky'));
    expect(screen.getByTestId('teen-confirm')).toBeTruthy();
    fireEvent.press(screen.getByTestId('teen-confirm-yes'));
    expect(useAge.getState().teenConfirmed).toBe(true);
  });

  it('removes Teen packs everywhere in Kids mode', () => {
    useAge.setState({ audience: 'kids', pin: '1234' });
    useEntitlements.setState({ devPremium: true });
    render(<SpySetup />);
    fireEvent.press(screen.getByTestId('tab-customize'));
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
    expect(screen.getByText(/Purchases aren't available right now\./)).toBeTruthy();
    expect(screen.getByText(/Details: no RevenueCat key in this build/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('product-partyPass'));
    expect(screen.getByText(/Continue · \$2\.99/)).toBeTruthy();
  });
});

describe('first launch and Settings', () => {
  // The 4th digit submits by itself (on iOS the number pad covers the Continue button).
  const enterPin = (pin: string) => fireEvent.changeText(screen.getByTestId('pin'), pin);

  it('first launch sets the parent PIN, then Kids needs nothing more', () => {
    useAge.setState({ audience: null, pin: null });
    render(<Welcome />);
    expect(screen.queryByTestId('audience-kids')).toBeNull();
    enterPin('2468');
    enterPin('1357'); // mismatch: start again
    expect(screen.getByText("The PINs don't match. Try again.")).toBeTruthy();
    enterPin('2468');
    enterPin('2468');
    fireEvent.press(screen.getByTestId('audience-kids'));
    expect(useAge.getState()).toMatchObject({ audience: 'kids', pin: '2468' });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('choosing Teens and adults on first launch asks for the PIN', () => {
    useAge.setState({ audience: null, pin: null });
    render(<Welcome />);
    enterPin('2468');
    enterPin('2468');
    fireEvent.press(screen.getByTestId('audience-teen'));
    enterPin('1111');
    expect(screen.getByText('Wrong PIN. Try again.')).toBeTruthy();
    expect(useAge.getState().audience).toBeNull();
    fireEvent.press(screen.getByTestId('pin-cancel'));
    fireEvent.press(screen.getByTestId('audience-teen'));
    enterPin('2468');
    expect(useAge.getState().audience).toBe('teen');
  });

  it('asks an install without a PIN to set one, keeping its choice', () => {
    useAge.setState({ audience: 'teen', pin: null });
    render(<Welcome />);
    enterPin('9876');
    enterPin('9876');
    expect(useAge.getState()).toMatchObject({ audience: 'teen', pin: '9876' });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('keeps Teen locked when the device says the user is under 13', () => {
    useAge.setState({ audience: null, pin: '2468', signal: 'under13' });
    render(<Welcome />);
    fireEvent.press(screen.getByTestId('audience-teen'));
    expect(screen.getByTestId('welcome-error')).toBeTruthy();
    useAge.setState({ signal: 'unknown' });
  });

  it('Settings without a PIN sets one before switching to Teen', () => {
    useAge.setState({ audience: 'kids', pin: null });
    render(<Settings />);
    fireEvent.press(screen.getByTestId('audience-teen'));
    const enter = () => fireEvent.changeText(screen.getByTestId('settings-pin'), '4321');
    enter(); // set
    enter(); // confirm
    expect(useAge.getState()).toMatchObject({ audience: 'teen', pin: '4321' });
  });

  it('the Continue button still works for a typed PIN', () => {
    useAge.setState({ audience: null, pin: null });
    render(<Welcome />);
    fireEvent.press(screen.getByTestId('pin-continue'));
    expect(screen.getByText('4-digit PIN')).toBeTruthy();
  });

  it('switching back to Teen in Settings needs the PIN', () => {
    useAge.setState({ audience: 'kids', pin: '2468' });
    render(<Settings />);
    fireEvent.press(screen.getByTestId('audience-teen'));
    fireEvent.changeText(screen.getByTestId('settings-pin'), '1111');
    expect(screen.getByText('Wrong PIN. Try again.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('settings-pin'), '2468');
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
