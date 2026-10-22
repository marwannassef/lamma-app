import { act, fireEvent, render, screen } from '@testing-library/react-native';

import Home from '../app/index';
import { useAge } from '../src/core/age';
import { i18n, initI18n } from '../src/core/i18n';
import { useSettings } from '../src/core/settings/store';
import { frontIndex, wheelOffset } from '../src/home/GameWheel';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    router: { push: jest.fn() },
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
  };
});

describe('Home', () => {
  beforeAll(() => {
    initI18n('en');
    useAge.setState({ audience: 'teen', pin: '1234' });
  });

  beforeEach(() => useSettings.setState({ homeView: 'list' }));

  it('renders in English', async () => {
    await i18n.changeLanguage('en');
    render(<Home />);
    expect(screen.getByText('Lamma')).toBeTruthy();
    expect(screen.getByText('Spy')).toBeTruthy();
    expect(screen.getAllByText(/3–12 players/)).toHaveLength(2); // Spy and Blend In
    expect(screen.getByText('Werewolf')).toBeTruthy();
    expect(screen.getByText('Blend In')).toBeTruthy();
    // The mystery teaser is hidden for now.
    expect(screen.queryByText('Mystery game')).toBeNull();
    expect(screen.getByText('Mafia')).toBeTruthy();
    expect(screen.getAllByText(/4–20 players/)).toHaveLength(2); // Werewolf and Mafia
  });

  it('offers one "Join a game" for every game played on everyone\'s phone', () => {
    const { router } = jest.requireMock('expo-router') as { router: { push: jest.Mock } };
    render(<Home />);
    fireEvent.press(screen.getByTestId('join-game'));
    expect(router.push).toHaveBeenCalledWith('/join');
  });

  it('sends installs without a PIN to the welcome screen first', () => {
    useAge.setState({ audience: 'teen', pin: null });
    render(<Home />);
    expect(screen.getByText('redirect:/welcome')).toBeTruthy();
    useAge.setState({ pin: '1234' });
  });

  it('renders in Arabic', async () => {
    await i18n.changeLanguage('ar');
    render(<Home />);
    expect(screen.getByText('لمّة')).toBeTruthy();
    expect(screen.getByText('الجاسوس')).toBeTruthy();
    expect(screen.getByText('المستذئب')).toBeTruthy();
  });

  it('searches games in the list view', async () => {
    await i18n.changeLanguage('en');
    render(<Home />);
    fireEvent.changeText(screen.getByTestId('game-search'), 'wolf');
    expect(screen.getByText('Werewolf')).toBeTruthy();
    expect(screen.queryByText('Spy')).toBeNull();
    fireEvent.changeText(screen.getByTestId('game-search'), 'zzz');
    expect(screen.getByTestId('no-games')).toBeTruthy();
    fireEvent.press(screen.getByTestId('game-search-clear'));
    expect(screen.getByText('Spy')).toBeTruthy();
  });

  it('shows the 3D wheel, flips a card to How to play, and switches views', async () => {
    await i18n.changeLanguage('en');
    useSettings.setState({ homeView: 'wheel' });
    render(<Home />);
    expect(screen.getByTestId('game-wheel')).toBeTruthy();
    expect(screen.getByText(/except one sneaky spy/)).toBeTruthy();
    expect(screen.getByTestId('wheel-cheer')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('info-spy')));
    expect(screen.getByText(/Choose how many players and spies/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('view-list'));
    expect(useSettings.getState().homeView).toBe('list');
    expect(screen.getByTestId('game-search')).toBeTruthy();
  });

  it('loops the wheel: offsets wrap around and the front card follows', () => {
    expect(wheelOffset(0, 0, 5)).toBe(0);
    expect(wheelOffset(4, 0, 5)).toBe(-1);
    expect(wheelOffset(1, 4, 5)).toBe(2);
    expect(frontIndex(-1, 5)).toBe(4);
    expect(frontIndex(7, 5)).toBe(2);
  });
});
