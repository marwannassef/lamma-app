// Keeps this phone's network room alive across screens: the host's session (setup → lobby →
// game → play again) or a guest's. Screens read them with the hooks below.
import { useEffect, useState, useSyncExternalStore } from 'react';

import type { Transport } from '@/core/net';
import type { Room } from '@/core/net/native';
import { useSettings } from '@/core/settings/store';

import type { Theme } from '../engine';
import { useWerewolf } from '../store';
import { GuestSession, type GuestSnapshot } from './guest';
import { HostSession, type HostSnapshot } from './host';

type TransportFactory = (roomName: string) => Promise<Transport>;

// The native module is loaded only when a room is used (tests swap in a fake network).
let makeTransport: TransportFactory = async (roomName) =>
  (await import('@/core/net/native')).nativeTransport(roomName);

/** Tests: use another transport (e.g. the in-memory fake network). */
export function setTransportFactory(factory: TransportFactory) {
  makeTransport = factory;
}

type Browser = (onChange: (rooms: Room[]) => void) => () => void;

let browser: Browser = (onChange) => {
  let stop = () => undefined as void;
  let stopped = false;
  void import('@/core/net/native').then((m) => {
    if (!stopped) stop = m.browseRooms(onChange);
  });
  return () => {
    stopped = true;
    stop();
  };
};

/** Tests: list rooms from somewhere else. */
export function setRoomBrowser(b: Browser) {
  browser = b;
}

/**
 * Games advertised nearby, while `enabled`. Keep it on until the phone has joined: on iOS a room
 * found by Bonjour can only be reached while browsing (after that, its IP is remembered).
 */
export function useNearbyRooms(enabled = true): Room[] {
  const [rooms, setRooms] = useState<Room[]>([]);
  useEffect(() => (enabled ? browser(setRooms) : undefined), [enabled]);
  return rooms;
}

const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

let host: HostSession | null = null;
let opening: Promise<HostSession> | null = null;
let stopHost: (() => void) | null = null;
let guest: GuestSession | null = null;

/** The phone's id for network games, saved so a relaunched phone rejoins its own seat. */
function deviceId() {
  const s = useSettings.getState();
  // Writing it once makes sure it's persisted even if no other setting ever changed.
  useSettings.setState({ deviceId: s.deviceId });
  return s.deviceId;
}

const networkGame = () => {
  const g = useWerewolf.getState().game;
  return g?.mode === 'network' ? g : null;
};

/** Opens (or returns) this phone's room. `name` is the host player's name. */
export function openRoom(opts: { name: string; theme: Theme; kids: boolean }) {
  if (host) return Promise.resolve(host);
  if (opening) return opening;
  opening = (async () => {
    const transport = await makeTransport(opts.name);
    const session = await HostSession.open({
      transport,
      host: { deviceId: deviceId(), name: opts.name },
      theme: opts.theme,
      kids: opts.kids,
      getGame: networkGame,
      dispatch: (e) => useWerewolf.getState().dispatch(e),
      now: Date.now,
      // After a relaunch mid-game, the same players get their seats back.
      members: networkGame() ? (useWerewolf.getState().netMembers ?? undefined) : undefined,
    });
    const tick = setInterval(() => session.tick(), 1000);
    const unsubscribe = useWerewolf.subscribe((s, prev) => {
      if (s.game !== prev.game) session.sync();
    });
    stopHost = () => {
      clearInterval(tick);
      unsubscribe();
      session.close();
    };
    host = session;
    changed();
    return session;
  })().finally(() => {
    opening = null;
  });
  return opening;
}

export function closeRoom() {
  stopHost?.();
  stopHost = null;
  host = null;
  changed();
}

export const getRoom = () => host;

export function joinRoom(address: string, name: string) {
  leaveRoom();
  const session = new GuestSession({
    transport: {
      // The guest never listens; only `connect` is used.
      listen: () => Promise.reject(new Error('Guests do not host')),
      connect: async (a, handlers) => (await makeTransport(name)).connect(a, handlers),
    },
    address,
    deviceId: deviceId(),
    name,
    now: Date.now,
    schedule: (fn, ms) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
  });
  guest = session;
  changed();
  return session;
}

export function leaveRoom() {
  guest?.leave();
  guest = null;
  changed();
}

const noop = () => () => undefined;

/** The host's room and what it looks like now, or nulls when this phone isn't hosting. */
export function useHostRoom(): { room: HostSession | null; snapshot: HostSnapshot | null } {
  const room = useSyncExternalStore(subscribe, () => host);
  const snapshot = useSyncExternalStore(room?.subscribe ?? noop, () => room?.getSnapshot() ?? null);
  return { room, snapshot };
}

/** This phone's guest session and its latest snapshot, or nulls when it hasn't joined a room. */
export function useGuest(): { session: GuestSession | null; snapshot: GuestSnapshot | null } {
  const session = useSyncExternalStore(subscribe, () => guest);
  const snapshot = useSyncExternalStore(
    session?.subscribe ?? noop,
    () => session?.getSnapshot() ?? null,
  );
  return { session, snapshot };
}
