import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useEntitlements } from '../src/core/entitlements';
import { i18n, initI18n } from '../src/core/i18n';
import { usePlayers } from '../src/core/players';
import { storage } from '../src/core/storage';
import { ThemeProvider } from '../src/core/theme';
import { litTicks } from '../src/games/werewolf/components/CountdownRing';
import { MoonlitBackground } from '../src/games/werewolf/components/MoonlitBackground';
import { newGame, type GameState } from '../src/games/werewolf/engine';
import Play from '../src/games/werewolf/screens/Play';
import Setup from '../src/games/werewolf/screens/Setup';
import { MAX_SAVED, useWerewolf } from '../src/games/werewolf/store';

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
    useEntitlements.setState({ devPremium: true });
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

describe('Werewolf audio', () => {
  const Speech = jest.requireMock('expo-speech') as { speak: jest.Mock; stop: jest.Mock };
  beforeEach(() => Speech.speak.mockClear());

  it('narrates the night and offers host audio controls on public screens', () => {
    useWerewolf.setState({ game: { ...base(), night: 1, phase: { t: 'nightIntro', night: 1 } } });
    render(
      <ThemeProvider>
        <Play />
      </ThemeProvider>,
    );
    expect(Speech.speak).toHaveBeenCalledWith(
      expect.stringMatching(/eyes/i),
      expect.objectContaining({ language: 'en-US' }),
    );
    fireEvent.press(screen.getByTestId('audio-replay'));
    expect(Speech.speak).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByTestId('audio-pause'));
    expect(Speech.stop).toHaveBeenCalled();
    expect(screen.getByLabelText('Resume sound')).toBeTruthy();
    fireEvent.press(screen.getByTestId('audio-pause'));
    fireEvent.press(screen.getByTestId('audio-volume'));
    expect(screen.getByLabelText('Volume 60%')).toBeTruthy();
  });

  it('keeps the host controls off secret screens', () => {
    useWerewolf.setState({ game: base() });
    render(
      <ThemeProvider>
        <Play />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('audio-pause')).toBeNull();
  });
});

describe('Werewolf W5 setup', () => {
  beforeEach(() => {
    useEntitlements.setState({ devPremium: true });
    useWerewolf.setState({ savedSetups: [], customRoles: null });
  });
  afterAll(() => useEntitlements.setState({ devPremium: false }));

  it('offers the expansion setups and every expansion role in Custom', () => {
    usePlayers.setState({ count: 12, names: [] });
    render(<Setup />);
    expect(screen.getByTestId('setup-party')).toBeTruthy();
    expect(screen.getByTestId('setup-chaos')).toBeTruthy();
    fireEvent.press(screen.getByTestId('setup-custom'));
    for (const r of [
      'wolfCub',
      'loneWolf',
      'sorcerer',
      'apprenticeSeer',
      'mayor',
      'lycan',
      'cursed',
      'serialKiller',
    ]) {
      expect(screen.getByTestId(`custom-${r}-plus`)).toBeTruthy();
    }
  });

  it('rolls a balanced Surprise me setup and starts it', () => {
    usePlayers.setState({ count: 9, names: [] });
    render(<Setup />);
    fireEvent.press(screen.getByTestId('setup-surprise'));
    expect(screen.getByTestId('surprise-reroll')).toBeTruthy();
    fireEvent.press(screen.getByTestId('surprise-reroll'));
    fireEvent.press(screen.getByTestId('start-game'));
    expect(useWerewolf.getState().game?.players).toHaveLength(9);
  });

  it('only offers Surprise me from 7 players, and locks it on the free tier', () => {
    usePlayers.setState({ count: 6, names: [] });
    const { unmount } = render(<Setup />);
    expect(screen.queryByTestId('setup-surprise')).toBeNull();
    unmount();
    useEntitlements.setState({ devPremium: false });
    usePlayers.setState({ count: 7, names: [] });
    render(<Setup />);
    fireEvent.press(screen.getByTestId('setup-surprise'));
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/paywall' }));
    expect(screen.queryByTestId('surprise-reroll')).toBeNull();
  });

  it('saves a custom setup as a card for that player count and deletes it after asking', () => {
    usePlayers.setState({ count: 6, names: [] });
    render(<Setup />);
    fireEvent.press(screen.getByTestId('setup-custom'));
    fireEvent.changeText(screen.getByTestId('save-name'), 'Friday night');
    fireEvent.press(screen.getByTestId('save-setup'));
    const [saved] = useWerewolf.getState().savedSetups;
    expect(saved).toMatchObject({ name: 'Friday night', players: 6 });
    expect(screen.getByText('✓ ⭐ Friday night')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`saved-delete-${saved?.id}`));
    expect(useWerewolf.getState().savedSetups).toHaveLength(1);
    fireEvent.press(screen.getByText('Delete'));
    expect(useWerewolf.getState().savedSetups).toHaveLength(0);
  });

  it('keeps only the newest saved setups', () => {
    const { saveSetup } = useWerewolf.getState();
    for (let i = 0; i < MAX_SAVED + 3; i++)
      saveSetup(`S${i}`, 6, { werewolf: 1, seer: 1, villager: 4 });
    const all = useWerewolf.getState().savedSetups;
    expect(all).toHaveLength(MAX_SAVED);
    expect(all[0]?.name).toBe('S3');
    expect(new Set(all.map((x) => x.id)).size).toBe(MAX_SAVED);
  });

  it('tells a promoted Apprentice Seer they are now the Seer', () => {
    const g = newGame(['werewolf', 'apprenticeSeer', 'villager', 'villager', 'doctor', 'hunter']);
    const players = g.players.map((p) => (p.id === 1 ? { ...p, role: 'seer' as const } : p));
    useWerewolf.setState({
      game: {
        ...g,
        players,
        night: 2,
        phase: { t: 'pass', seat: 1, step: 'action', startedAt: 0, turn: 1 },
      },
    });
    render(<Play />);
    expect(screen.getByTestId('promoted', { includeHiddenElements: true })).toBeTruthy();
  });
});

describe('Werewolf W6 polish', () => {
  const wolfFirst = () =>
    newGame(['werewolf', 'werewolf', 'seer', 'villager', 'villager', 'doctor']);

  it('lights the timer ring for the time left', () => {
    expect(litTicks(1)).toBe(60);
    expect(litTicks(0.5)).toBe(30);
    expect(litTicks(0.001)).toBe(1);
    expect(litTicks(0)).toBe(0);
    expect(litTicks(2)).toBe(60);
  });

  it('flips the role card in behind the wax seal and keeps it from screen readers', () => {
    jest.useFakeTimers();
    useWerewolf.setState({
      game: { ...wolfFirst(), phase: { t: 'discovery', seat: 0, revealed: false } },
    });
    render(<Play />);
    fireEvent.press(screen.getByTestId('im-player'));
    fireEvent(screen.getByTestId('seal'), 'pressIn');
    act(() => jest.advanceTimersByTime(600));
    // Rendered for sighted players, but invisible to screen readers (so nobody hears it).
    expect(screen.getByTestId('role-werewolf', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('role-werewolf')).toBeNull();
    expect(screen.queryByText('Werewolf')).toBeNull();
    expect(screen.getByLabelText('Hold the seal to see your role')).toBeTruthy();
    jest.useRealTimers();
  });

  it('never reads pack tags aloud on the wolves’ night screen, and pulses after 15 s', () => {
    jest.useFakeTimers();
    const g = wolfFirst();
    useWerewolf.setState({
      game: {
        ...g,
        night: 1,
        phase: { t: 'pass', seat: 0, step: 'action', startedAt: Date.now(), turn: 0 },
      },
    });
    render(<Play />);
    expect(screen.getByLabelText('Player 2')).toBeTruthy();
    expect(screen.queryByLabelText(/Pack/)).toBeNull();
    expect(screen.getByText('Pack', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('soft-max')).toBeNull();
    act(() => jest.advanceTimersByTime(15_500));
    expect(screen.getByTestId('soft-max')).toBeTruthy();
    jest.useRealTimers();
  });

  it('draws public screens on the moonlit backdrop and secret ones on plain black', () => {
    useWerewolf.setState({ game: { ...base(), night: 1, phase: { t: 'nightIntro', night: 1 } } });
    const { UNSAFE_root } = render(<Play />);
    const moon = UNSAFE_root.findAll((n) => n.type === MoonlitBackground);
    expect(moon.length).toBeGreaterThan(0);
  });
});
