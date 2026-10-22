// The host phone's side of a network game (docs/games/werewolf-network.md §3). It owns the
// room: who joined, their seats, and which phone gets which view. The game itself stays in the
// Werewolf store; this session only reads it and dispatches validated events.
import type { Peer, Server, Transport } from '@/core/net';

import {
  actingSeat,
  MAX_PLAYERS,
  viewFor,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Theme,
} from '../engine';
import { encode, parseGuestMsg, PROTOCOL, type HostMsg, type Intent, type Lobby } from './protocol';

/** A guest that hasn't been heard from for this long is treated as gone (it pings every 2 s). */
export const SILENCE_MS = 8000;

export interface Member {
  deviceId: string;
  name: string;
  /** The host's own seat: always "online", it plays on this phone. */
  isHost: boolean;
}

export interface HostSnapshot {
  address: string;
  members: (Member & { online: boolean })[];
  started: boolean;
}

export interface HostOptions {
  transport: Transport;
  /** The host player, who also plays on this phone. */
  host: { deviceId: string; name: string };
  theme: Theme;
  kids: boolean;
  /** The game in the store, or null while still in the lobby. */
  getGame(): GameState | null;
  /** Applies an event to the store's game. */
  dispatch(e: GameEvent): void;
  now(): number;
  /** Players from before a relaunch, so their phones can rejoin the same seats. */
  members?: Member[];
}

/** Turns a guest's intent into an event for their own seat, or null if it isn't theirs to send. */
export function eventFor(game: GameState, seat: PlayerId, intent: Intent): GameEvent | null {
  switch (intent.t) {
    case 'seen':
      return { t: 'seatSeen', seat };
    case 'cupidLink':
      return { t: 'cupidLink', lovers: intent.lovers, seat };
    case 'seatAction':
      return { t: 'seatAction', seat, action: intent.action };
    case 'hunterShoot':
    case 'passBadge':
    case 'mayorDecide':
      return actingSeat(game) === seat ? intent : null;
  }
}

export class HostSession {
  private server: Server | null = null;
  private members: Member[];
  /** Live connection per device id. */
  private peers = new Map<string, Peer>();
  /** Connections that haven't said hello yet, by connection id. */
  private pending = new Map<string, { peer: Peer; since: number }>();
  private deviceOf = new Map<string, string>();
  private lastSeen = new Map<string, number>();
  private sent = new Map<string, string>();
  private rev = 0;
  private listeners = new Set<() => void>();
  private snapshot: HostSnapshot;

  private readonly handlers = {
    onOpen: (peer: Peer) => this.onOpen(peer),
    onMessage: (peerId: string, text: string) => this.onMessage(peerId, text),
    onClose: (peerId: string) => this.onClose(peerId),
  };

  private constructor(private readonly opts: HostOptions) {
    this.members = opts.members ?? [{ ...opts.host, isHost: true }];
    this.snapshot = this.makeSnapshot();
  }

  static async open(opts: HostOptions): Promise<HostSession> {
    const session = new HostSession(opts);
    session.server = await opts.transport.listen(session.handlers);
    session.changed();
    return session;
  }

  // --- for the host's screens ---

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  /** The host player's seat in the current seating. */
  get hostSeat(): PlayerId {
    return this.members.findIndex((m) => m.isHost);
  }

  get seating(): readonly Member[] {
    return this.members;
  }

  /** Reorders the lobby into seating order (drag to seat). */
  move(from: number, to: number) {
    if (this.started || !this.members[from] || !this.members[to]) return;
    const next = this.members.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m as Member);
    this.members = next;
    this.changed();
  }

  /** Removes a guest from the lobby; their phone is told and disconnected. */
  remove(deviceId: string) {
    const m = this.members.find((x) => x.deviceId === deviceId);
    if (this.started || !m || m.isHost) return;
    this.members = this.members.filter((x) => x !== m);
    const peer = this.peers.get(deviceId);
    peer?.send(encode({ t: 'reject', reason: 'removed' }));
    peer?.close();
    this.changed();
  }

  /** Acts for a seat on this phone: the host's own seat, or an offline guest's (§3.5). */
  actFor(seat: PlayerId, intent: Intent) {
    const game = this.opts.getGame();
    const e = game && eventFor(game, seat, intent);
    if (e) this.opts.dispatch(e);
    this.sync();
  }

  /** Call after the game in the store changes, so every phone gets its new view. */
  sync() {
    this.broadcast();
    this.changed();
  }

  /** Drops phones that went quiet (call about once a second). */
  tick() {
    const now = this.opts.now();
    for (const [deviceId, peer] of this.peers) {
      if (now - (this.lastSeen.get(deviceId) ?? now) > SILENCE_MS) peer.close();
    }
    for (const { peer, since } of this.pending.values()) {
      if (now - since > SILENCE_MS) peer.close();
    }
  }

  /**
   * Ends the room. With `goodbye`, every phone is told the room closed (so it stops trying to
   * reconnect); without it, they keep retrying, e.g. while the host app restarts.
   */
  close(goodbye = false) {
    if (goodbye) {
      for (const peer of this.peers.values()) {
        peer.send(encode({ t: 'reject', reason: 'closed' }));
        peer.close();
      }
    }
    this.server?.close();
    this.server = null;
    this.listeners.clear();
  }

  /**
   * Listens again on the same port, e.g. after the app was in the background (iOS suspends its
   * sockets there). Phones reconnect on their own and get their seats back.
   */
  async relisten() {
    this.server?.close();
    this.server = await this.opts.transport.listen(this.handlers);
    this.changed();
  }

  // --- network ---

  private get started() {
    return this.opts.getGame() != null;
  }

  private onOpen(peer: Peer) {
    // Remember the connection until its hello says which device it is.
    this.pending.set(peer.id, { peer, since: this.opts.now() });
  }

  private onMessage(peerId: string, text: string) {
    const msg = parseGuestMsg(text);
    const deviceId = this.deviceOf.get(peerId);
    if (deviceId) this.lastSeen.set(deviceId, this.opts.now());
    if (!msg) return;
    if (msg.t === 'hello') return this.hello(peerId, msg);
    const peer = deviceId ? this.peers.get(deviceId) : undefined;
    if (!peer || !deviceId) return;
    if (msg.t === 'ping') return peer.send(encode({ t: 'pong' }));
    const seat = this.members.findIndex((m) => m.deviceId === deviceId);
    const game = this.opts.getGame();
    const e = game && seat >= 0 ? eventFor(game, seat, msg.intent) : null;
    if (e) this.opts.dispatch(e);
    // Rejected or not, the phone gets its current view back so it can't get stuck.
    this.sent.delete(deviceId);
    this.sync();
  }

  private hello(peerId: string, msg: { v: number; deviceId: string; name: string }) {
    const peer = this.pending.get(peerId)?.peer;
    if (!peer) return;
    this.pending.delete(peerId);
    const reject = (reason: 'version' | 'full' | 'started') => {
      peer.send(encode({ t: 'reject', reason }));
      peer.close();
    };
    if (msg.v !== PROTOCOL) return reject('version');
    const known = this.members.find((m) => m.deviceId === msg.deviceId);
    if (known?.isHost) return reject('started');
    if (!known) {
      if (this.started) return reject('started');
      if (this.members.length >= MAX_PLAYERS) return reject('full');
      this.members = [...this.members, { deviceId: msg.deviceId, name: msg.name, isHost: false }];
    } else if (!this.started && msg.name) {
      this.members = this.members.map((m) => (m === known ? { ...m, name: msg.name } : m));
    }
    // A rejoining phone replaces its old connection.
    const old = this.peers.get(msg.deviceId);
    if (old && old.id !== peerId) {
      this.deviceOf.delete(old.id);
      old.close();
    }
    this.peers.set(msg.deviceId, peer);
    this.deviceOf.set(peerId, msg.deviceId);
    this.lastSeen.set(msg.deviceId, this.opts.now());
    this.sent.delete(msg.deviceId);
    peer.send(encode({ t: 'welcome', v: PROTOCOL }));
    this.sync();
  }

  private onClose(peerId: string) {
    this.pending.delete(peerId);
    const deviceId = this.deviceOf.get(peerId);
    if (!deviceId) return;
    this.deviceOf.delete(peerId);
    // A replaced connection was already forgotten in hello(), so this is the live one.
    this.peers.delete(deviceId);
    this.sent.delete(deviceId);
    this.changed();
  }

  private lobby(): Lobby {
    return {
      theme: this.opts.theme,
      kids: this.opts.kids,
      names: this.members.map((m) => m.name),
      online: this.members.map((m) => m.isHost || this.peers.has(m.deviceId)),
      host: this.hostSeat,
    };
  }

  /** Sends each connected phone its lobby or game view, only when it changed. */
  private broadcast() {
    const game = this.opts.getGame();
    const names = this.members.map((m) => m.name);
    this.members.forEach((m, seat) => {
      const peer = this.peers.get(m.deviceId);
      if (!peer) return;
      const body: HostMsg =
        game && seat < game.players.length
          ? { t: 'view', rev: 0, names, view: viewFor(game, seat) }
          : { t: 'lobby', lobby: this.lobby(), seat };
      const key = JSON.stringify(body);
      if (this.sent.get(m.deviceId) === key) return;
      this.sent.set(m.deviceId, key);
      peer.send(encode(body.t === 'view' ? { ...body, rev: ++this.rev } : body));
    });
  }

  private makeSnapshot(): HostSnapshot {
    return {
      address: this.server?.address ?? '',
      members: this.members.map((m) => ({ ...m, online: m.isHost || this.peers.has(m.deviceId) })),
      started: this.started,
    };
  }

  private changed() {
    const next = this.makeSnapshot();
    if (JSON.stringify(next) === JSON.stringify(this.snapshot)) return;
    this.snapshot = next;
    // Lobby changes reach the guests too.
    if (!next.started) this.broadcast();
    this.listeners.forEach((l) => l());
  }
}
