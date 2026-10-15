import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { allPacks, filterPacks } from '../src/core/content';
import { i18n, initI18n } from '../src/core/i18n';
import { usePlayers } from '../src/core/players';
import { usePunishments } from '../src/core/punishments';
import { useSession } from '../src/core/session';
import { storage } from '../src/core/storage';
import Play from '../src/games/spy/screens/Play';
import Setup from '../src/games/spy/screens/Setup';
import { useSpy } from '../src/games/spy/store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
  },
  Redirect: () => null,
}));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));

beforeAll(() => initI18n('en'));
beforeEach(() => {
  storage.clear();
  useSession.getState().reset();
  usePlayers.setState({ count: 3, names: ['Ana', '', 'Omar'] });
  useSpy.setState({ round: null, spies: 1, choice: 'random', lastPackId: null, usedByPack: {} });
  usePunishments.setState({ level: 'light', decks: {} });
  mockPush.mockClear();
});

describe('Spy', () => {
  it('setup starts round 1', () => {
    render(<Setup />);
    expect(screen.getByText('Start round 1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('start'));
    expect(mockPush).toHaveBeenCalledWith('/games/spy/play');
    expect(useSpy.getState().round?.no).toBe(1);
    expect(useSession.getState().round).toBe(2);
  });

  it('plays a full round: pass, cards, reveal, score, punish', () => {
    const packs = filterPacks(allPacks, { game: 'spy', regions: ['global'], adult: false });
    act(() => useSpy.getState().start({ players: 3, spies: 1, packs, no: 1 }));
    const round = useSpy.getState().round!;
    render(<Play />);
    for (let p = 0; p < 3; p++) {
      fireEvent.press(screen.getByTestId('show-card'));
      expect(screen.getByTestId(round.spies.includes(p) ? 'card-spy' : 'card-word')).toBeTruthy();
      fireEvent.press(screen.getByTestId('hide-card'));
    }
    expect(screen.getByText('Round 1 started!')).toBeTruthy();
    fireEvent.press(screen.getByTestId('reveal'));
    fireEvent.press(screen.getByTestId('add-points'));
    expect(screen.getByText('Answer the questions above first 👆')).toBeTruthy();
    fireEvent.press(screen.getByTestId('caught-0-yes'));
    fireEvent.press(screen.getByTestId('guessed-0-no'));
    fireEvent.press(screen.getByTestId('add-points'));
    expect(screen.getByTestId('result-title')).toHaveTextContent('Players win! 🎉');
    const expected = [0, 1, 2].map((p) => (round.spies.includes(p) ? 0 : 1));
    expect(useSession.getState().scores).toEqual(expected);
    fireEvent.press(screen.getByTestId('draw-punishment'));
    expect(screen.getAllByTestId('punishment-text')).toHaveLength(1);
  });

  it('renders setup in Arabic', async () => {
    await i18n.changeLanguage('ar');
    render(<Setup />);
    expect(screen.getByText('ابدأ الجولة 1')).toBeTruthy();
    await act(() => i18n.changeLanguage('en'));
  });
});
