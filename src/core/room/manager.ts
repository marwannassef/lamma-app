// Keeps this phone's network room alive across screens, for any game: the host's session
// (setup → lobby → game → play again) or a guest's. Screens read them with the hooks below.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import type { Transport } from '@/core/net';
import type { Room } from '@/core/net/native';
import { useSettings } from '@/core/settings/store';

import { GuestSession, type GuestSnapshot } from './guest';
import { HostSession, type HostSnapshot, type Member, type RoomGame } from './host';

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
let hostGame: string | null = null;
let opening: Promise<HostSession> | null = null;
let stopHost: ((goodbye: boolean) => void) | null = null;
let guest: GuestSession | null = null;

/** The phone's id for network games, saved so a relaunched phone rejoins its own seat. */
function deviceId() {
  const s = useSettings.getState();
  // Writing it once makes sure it's persisted even if no other setting ever changed.
  useSettings.setState({ deviceId: s.deviceId });
  return s.deviceId;
}

export interface OpenRoom {
  /** The host player's name (also the room's name in the "nearby" list). */
  name: string;
  game: RoomGame;
  /** Calls back whenever the game's state changes, so every phone gets its new view. */
  watch(onChange: () => void): () => void;
  /** Players from before a relaunch, so their phones get their seats back. */
  members?: Member[];
}

/** Opens (or returns) this phone's room. One room at a time; a different game closes the old one. */
export function openRoom(opts: OpenRoom): Promise<HostSession> {
  if (host && hostGame !== opts.game.id) closeRoom();
  if (host) return Promise.resolve(host);
  if (opening) return opening;
  opening = (async () => {
    const transport = await makeTransport(opts.name);
    const session = await HostSession.open({
      transport,
      host: { deviceId: deviceId(), name: opts.name },
      game: opts.game,
      now: Date.now,
      members: opts.members,
    });
    const tick = setInterval(() => session.tick(), 1000);
    const unwatch = opts.watch(() => session.sync());
    stopHost = (goodbye) => {
      clearInterval(tick);
      unwatch();
      session.close(goodbye);
    };
    host = session;
    hostGame = opts.game.id;
    changed();
    return session;
  })().finally(() => {
    opening = null;
  });
  return opening;
}

/** Ends this phone's room and tells the phones in it (they stop trying to reconnect). */
export function closeRoom() {
  stopHost?.(true);
  stopHost = null;
  host = null;
  hostGame = null;
  changed();
}

/** This phone's room, if it's hosting `game` (any game when omitted). */
export const getRoom = (game?: string) => (game == null || game === hostGame ? host : null);

/** A background stay shorter than this keeps the connections (nothing to repair). */
const BACKGROUND_REPAIR_MS = 3000;
let backgroundSince: number | null = null;

// iOS suspends an app's sockets in the background. Coming back, the host listens again and a
// guest redials at once; everyone's seat is kept.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') {
    backgroundSince ??= Date.now();
    return;
  }
  const away = backgroundSince == null ? 0 : Date.now() - backgroundSince;
  backgroundSince = null;
  if (away < BACKGROUND_REPAIR_MS) return;
  void host?.relisten().catch(() => undefined);
  guest?.wake();
});

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

/**
 * This phone's room and what it looks like now, or nulls when it isn't hosting `game` (any game
 * when omitted).
 */
export function useHostRoom(game?: string): {
  room: HostSession | null;
  snapshot: HostSnapshot | null;
} {
  const room = useSyncExternalStore(subscribe, () => getRoom(game));
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
