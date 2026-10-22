import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import Join from '../app/join';
import { allPacks, filterPacks } from '../src/core/content';
import { initI18n } from '../src/core/i18n';
import { createFakeNetwork, type FakeNetwork } from '../src/core/net/fake';
import { usePlayers } from '../src/core/players';
import {
  closeRoom,
  getRoom,
  GuestSession,
  leaveRoom,
  setRoomBrowser,
  setTransportFactory,
} from '../src/core/room';
import { useSession } from '../src/core/session';
import { useSettings } from '../src/core/settings/store';
import { storage } from '../src/core/storage';
import { openBlendInRoom, resumeBlendInRoom } from '../src/games/blendIn/net';
import Play from '../src/games/blendIn/screens/Play';
import Setup from '../src/games/blendIn/screens/Setup';
import { useBlendIn } from '../src/games/blendIn/store';

jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: jest.fn() }));
jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(async () => 1),
  setBrightnessAsync: jest.fn(async () => undefined),
  restoreSystemBrightnessAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  Redirect: () => null,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));

let net: FakeNetwork;
const guests: GuestSession[] = [];
const packs = filterPacks(allPacks, { game: 'spy', regions: ['global', 'eg'], level: 'kids' });

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

const dispatch = (e: Parameters<ReturnType<typeof useBlendIn.getState>['dispatch']>[0]) =>
  act(() => useBlendIn.getState().dispatch(e));

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
  useBlendIn.setState({ game: null, netMembers: null });
  useSession.setState({ scores: [3, 3, 3], lastGain: [], round: 1 });
  jest.mocked(router.push).mockClear();
});
afterEach(async () => {
  guests.splice(0).forEach((g) => g.leave());
  leaveRoom();
  closeRoom();
  await settle();
});

describe('Blend In on everyone’s phone: the host', () => {
  it('opens a room and starts a network game for who joined', async () => {
    render(<Setup />);
    fireEvent.press(screen.getByTestId('phones-all'));
    expect(screen.queryByTestId('players')).toBeNull();
    fireEvent.press(screen.getByTestId('open-room'));
    await settle();
    guestPhone('Omar');
    guestPhone('Lina');
    await settle();
    fireEvent.press(screen.getByTestId('start'));
    await settle();
    const g = useBlendIn.getState().game;
    expect(g).toMatchObject({ network: true, players: 3, phase: { t: 'look', seen: [] } });
    expect(useBlendIn.getState().netMembers?.map((m) => m.name)).toEqual(['Hana', 'Omar', 'Lina']);
    expect(useSession.getState().scores).toEqual([]);
    expect(router.push).toHaveBeenCalledWith('/games/blend-in/play');
    expect(guests[1]?.getSnapshot()).toMatchObject({ status: 'playing', game: 'blendIn', seat: 2 });
  });

  it('shows its own card, counts who has looked, and waits for the Chameleon’s phone', async () => {
    await openBlendInRoom('Hana', false);
    guestPhone('Omar');
    guestPhone('Lina');
    await settle();
    act(() => useBlendIn.getState().start(3, packs, true));
    await settle();
    render(<Play />);
    // Hana's own card, behind the usual hand-off and hold.
    expect(screen.getByTestId('peek-name')).toHaveTextContent('Hana');
    fireEvent.press(screen.getByTestId('im-player'));
    fireEvent(screen.getByTestId('peek-hold'), 'pressIn');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });
    fireEvent(screen.getByTestId('peek-hold'), 'pressOut');
    await settle();
    expect(screen.getByTestId('net-progress')).toHaveTextContent('Looked at their card: 1/3');

    for (const g of guests) g.send({ t: 'seen' });
    await settle();
    expect(useBlendIn.getState().game?.phase.t).toBe('circle');

    // Make a guest the Chameleon and get them caught.
    const g = useBlendIn.getState().game;
    if (!g) throw new Error('no game');
    useBlendIn.setState({ game: { ...g, round: { ...g.round, chameleon: 1 } } });
    for (let i = 0; i < 3; i++) await dispatch({ t: 'nextClue' });
    await dispatch({ t: 'startVote' });
    await dispatch({ t: 'accuse', id: 1 });
    await settle();
    expect(screen.getByTestId('guessing')).toHaveTextContent(
      'Omar is guessing on their own phone…',
    );
  });

  it('reopens the room after a relaunch with the same seats', async () => {
    const members = [
      { deviceId: 'device-Omar', name: 'Omar', isHost: false },
      { deviceId: 'host-phone', name: 'Hana', isHost: true },
      { deviceId: 'device-Lina', name: 'Lina', isHost: false },
    ];
    act(() => useBlendIn.getState().start(3, packs, true));
    useBlendIn.setState({ netMembers: members });
    resumeBlendInRoom('Someone', false);
    await settle();
    expect(getRoom('blendIn')?.seating).toEqual(members);
  });
});

describe('Blend In on everyone’s phone: a guest', () => {
  it('looks at its card, gets its clue turn, guesses as the Chameleon, and sees the result', async () => {
    await openBlendInRoom('Hana', false);
    useSettings.setState({ myName: 'Omar', deviceId: 'omar-phone' });
    render(<Join />);
    fireEvent.press(screen.getByTestId('room-Hana'));
    await settle();
    expect(screen.getByTestId('room-game')).toHaveTextContent('Game: Blend In');
    guestPhone('Lina');
    await settle();
    act(() => useBlendIn.getState().start(3, packs, true));
    await settle();
    // This phone (seat 1) is the Chameleon for this test.
    const g0 = useBlendIn.getState().game;
    if (!g0) throw new Error('no game');
    act(() => useBlendIn.setState({ game: { ...g0, round: { ...g0.round, chameleon: 1 } } }));
    await settle();

    fireEvent(screen.getByTestId('hold-card'), 'pressIn');
    expect(screen.getByTestId('card-chameleon')).toBeTruthy();
    fireEvent(screen.getByTestId('hold-card'), 'pressOut');
    await settle();
    expect(screen.getByTestId('wait-others')).toHaveTextContent('Waiting for the others… 1/3');

    await dispatch({ t: 'seen', seat: 0 });
    await dispatch({ t: 'seen', seat: 2 });
    await settle();
    const order = useBlendIn.getState().game?.round.order ?? [];
    // Clues go round until it's this phone's turn.
    for (const speaker of order) {
      if (speaker === 1) break;
      await dispatch({ t: 'nextClue' });
    }
    await settle();
    expect(screen.getByTestId('headline')).toHaveTextContent('Your turn! Say one word.');

    while (useBlendIn.getState().game?.phase.t === 'circle') await dispatch({ t: 'nextClue' });
    await dispatch({ t: 'startVote' });
    await settle();
    expect(screen.getByTestId('headline')).toHaveTextContent('Point at the Chameleon in…');
    await dispatch({ t: 'accuse', id: 1 });
    await settle();
    const secret = useBlendIn.getState().game?.round.secret;
    const word = packs.flatMap((p) => p.words).find((w) => w.id === secret);
    fireEvent.press(screen.getByText(word?.text.en ?? ''));
    await settle();
    expect(useBlendIn.getState().game?.phase).toMatchObject({ t: 'result', outcome: 'escaped' });
    expect(screen.getByTestId('headline')).toHaveTextContent('Omar blended in and escaped!');
    expect(screen.getByTestId('secret-word')).toHaveTextContent(word?.text.en ?? '');
    expect(screen.getByTestId('guest-scores')).toBeTruthy();
  });
});
