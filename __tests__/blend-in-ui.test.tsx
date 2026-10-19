import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { allPacks, filterPacks } from '../src/core/content';
import { i18n, initI18n } from '../src/core/i18n';
import { usePlayers } from '../src/core/players';
import { useSession } from '../src/core/session';
import { storage } from '../src/core/storage';
import {
  DEFAULT_SETTINGS,
  newGame,
  type BlendInState,
  type Phase,
} from '../src/games/blendIn/logic';
import Play from '../src/games/blendIn/screens/Play';
import Setup from '../src/games/blendIn/screens/Setup';
import { useBlendIn } from '../src/games/blendIn/store';
import { seededRng } from '../src/core/rng';

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

const packs = filterPacks(allPacks, { game: 'spy', regions: ['global'], adult: false });
const memory = { usedByPack: {}, lastPackId: null, lastChameleon: null };
const base = (): BlendInState => newGame(5, DEFAULT_SETTINGS, packs, memory, seededRng(3));
const with_ = (phase: Phase): BlendInState => ({ ...base(), phase });

beforeAll(() => initI18n('en'));
beforeEach(() => {
  storage.clear();
  useSession.getState().reset();
  usePlayers.setState({ count: 5, names: [] });
  useBlendIn.setState({ game: null, settings: DEFAULT_SETTINGS });
});

const PHASES: [string, Phase][] = [
  ['peek', { t: 'peek', seat: 0 }],
  ['circle', { t: 'circle', clueRound: 1, turn: 0 }],
  ['discuss', { t: 'discuss' }],
  ['vote', { t: 'vote', among: null }],
  ['revote', { t: 'vote', among: [0, 1] }],
  ['escape', { t: 'escape', choices: base().round.grid.slice(0, 8) }],
  ['result', { t: 'result', outcome: 'caught', accused: 1, guess: null, gain: [1, 1, 1, 0, 1] }],
  ['over', { t: 'over', winners: [0, 2] }],
];

describe('Blend In screens', () => {
  it.each(PHASES)('%s renders', (_n, phase) => {
    useBlendIn.setState({ game: with_(phase) });
    render(<Play />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('setup starts a game', () => {
    render(<Setup />);
    fireEvent.press(screen.getByTestId('start'));
    expect(useBlendIn.getState().game?.players).toBe(5);
    expect(router.push).toHaveBeenCalledWith('/games/blend-in/play');
  });

  it('the clue circle advances and a broken rule ends the round with points', () => {
    useBlendIn.setState({ game: with_({ t: 'circle', clueRound: 1, turn: 0 }) });
    render(<Play />);
    fireEvent.press(screen.getByTestId('next-clue'));
    expect(useBlendIn.getState().game?.phase).toEqual({ t: 'circle', clueRound: 1, turn: 1 });
    fireEvent.press(screen.getByTestId('rule-broken'));
    expect(useBlendIn.getState().game?.phase.t).toBe('result');
    const cham = useBlendIn.getState().game?.round.chameleon ?? 0;
    expect(useSession.getState().scores[cham]).toBe(1);
  });

  it('accusing waits for the Undo window', () => {
    jest.useFakeTimers();
    useBlendIn.setState({ game: with_({ t: 'vote', among: null }) });
    render(<Play />);
    for (let i = 0; i < 3; i++) act(() => jest.advanceTimersByTime(1000)); // 3-2-1 countdown
    fireEvent.press(screen.getByTestId('pick-2'));
    fireEvent.press(screen.getByTestId('accuse'));
    fireEvent.press(screen.getByTestId('undo'));
    expect(useBlendIn.getState().game?.phase.t).toBe('vote');
    fireEvent.press(screen.getByTestId('accuse'));
    for (let i = 0; i < 4; i++) act(() => jest.advanceTimersByTime(1000));
    expect(useBlendIn.getState().game?.phase.t).not.toBe('vote');
    jest.useRealTimers();
  });

  it('renders the grid in Arabic', async () => {
    await act(() => i18n.changeLanguage('ar'));
    useBlendIn.setState({ game: with_({ t: 'circle', clueRound: 1, turn: 0 }) });
    render(<Play />);
    expect(screen.getByText('اللي بعده')).toBeTruthy();
    await act(() => i18n.changeLanguage('en'));
  });
});
