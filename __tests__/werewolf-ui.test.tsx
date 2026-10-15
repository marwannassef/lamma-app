import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n, initI18n } from '../src/core/i18n';
import { usePlayers } from '../src/core/players';
import { storage } from '../src/core/storage';
import { ThemeProvider } from '../src/core/theme';
import { newGame, type GameState } from '../src/games/werewolf/engine';
import Play from '../src/games/werewolf/screens/Play';
import Setup from '../src/games/werewolf/screens/Setup';
import { useWerewolf } from '../src/games/werewolf/store';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(async () => 1),
  setBrightnessAsync: jest.fn(async () => undefined),
  restoreSystemBrightnessAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
  Stack: { Screen: () => null },
}));

beforeAll(() => initI18n('en'));
beforeEach(() => {
  storage.clear();
  usePlayers.setState({ count: 6, names: [] });
  useWerewolf.setState({ game: null, scored: false, recentTiers: [], lastTierByCount: {} });
});

const base = () => newGame(['werewolf', 'seer', 'doctor', 'villager', 'villager', 'hunter']);
const report = {
  deaths: [{ playerId: 3, cause: 'wolves' as const }],
  saves: [],
  conversions: [],
  witchHealConsumed: false,
  witchPoisonConsumed: false,
  pending: {},
  nextNight: { wolfKills: 1 as const },
};

const PHASES: [string, Partial<GameState>][] = [
  ['discovery', {}],
  ['nightIntro', { night: 1, phase: { t: 'nightIntro', night: 1 } }],
  ['glance', { night: 1, phase: { t: 'glance', endsAt: Date.now() + 10_000 } }],
  [
    'pass handoff',
    { night: 1, phase: { t: 'pass', seat: 0, step: 'handoff', startedAt: 0, turn: 0 } },
  ],
  [
    'pass action',
    { night: 1, phase: { t: 'pass', seat: 1, step: 'action', startedAt: Date.now(), turn: 1 } },
  ],
  ['morning', { night: 1, day: 1, phase: { t: 'morning', report } }],
  [
    'hunter',
    { day: 1, phase: { t: 'deathEffects', queue: [{ t: 'hunterShot', hunter: 5 }], then: 'day' } },
  ],
  ['mayorElection', { day: 1, phase: { t: 'mayorElection' } }],
  [
    'discussion',
    { day: 1, phase: { t: 'discussion', endsAt: Date.now() + 60_000, pausedLeft: null } },
  ],
  ['vote', { day: 1, phase: { t: 'vote' } }],
  ['mayorTieBreak', { day: 1, mayor: 2, phase: { t: 'mayorTieBreak', tied: [0, 1] } }],
  ['execution', { day: 1, phase: { t: 'execution', playerId: 0, effects: [] } }],
  [
    'gameOver',
    {
      phase: {
        t: 'gameOver',
        result: { outcome: 'village', winners: [1, 2, 3, 4, 5], soloWinners: [] },
      },
    },
  ],
];

describe('Werewolf screens', () => {
  it.each(PHASES)('%s renders', (_name, patch) => {
    useWerewolf.setState({ game: { ...base(), ...patch } as GameState });
    render(<Play />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('game over adds points to the scoreboard once', () => {
    useWerewolf.setState({ game: { ...base(), ...PHASES.at(-1)?.[1] } as GameState });
    const { rerender } = render(<Play />);
    rerender(<Play />);
    expect(useWerewolf.getState().scored).toBe(true);
    expect(screen.getByText('The village wins! 🏡')).toBeTruthy();
  });

  it('setup offers Basic and starts a game', () => {
    render(
      <ThemeProvider>
        <Setup />
      </ThemeProvider>,
    );
    expect(screen.getAllByText(/Basic/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('start-game'));
    expect(useWerewolf.getState().game?.players).toHaveLength(6);
    expect(router.push).toHaveBeenCalledWith('/games/werewolf/play');
  });

  it('custom setup explains why it cannot start', () => {
    render(<Setup />);
    fireEvent.press(screen.getByTestId('setup-custom'));
    fireEvent.press(screen.getByTestId('custom-werewolf-minus'));
    fireEvent.press(screen.getByTestId('start-game'));
    expect(screen.getByText('Add at least one werewolf.')).toBeTruthy();
    expect(useWerewolf.getState().game).toBeNull();
  });

  it('renders in Arabic', async () => {
    await act(() => i18n.changeLanguage('ar'));
    useWerewolf.setState({ game: { ...base(), ...PHASES[5]?.[1] } as GameState });
    render(<Play />);
    expect(screen.getByText('الصبح')).toBeTruthy();
    await act(() => i18n.changeLanguage('en'));
  });
});
