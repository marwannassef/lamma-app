import { createFakeNetwork } from '@/core/net/fake';
import { seededRng } from '@/core/rng';

import {
  gameReducer,
  newGame,
  viewFor,
  type GameState,
  type RoleId,
  type SeatAction,
  type SeatView,
} from '../../engine';
import {
  encode,
  GuestSession,
  HostSession,
  parseGuestMsg,
  PING_MS,
  PROTOCOL,
  RETRY_MS,
  SILENCE_MS,
  type Member,
  type RoomGame,
} from '@/core/room';

import { parseIntent } from '../intents';
import { eventFor } from '../room';

/** The room's view of a Werewolf game kept in a local variable (the store's job in the app). */
function roomGame(get: () => GameState | null, set: (g: GameState) => void): RoomGame {
  return {
    id: 'werewolf',
    theme: 'werewolf',
    kids: false,
    players: () => get()?.players.length ?? null,
    viewFor: (seat) => {
      const g = get();
      return g ? viewFor(g, seat) : null;
    },
    act: (seat, raw) => {
      const g = get();
      const intent = parseIntent(raw);
      const e = g && intent ? eventFor(g, seat, intent) : null;
      if (g && e) set(gameReducer(g, e, { now: Date.now(), rng: seededRng(1) }));
    },
  };
}

const MIN_TURN = 4500;

/** A table: one host phone, guest phones, a fake network and a fake clock. */
async function table(guestNames: string[]) {
  const net = createFakeNetwork();
  const rng = seededRng(9);
  let now = 1_000_000;
  let game: GameState | null = null;
  const timers: { at: number; fn: () => void; cancelled: boolean }[] = [];
  const schedule = (fn: () => void, ms: number) => {
    const t = { at: now + ms, fn, cancelled: false };
    timers.push(t);
    return () => {
      t.cancelled = true;
    };
  };
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      net.flush();
    }
  };
  /** Moves the clock, firing due timers, and delivers everything. */
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => !t.cancelled && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = Math.max(now, due.at);
      due.cancelled = true;
      due.fn();
      await settle();
    }
    now = end;
    await settle();
  };

  const openHost = (members?: Member[]) =>
    HostSession.open({
      transport: net.transport,
      host: { deviceId: 'host-phone', name: 'Hana' },
      game: {
        ...roomGame(
          () => game,
          (g) => {
            game = g;
          },
        ),
        // The host checks timing with its own (fake) clock.
        act: (seat, raw) => {
          const intent = parseIntent(raw);
          const e = game && intent ? eventFor(game, seat, intent) : null;
          if (game && e) game = gameReducer(game, e, { now, rng });
        },
      },
      now: () => now,
      members,
    });
  const host = await openHost();
  const join = (name: string) =>
    new GuestSession({
      transport: net.transport,
      address: host.getSnapshot().address,
      deviceId: `device-${name}`,
      name,
      now: () => now,
      schedule,
    });
  const guests = guestNames.map(join);
  await settle();

  return {
    net,
    host,
    guests,
    join,
    openHost,
    settle,
    advance,
    get game() {
      return game as GameState;
    },
    set game(g: GameState) {
      game = g;
    },
    tick: (ms: number) => {
      now += ms;
    },
  };
}

/** What a phone sends for its action: the first allowed target, no potions. */
function actionFrom(v: SeatView): SeatAction {
  const task = v.task;
  if (task?.t !== 'action') throw new Error(`seat ${v.seat} has no action`);
  switch (task.kind) {
    case 'dummy':
      return { kind: 'dummy' };
    case 'wolf':
      return { kind: 'wolf', targets: task.targets.slice(0, task.wolfKills) };
    case 'witch':
      return { kind: 'witch', heal: false };
    default:
      return { kind: task.kind, target: task.targets.find((id) => id !== v.seat) as number };
  }
}

const ROLES: RoleId[] = ['villager', 'werewolf', 'seer', 'doctor', 'villager', 'werewolf'];
const wire = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe('lobby', () => {
  it('seats players in the order they join and tells each phone its seat', async () => {
    const t = await table(['Omar', 'Lina', 'Sam']);
    expect(t.host.getSnapshot().members.map((m) => [m.name, m.online])).toEqual([
      ['Hana', true],
      ['Omar', true],
      ['Lina', true],
      ['Sam', true],
    ]);
    expect(t.host.getSnapshot().address).toBe('10.0.0.1:47777');
    expect(t.guests.map((g) => [g.getSnapshot().status, g.getSnapshot().seat])).toEqual([
      ['lobby', 1],
      ['lobby', 2],
      ['lobby', 3],
    ]);
    expect(t.guests[0]?.getSnapshot().lobby).toEqual({
      game: 'werewolf',
      theme: 'werewolf',
      kids: false,
      names: ['Hana', 'Omar', 'Lina', 'Sam'],
      online: [true, true, true, true],
      host: 0,
    });
  });

  it('reorders seats and removes a player, telling the phones', async () => {
    const t = await table(['Omar', 'Lina', 'Sam']);
    const seen = jest.fn();
    t.host.subscribe(seen);
    t.host.move(3, 0);
    await t.settle();
    expect(t.host.seating.map((m) => m.name)).toEqual(['Sam', 'Hana', 'Omar', 'Lina']);
    expect(t.host.hostSeat).toBe(1);
    expect(t.guests[2]?.getSnapshot().seat).toBe(0);
    expect(seen).toHaveBeenCalled();

    t.host.remove('device-Lina');
    t.host.remove('host-phone'); // the host can't remove itself
    t.host.move(0, 9); // no such seat
    await t.settle();
    expect(t.guests[1]?.getSnapshot()).toMatchObject({ status: 'rejected', reason: 'removed' });
    expect(t.host.seating.map((m) => m.name)).toEqual(['Sam', 'Hana', 'Omar']);
    expect(t.guests[0]?.getSnapshot().lobby?.names).toEqual(['Sam', 'Hana', 'Omar']);
  });

  it('turns away an old app version, a full room, and new phones once the game started', async () => {
    const t = await table([]);
    const replies: string[] = [];
    const raw = await t.net.transport.connect(t.host.getSnapshot().address, {
      onMessage: (m) => replies.push(m),
      onClose: () => replies.push('closed'),
    });
    raw.send(encode({ t: 'hello', v: PROTOCOL + 1, deviceId: 'old', name: 'Old' }));
    await t.settle();
    expect(replies).toEqual([encode({ t: 'reject', reason: 'version' }), 'closed']);

    const many = Array.from({ length: 19 }, (_, i) => t.join(`P${i}`));
    await t.settle();
    expect(many.every((g) => g.getSnapshot().status === 'lobby')).toBe(true);
    const late = t.join('Late');
    await t.settle();
    expect(late.getSnapshot()).toMatchObject({ status: 'rejected', reason: 'full' });

    t.host.remove('device-P18');
    t.game = newGame(Array<RoleId>(19).fill('villager'), {}, { mode: 'network' });
    t.host.sync();
    const afterStart = t.join('After');
    await t.settle();
    expect(afterStart.getSnapshot()).toMatchObject({ status: 'rejected', reason: 'started' });
  });

  it('does nothing with game moves before the game starts', async () => {
    const t = await table(['Omar']);
    t.host.actFor(0, { t: 'seen' });
    t.guests[0]?.send({ t: 'seen' });
    await t.settle();
    expect(t.guests[0]?.getSnapshot().status).toBe('lobby');
  });

  it("keeps a renamed player's seat and ignores a phone claiming to be the host", async () => {
    const t = await table(['Omar']);
    t.guests[0]?.leave();
    const again = new GuestSession({
      transport: t.net.transport,
      address: t.host.getSnapshot().address,
      deviceId: 'device-Omar',
      name: 'Omar 2',
      now: () => 0,
      schedule: () => () => undefined,
    });
    const impostor = new GuestSession({
      transport: t.net.transport,
      address: t.host.getSnapshot().address,
      deviceId: 'host-phone',
      name: 'Hacker',
      now: () => 0,
      schedule: () => () => undefined,
    });
    await t.settle();
    expect(again.getSnapshot()).toMatchObject({ status: 'lobby', seat: 1 });
    expect(t.host.seating.map((m) => m.name)).toEqual(['Hana', 'Omar 2']);
    expect(impostor.getSnapshot().status).toBe('rejected');
  });
});

describe('playing', () => {
  async function started() {
    const t = await table(['Omar', 'Lina', 'Sam', 'Nour', 'Ziad']);
    t.game = newGame(ROLES, {}, { mode: 'network' });
    t.host.sync();
    await t.settle();
    return t;
  }

  it('sends every phone only its own view', async () => {
    const t = await started();
    t.guests.forEach((g, i) => {
      const seat = i + 1;
      expect(g.getSnapshot()).toMatchObject({ status: 'playing', seat });
      expect(g.getSnapshot().view).toEqual(wire(viewFor(t.game, seat)));
      expect(g.getSnapshot().names).toEqual(['Hana', 'Omar', 'Lina', 'Sam', 'Nour', 'Ziad']);
    });
    expect(t.host.getSnapshot().started).toBe(true);
  });

  it('plays a whole night with everyone on their own phone', async () => {
    const t = await started();
    for (const g of t.guests) g.send({ t: 'seen' });
    await t.settle();
    expect(t.game.phase).toEqual({ t: 'reveal', seen: [1, 2, 3, 4, 5] });
    t.host.actFor(t.host.hostSeat, { t: 'seen' });
    expect(t.game.phase.t).toBe('nightIntro');

    t.host.actFor(0, { t: 'seen' }); // wrong phase: nothing happens
    t.game = gameReducer(t.game, { t: 'nightIntroDone' }, { now: 0, rng: seededRng(1) });
    t.game = gameReducer(t.game, { t: 'glanceDone' }, { now: 0, rng: seededRng(1) });
    t.host.sync();
    await t.advance(MIN_TURN);
    for (const g of t.guests) {
      const view = g.getSnapshot().view as SeatView;
      g.send({ t: 'seatAction', action: actionFrom(view) });
    }
    await t.settle();
    expect(t.game.phase).toMatchObject({ t: 'actions', acted: [1, 2, 3, 4, 5] });
    expect((t.guests[1]?.getSnapshot().view as SeatView | null)?.result).toMatchObject({
      kind: 'seer',
    });
    t.host.actFor(0, { t: 'seatAction', action: actionFrom(viewFor(t.game, 0)) });
    await t.settle();
    expect(t.game.phase.t).toBe('morning');
    expect((t.guests[0]?.getSnapshot().view as SeatView | null)?.public.phase.t).toBe('morning');
  });

  it("ignores a phone acting for another seat, or for the Hunter when it isn't one", async () => {
    const t = await started();
    const before = t.game;
    t.guests[0]?.send({ t: 'hunterShoot', target: 2 });
    t.guests[0]?.send({ t: 'cupidLink', lovers: [2, 3] }); // seat 1 isn't the Cupid
    await t.settle();
    expect(t.game).toBe(before);
    expect(t.guests[0]?.getSnapshot().status).toBe('playing');
  });

  it('shrugs off junk on the wire', async () => {
    const t = await started();
    const raw = await t.net.transport.connect(t.host.getSnapshot().address, {
      onMessage: () => undefined,
      onClose: () => undefined,
    });
    for (const junk of [
      '',
      'nope',
      '[]',
      '{"t":"intent","intent":{"t":"seen"}}',
      'x'.repeat(5000),
    ]) {
      raw.send(junk);
    }
    await t.settle();
    expect(t.game.phase).toEqual({ t: 'reveal', seen: [] });
  });

  it('a phone that drops rejoins its seat and picks up where it was', async () => {
    const t = await started();
    t.guests[2]?.send({ t: 'seen' });
    await t.settle();
    const [, , third] = t.net.openPeers();
    t.net.drop(third as string);
    await t.settle();
    expect(t.guests[2]?.getSnapshot().status).toBe('reconnecting');
    expect(t.host.getSnapshot().members[3]?.online).toBe(false);

    await t.advance(RETRY_MS[0] as number);
    expect(t.guests[2]?.getSnapshot()).toMatchObject({ status: 'playing', seat: 3 });
    expect((t.guests[2]?.getSnapshot().view as SeatView | null)?.task).toEqual({
      t: 'reveal',
      cupid: false,
      seen: true,
    });
    expect(t.host.getSnapshot().members[3]?.online).toBe(true);
  });

  it('a relaunched host is found again and every phone rejoins its seat', async () => {
    const t = await started();
    const members = t.host.seating.slice();
    t.host.close();
    await t.settle();
    expect(t.guests.every((g) => g.getSnapshot().status === 'reconnecting')).toBe(true);

    await t.advance(RETRY_MS[0] as number); // nobody is listening yet
    expect(t.guests[0]?.getSnapshot().status).toBe('reconnecting');
    const relaunched = await t.openHost(members);
    await t.advance((RETRY_MS[1] as number) + (RETRY_MS[2] as number));
    expect(relaunched.getSnapshot().members.every((m) => m.online)).toBe(true);
    t.guests.forEach((g, i) =>
      expect(g.getSnapshot()).toMatchObject({ status: 'playing', seat: i + 1 }),
    );
  });
});

describe('leaving and coming back', () => {
  it('a host that closes the room on purpose tells every phone, and they stop retrying', async () => {
    const t = await table(['Omar', 'Lina']);
    t.host.close(true);
    await t.settle();
    for (const g of t.guests) {
      expect(g.getSnapshot()).toMatchObject({ status: 'rejected', reason: 'closed' });
    }
    await t.advance(10_000);
    expect(t.net.openPeers()).toHaveLength(0);
  });

  it('a host back from the background listens again and every phone keeps its seat', async () => {
    const t = await table(['Omar', 'Lina']);
    t.game = newGame(['werewolf', 'seer', 'villager'], {}, { mode: 'network' });
    t.host.sync();
    await t.settle();
    await t.host.relisten();
    await t.settle();
    expect(t.guests.map((g) => g.getSnapshot().status)).toEqual(['reconnecting', 'reconnecting']);
    await t.advance(RETRY_MS[0] as number);
    expect(t.guests.map((g) => [g.getSnapshot().status, g.getSnapshot().seat])).toEqual([
      ['playing', 1],
      ['playing', 2],
    ]);
  });

  it('a guest back from the background redials at once if the line went quiet', async () => {
    const t = await table(['Omar']);
    const g = t.guests[0] as GuestSession;
    g.wake(); // just heard from the host: nothing to do
    await t.settle();
    expect(g.getSnapshot().status).toBe('lobby');

    t.tick(PING_MS * 2); // asleep: no pings went out, nothing came in
    g.wake();
    await t.settle();
    expect(g.getSnapshot().status).toBe('reconnecting');
    await t.advance(RETRY_MS[0] as number);
    expect(g.getSnapshot()).toMatchObject({ status: 'lobby', seat: 1 });

    g.leave();
    g.wake(); // after leaving, nothing
    expect(g.getSnapshot().status).toBe('closed');
  });
});

describe('heartbeat', () => {
  it('phones ping the host; a silent host gets dropped and retried', async () => {
    const t = await table(['Omar']);
    await t.advance(PING_MS * 3);
    expect(t.guests[0]?.getSnapshot().status).toBe('lobby');

    // The host stops answering (frozen, not closed): the phone notices and reconnects.
    const peers = t.net.openPeers();
    t.host.close();
    t.net.flush();
    await t.advance(SILENCE_MS + PING_MS);
    expect(peers.length).toBe(1);
    expect(t.guests[0]?.getSnapshot().status).toBe('reconnecting');
  });

  it('the host drops phones that went quiet, and connections that never said hello', async () => {
    const t = await table(['Omar']);
    const quiet = await t.net.transport.connect(t.host.getSnapshot().address, {
      onMessage: () => undefined,
      onClose: () => undefined,
    });
    quiet.send(encode({ t: 'hello', v: PROTOCOL, deviceId: 'quiet', name: 'Quiet' }));
    await t.net.transport.connect(t.host.getSnapshot().address, {
      onMessage: () => undefined,
      onClose: () => undefined,
    });
    await t.settle();
    expect(t.net.openPeers()).toHaveLength(3);
    t.tick(SILENCE_MS + 1);
    t.host.tick();
    await t.settle();
    // Omar's phone also went quiet here (no timers ran), and reconnects on its own later.
    expect(t.net.openPeers()).toHaveLength(0);
    expect(t.host.getSnapshot().members.map((m) => [m.name, m.online])).toEqual([
      ['Hana', true],
      ['Omar', false],
      ['Quiet', false],
    ]);
  });
});

describe('guest edge cases', () => {
  /** A guest whose clock and timers the test drives by hand. */
  function manualGuest(
    transport: ReturnType<typeof createFakeNetwork>['transport'],
    address: string,
  ) {
    const timers: (() => void)[] = [];
    const guest = new GuestSession({
      transport,
      address,
      deviceId: 'device-Omar',
      name: 'Omar',
      now: () => 0,
      schedule: (fn) => {
        timers.push(fn);
        return () => undefined;
      },
    });
    const listener = jest.fn();
    guest.subscribe(listener);
    return { guest, timers, listener };
  }

  it('keeps trying until the host opens the room', async () => {
    const net = createFakeNetwork();
    const { guest, timers } = manualGuest(net.transport, '10.0.0.1:47777');
    await Promise.resolve();
    expect(guest.getSnapshot().status).toBe('connecting');
    const host = await HostSession.open({
      transport: net.transport,
      host: { deviceId: 'h', name: 'Hana' },
      game: {
        ...roomGame(
          () => null,
          () => undefined,
        ),
        theme: 'mafia',
        kids: true,
      },
      now: () => 0,
    });
    timers.shift()?.();
    for (let i = 0; i < 4; i++) {
      await Promise.resolve();
      net.flush();
    }
    expect(guest.getSnapshot()).toMatchObject({ status: 'lobby', seat: 1 });
    expect(guest.getSnapshot().lobby).toMatchObject({ theme: 'mafia', kids: true });
    host.close();
  });

  it('leaving stops everything, even mid-connect', async () => {
    const net = createFakeNetwork();
    await net.transport.listen({
      onOpen: () => undefined,
      onMessage: () => undefined,
      onClose: () => undefined,
    });
    const { guest, timers, listener } = manualGuest(net.transport, '10.0.0.1:47777');
    guest.leave();
    await Promise.resolve();
    net.flush();
    expect(guest.getSnapshot().status).toBe('closed');
    expect(net.openPeers()).toHaveLength(0);
    expect(listener).toHaveBeenCalled();
    timers.forEach((fn) => fn()); // nothing left to do
    expect(guest.getSnapshot().status).toBe('closed');
  });

  it('keeps the newest view and ignores anything it does not understand', async () => {
    const net = createFakeNetwork();
    const sends: ((text: string) => void)[] = [];
    await net.transport.listen({
      onOpen: (peer) => sends.push((text) => peer.send(text)),
      onMessage: () => undefined,
      onClose: () => undefined,
    });
    const { guest, timers } = manualGuest(net.transport, '10.0.0.1:47777');
    await Promise.resolve();
    const view = wire(viewFor(newGame(ROLES, {}, { mode: 'network' }), 2));
    const send = sends[0] as (text: string) => void;
    send(encode({ t: 'welcome', v: PROTOCOL }));
    send(encode({ t: 'view', rev: 5, game: 'werewolf', seat: 2, names: ['a'], view }));
    send(encode({ t: 'view', rev: 4, game: 'werewolf', seat: 9, names: ['old'], view }));
    send('not json');
    send('42');
    send(encode({ t: 'pong' }));
    net.flush();
    expect(guest.getSnapshot()).toMatchObject({ status: 'playing', seat: 2, names: ['a'] });
    // With no client, the heartbeat stops quietly.
    guest.leave();
    timers.forEach((fn) => fn());
  });

  it('a phone opening a second connection replaces its first', async () => {
    const t = await table(['Omar']);
    const twin = t.join('Omar');
    await t.settle();
    expect(twin.getSnapshot()).toMatchObject({ status: 'lobby', seat: 1 });
    expect(t.guests[0]?.getSnapshot().status).toBe('reconnecting');
    expect(t.host.seating).toHaveLength(2);
  });

  it('a port can only be used by one host at a time', async () => {
    const net = createFakeNetwork();
    const handlers = {
      onOpen: () => undefined,
      onMessage: () => undefined,
      onClose: () => undefined,
    };
    await net.transport.listen(handlers);
    await expect(net.transport.listen(handlers)).rejects.toThrow('in use');
  });
});

describe('protocol', () => {
  it('reads only well-formed guest messages', () => {
    const ok = (m: unknown) => parseGuestMsg(JSON.stringify(m));
    expect(ok({ t: 'hello', v: 1, deviceId: 'd', name: '  Omar  ' })).toEqual({
      t: 'hello',
      v: 1,
      deviceId: 'd',
      name: 'Omar',
    });
    expect(ok({ t: 'hello', v: 1, deviceId: 'd', name: 'x'.repeat(40) })).toMatchObject({
      name: 'x'.repeat(14),
    });
    expect(ok({ t: 'hello', v: 1, deviceId: 'd', name: 7 })).toMatchObject({ name: '' });
    expect(ok({ t: 'hello', v: 1, deviceId: '' })).toBeNull();
    expect(ok({ t: 'hello', v: -1, deviceId: 'd' })).toBeNull();
    expect(ok({ t: 'hello', v: 1, deviceId: 'd'.repeat(65) })).toBeNull();
    expect(ok({ t: 'ping' })).toEqual({ t: 'ping' });
    expect(ok({ t: 'what' })).toBeNull();
    expect(ok(['hello'])).toBeNull();
    expect(parseGuestMsg('{')).toBeNull();

    // The room passes any object through; Werewolf's own parser decides.
    expect(ok({ t: 'intent', intent: 'seen' })).toBeNull();
    expect(ok({ t: 'intent', intent: { t: 'anything' } })).toEqual({
      t: 'intent',
      intent: { t: 'anything' },
    });
    const intent = (i: unknown) => parseIntent(i) != null;
    for (const good of [
      { t: 'seen' },
      { t: 'cupidLink', lovers: [1, 2] },
      { t: 'hunterShoot', target: 3 },
      { t: 'passBadge', to: null },
      { t: 'passBadge', to: 2 },
      { t: 'mayorDecide', pick: null },
      { t: 'seatAction', action: { kind: 'dummy' } },
      { t: 'seatAction', action: { kind: 'wolf', targets: [1, 2] } },
      { t: 'seatAction', action: { kind: 'seer', target: 1 } },
      { t: 'seatAction', action: { kind: 'witch', heal: true } },
      { t: 'seatAction', action: { kind: 'witch', heal: false, poison: 2 } },
    ]) {
      expect(intent(good)).toBe(true);
    }
    for (const bad of [
      null,
      { t: 'nope' },
      { t: 'cupidLink', lovers: [1] },
      { t: 'cupidLink', lovers: [1, -2] },
      { t: 'hunterShoot', target: '3' },
      { t: 'passBadge', to: 1.5 },
      { t: 'mayorDecide' },
      { t: 'seatAction', action: null },
      { t: 'seatAction', action: { kind: 'wolf', targets: [1, 2, 3] } },
      { t: 'seatAction', action: { kind: 'wolf', targets: 'all' } },
      { t: 'seatAction', action: { kind: 'doctor' } },
      { t: 'seatAction', action: { kind: 'witch' } },
      { t: 'seatAction', action: { kind: 'witch', heal: true, poison: 'x' } },
      { t: 'seatAction', action: { kind: 'god' } },
    ]) {
      expect(intent(bad)).toBe(false);
    }
  });

  it("only the acting seat may send the Hunter's and Mayor's choices", () => {
    const g: GameState = {
      ...newGame(ROLES, {}, { mode: 'network' }),
      phase: { t: 'deathEffects', queue: [{ t: 'hunterShot', hunter: 4 }], then: 'day' },
    };
    expect(eventFor(g, 4, { t: 'hunterShoot', target: 1 })).toEqual({
      t: 'hunterShoot',
      target: 1,
    });
    expect(eventFor(g, 3, { t: 'hunterShoot', target: 1 })).toBeNull();
    expect(eventFor(g, 4, { t: 'passBadge', to: null })).toEqual({ t: 'passBadge', to: null });
    expect(eventFor(g, 4, { t: 'mayorDecide', pick: 2 })).toEqual({ t: 'mayorDecide', pick: 2 });
  });
});
