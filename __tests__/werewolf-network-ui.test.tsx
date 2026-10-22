import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createFakeNetwork, type FakeNetwork } from '../src/core/net/fake';
import { roomCode } from '../src/core/net/roomCode';
import { initI18n } from '../src/core/i18n';
import { usePlayers } from '../src/core/players';
import { useSettings } from '../src/core/settings/store';
import { storage } from '../src/core/storage';
import { gameReducer, newGame, type GameEvent, type RoleId } from '../src/games/werewolf/engine';
import { GuestSession } from '../src/games/werewolf/net';
import {
  closeRoom,
  getRoom,
  leaveRoom,
  openRoom,
  setRoomBrowser,
  setTransportFactory,
} from '../src/games/werewolf/net/room';
import Join from '../src/games/werewolf/screens/Guest';
import Play from '../src/games/werewolf/screens/Play';
import Setup from '../src/games/werewolf/screens/Setup';
import { useWerewolf } from '../src/games/werewolf/store';
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
  useLocalSearchParams: () => ({ theme: 'werewolf' }),
}));

let net: FakeNetwork;
const guests: GuestSession[] = [];

/** Lets the fake network and the sessions' promises run until nothing moves. */
/** In these tests one process is both phones; the joining one needs its own device id. */
const asGuestPhone = () => useSettings.setState({ deviceId: 'this-guest-phone' });

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

/** What the screens dispatch on the host, applied to the store's game. */
const dispatch = (e: GameEvent) =>
  useWerewolf.setState((s) => ({
    game: s.game && gameReducer(s.game, e, { now: Date.now(), rng: seededRng(1) }),
  }));

beforeAll(() => initI18n('en'));
beforeEach(() => {
  storage.clear();
  net = createFakeNetwork();
  setTransportFactory(async () => net.transport);
  setRoomBrowser((onChange) => {
    onChange([{ id: 'hana', name: 'Hana', address: '10.0.0.1:47777' }]);
    return () => undefined;
  });
  usePlayers.setState({ count: 6, names: [] });
  useSettings.setState({ myName: '', deviceId: 'host-phone' });
  useWerewolf.setState({ game: null, netMembers: null, theme: 'werewolf' });
  jest.mocked(router.push).mockClear();
});
afterEach(async () => {
  guests.splice(0).forEach((g) => g.leave());
  leaveRoom();
  closeRoom();
  await settle();
});

describe('hosting on everyone’s phone', () => {
  it('opens a room, seats who joins, and starts a network game', async () => {
    render(<Setup />);
    fireEvent.press(screen.getByTestId('phones-all'));
    expect(screen.queryByTestId('players')).toBeNull(); // the room decides how many play
    fireEvent.press(screen.getByTestId('open-room'));
    expect(screen.getByText('Type your name first.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('host-name'), 'Hana');
    fireEvent.press(screen.getByTestId('open-room'));
    await settle();
    expect(screen.getByTestId('room-code-shown')).toHaveTextContent(roomCode('10.0.0.1') as string);
    expect(screen.getByText('Waiting for players: at least 4 to start.')).toBeTruthy();

    for (const name of ['Omar', 'Lina', 'Sam']) guestPhone(name);
    await settle();
    expect(screen.getByTestId('member-0')).toHaveTextContent('Hana (You)');
    expect(screen.getByTestId('member-3')).toHaveTextContent('Sam');
    expect(screen.queryByText('Waiting for players: at least 4 to start.')).toBeNull();

    fireEvent.press(screen.getByTestId('remove-2'));
    await settle();
    expect(guests[1]?.getSnapshot()).toMatchObject({ status: 'rejected', reason: 'removed' });
    guestPhone('Nour');
    await settle();

    fireEvent.press(screen.getByTestId('start-game'));
    await settle();
    const game = useWerewolf.getState().game;
    expect(game).toMatchObject({ mode: 'network', phase: { t: 'reveal', seen: [] } });
    expect(game?.players).toHaveLength(4);
    expect(useWerewolf.getState().netMembers?.map((m) => m.name)).toEqual([
      'Hana',
      'Omar',
      'Sam',
      'Nour',
    ]);
    expect(router.push).toHaveBeenCalledWith('/games/werewolf/play');
    expect(guests[0]?.getSnapshot()).toMatchObject({ status: 'playing', seat: 1 });
  });

  it('offers to join someone else’s game from one-phone setup', () => {
    render(<Setup />);
    fireEvent.press(screen.getByTestId('join-game'));
    expect(router.push).toHaveBeenCalledWith('/games/werewolf/join');
  });
});

describe('the host phone during the night', () => {
  async function hostGame(roles: RoleId[]) {
    await openRoom({ name: 'Hana', theme: 'werewolf', kids: false });
    const phones = roles.slice(1).map((_, i) => guestPhone(`P${i + 1}`));
    await settle();
    useWerewolf.setState({
      game: newGame(roles, { minTurnSeconds: 0 }, { mode: 'network' }),
      netMembers: getRoom()?.seating.slice() ?? null,
    });
    await settle();
    return phones;
  }

  it("opens its own player's card behind a hold, then only counts who's ready", async () => {
    const phones = await hostGame(['seer', 'werewolf', 'villager', 'villager']);
    render(<Play />);
    expect(screen.getByTestId('turn-name')).toHaveTextContent('Your turn, Hana');
    fireEvent(screen.getByTestId('open-my-turn'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    fireEvent.press(screen.getByTestId('net-seen'));
    await settle();
    expect(screen.getByTestId('net-progress')).toHaveTextContent('Ready 1/4');

    phones[0]?.send({ t: 'seen' });
    await settle();
    expect(screen.getByTestId('net-progress')).toHaveTextContent('Ready 2/4');
    expect(screen.queryByText(/P1/)).toBeNull(); // never who
  });

  it("lets the host play an offline phone's turn", async () => {
    const phones = await hostGame(['villager', 'werewolf', 'seer', 'villager']);
    dispatch({ t: 'seatSeen', seat: 0 });
    for (const p of phones) p.send({ t: 'seen' });
    await settle();
    dispatch({ t: 'nightIntroDone' });
    dispatch({ t: 'glanceDone' });
    await settle();
    // P3's phone drops before acting.
    const peers = net.openPeers();
    net.drop(peers[peers.length - 1] as string);
    await settle();

    render(<Play />);
    fireEvent(screen.getByTestId('open-my-turn'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    fireEvent.press(screen.getByLabelText(/P1/));
    fireEvent(screen.getByTestId('confirm-turn'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    await settle();
    expect(useWerewolf.getState().game?.phase).toMatchObject({ acted: [0] });
    // The same 3 s card as every phone (hidden from screen readers: the table would hear it).
    expect(screen.getByTestId('turn-result', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 3100));
    });
    expect(screen.getByTestId('net-progress')).toHaveTextContent('Done 1/4');
    fireEvent.press(screen.getByTestId('play-here-3'));
    expect(screen.getByTestId('turn-name')).toHaveTextContent('Your turn, P3');
  });
});

describe('a guest phone', () => {
  it('joins a room found nearby and waits for the host', async () => {
    await openRoom({ name: 'Hana', theme: 'mafia', kids: false });
    asGuestPhone();
    render(<Join />);
    fireEvent.press(screen.getByTestId('room-Hana'));
    expect(screen.getByText('Type your name first.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('my-name'), 'Omar');
    fireEvent.press(screen.getByTestId('room-Hana'));
    await settle();
    expect(screen.getByTestId('waiting-host')).toHaveTextContent(
      "You're in! Waiting for Hana to start.",
    );
  });

  it('checks a typed room code', async () => {
    await openRoom({ name: 'Hana', theme: 'werewolf', kids: false });
    useSettings.setState({ myName: 'Omar' });
    asGuestPhone();
    render(<Join />);
    fireEvent.changeText(screen.getByTestId('room-code'), 'nope');
    fireEvent.press(screen.getByTestId('join-code'));
    expect(screen.getByText(/That code doesn't look right/)).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('room-code'), roomCode('10.0.0.1') as string);
    fireEvent.press(screen.getByTestId('join-code'));
    await settle();
    expect(screen.getByTestId('waiting-host')).toBeTruthy();
  });

  it('sees its own card, closes its eyes, and takes its night turn', async () => {
    await openRoom({ name: 'Hana', theme: 'werewolf', kids: false });
    useSettings.setState({ myName: 'Omar' });
    asGuestPhone();
    render(<Join />);
    fireEvent.press(screen.getByTestId('room-Hana'));
    await settle(); // this phone takes seat 1
    for (const name of ['Lina', 'Sam']) guestPhone(name);
    await settle();
    useWerewolf.setState({
      game: newGame(
        ['werewolf', 'seer', 'villager', 'villager'],
        { minTurnSeconds: 0 },
        {
          mode: 'network',
        },
      ),
    });
    await settle();

    // Seat 1 is this phone: the Seer.
    fireEvent(screen.getByTestId('seal'), 'pressIn');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    expect(screen.getByTestId('role-seer', { includeHiddenElements: true })).toBeTruthy();
    fireEvent(screen.getByTestId('seal'), 'pressOut');
    fireEvent.press(screen.getByTestId('net-seen'));
    await settle();
    expect(screen.getByTestId('eyes-closed')).toHaveTextContent('Waiting for the others… 1/4');

    dispatch({ t: 'seatSeen', seat: 0 });
    for (const g of guests) g.send({ t: 'seen' });
    await settle();
    expect(screen.getByTestId('eyes-closed')).toHaveTextContent(/Eyes closed/);

    dispatch({ t: 'nightIntroDone' });
    dispatch({ t: 'glanceDone' });
    await settle();
    fireEvent.press(screen.getByLabelText(/Hana/));
    fireEvent(screen.getByTestId('confirm-turn'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    await settle();
    expect(useWerewolf.getState().game?.phase).toMatchObject({ acted: [1] });
    expect(screen.getByTestId('turn-result', { includeHiddenElements: true })).toHaveTextContent(
      '🐺 Werewolf',
    );
  });

  it('explains why the host turned it away', async () => {
    await openRoom({ name: 'Hana', theme: 'werewolf', kids: false });
    useWerewolf.setState({ game: newGame(['villager'], {}, { mode: 'network' }) });
    useSettings.setState({ myName: 'Late' });
    asGuestPhone();
    render(<Join />);
    fireEvent.press(screen.getByTestId('room-Hana'));
    await settle();
    expect(screen.getByText(/already started/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('leave-room'));
    expect(screen.getByTestId('my-name')).toBeTruthy();
  });
});
