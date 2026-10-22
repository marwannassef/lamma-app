import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import Join from '../app/join';
import { allPacks } from '../src/core/content';
import { initI18n } from '../src/core/i18n';
import { createFakeNetwork, type FakeNetwork } from '../src/core/net/fake';
import { usePlayers } from '../src/core/players';
import {
  closeRoom,
  GuestSession,
  leaveRoom,
  setRoomBrowser,
  setTransportFactory,
} from '../src/core/room';
import { useSession } from '../src/core/session';
import { useSettings } from '../src/core/settings/store';
import { storage } from '../src/core/storage';
import { openSpyRoom } from '../src/games/spy/net';
import Play from '../src/games/spy/screens/Play';
import Setup from '../src/games/spy/screens/Setup';
import { useSpy } from '../src/games/spy/store';

jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

let net: FakeNetwork;
const guests: GuestSession[] = [];
const PACK = allPacks.find((p) => p.id === 'egypt-places');

async function settle() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await Promise.resolve();
      net.flush();
    });
  }
}

function guestPhone(name: string) {
  const g = new GuestSession({
    transport: net.transport,
    address: '10.0.0.1:47777',
    deviceId: `device-${name}`,
    name,
    now: Date.now,
    schedule: () => () => undefined,
  });
  guests.push(g);
  return g;
}

/** Starts a network round on the host for the room's players, with one known pack. */
function startRound(players: number) {
  useSpy.setState({ spies: 1, choice: 'egypt-places' });
  useSpy.getState().start({
    players,
    spies: 1,
    packs: [PACK as NonNullable<typeof PACK>],
    no: useSession.getState().startRound(),
    network: true,
  });
}

beforeAll(() => initI18n('en'));
beforeEach(() => {
  storage.clear();
  net = createFakeNetwork();
  setTransportFactory(async () => net.transport);
  setRoomBrowser((onChange: (rooms: { id: string; name: string; address: string }[]) => void) => {
    onChange([{ id: 'hana', name: 'Hana', address: '10.0.0.1:47777' }]);
    return () => undefined;
  });
  usePlayers.setState({ count: 5, names: [] });
  useSettings.setState({ myName: 'Hana', deviceId: 'host-phone' });
  useSpy.setState({ round: null });
  useSession.setState({ scores: [4, 4, 4], lastGain: [], round: 1 });
  jest.mocked(router.push).mockClear();
});
afterEach(async () => {
  guests.splice(0).forEach((g) => g.leave());
  leaveRoom();
  closeRoom();
  await settle();
});

describe('Spy on everyone’s phone: the host', () => {
  it('opens a room, starts a round for who joined, with a fresh scoreboard', async () => {
    render(<Setup />);
    fireEvent.press(screen.getByTestId('phones-all'));
    expect(screen.queryByTestId('players')).toBeNull();
    fireEvent.press(screen.getByTestId('open-room'));
    await settle();
    fireEvent.press(screen.getByTestId('start'));
    expect(screen.getByText('Waiting for players: at least 3 to start.')).toBeTruthy();

    guestPhone('Omar');
    guestPhone('Lina');
    await settle();
    fireEvent.press(screen.getByTestId('start'));
    await settle();
    expect(useSpy.getState().round).toMatchObject({ network: true, players: 3, seen: [] });
    expect(useSession.getState().scores).toEqual([]); // the room's seats are new people
    expect(router.push).toHaveBeenCalledWith('/games/spy/play');
    expect(guests[0]?.getSnapshot()).toMatchObject({ status: 'playing', game: 'spy', seat: 1 });
  });

  it('shows only its own card, then counts who has seen theirs', async () => {
    await openSpyRoom('Hana', false);
    guestPhone('Omar');
    guestPhone('Lina');
    await settle();
    startRound(3);
    render(<Play />);
    expect(screen.getByTestId('pass-name')).toHaveTextContent('Hana');
    fireEvent.press(screen.getByTestId('show-card'));
    fireEvent.press(screen.getByTestId('hide-card'));
    await settle();
    expect(screen.getByTestId('seen-count')).toHaveTextContent('Seen their card: 1/3');
    guests[0]?.send({ t: 'seen' });
    await settle();
    expect(screen.getByTestId('seen-count')).toHaveTextContent('Seen their card: 2/3');
  });
});

describe('Spy on everyone’s phone: a guest', () => {
  it('flips its own card, then sees the answer and the scores when the host gets there', async () => {
    await openSpyRoom('Hana', false);
    useSettings.setState({ myName: 'Omar', deviceId: 'omar-phone' });
    render(<Join />);
    fireEvent.press(screen.getByTestId('room-Hana'));
    await settle();
    expect(screen.getByTestId('room-game')).toHaveTextContent('Game: Spy');
    guestPhone('Lina');
    await settle();
    startRound(3);
    await settle();

    const round = useSpy.getState().round;
    const mine = round?.spies.includes(1) ? 'card-spy' : 'card-word';
    fireEvent.press(screen.getByTestId('show-card'));
    expect(screen.getByTestId(mine)).toBeTruthy();
    fireEvent.press(screen.getByTestId('hide-card'));
    await settle();
    expect(useSpy.getState().round?.seen).toEqual([1]);
    expect(screen.getByText(/Card hidden/)).toBeTruthy();

    useSpy.getState().setRevealed();
    await settle();
    const word = PACK?.words.find((w) => w.id === round?.wordId);
    expect(screen.getByTestId('answer-word')).toHaveTextContent(word?.text.en ?? '');

    useSession.getState().addPoints([0, 2, 0]);
    useSpy.getState().setGain([0, 2, 0]);
    await settle();
    expect(screen.getByTestId('guest-scores')).toBeTruthy();
    expect(screen.getByText('Waiting for the next round…')).toBeTruthy();

    // The host goes back to settings: everyone returns to the lobby.
    useSpy.getState().endRound();
    await settle();
    expect(screen.getByTestId('waiting-host')).toBeTruthy();
  });
});
