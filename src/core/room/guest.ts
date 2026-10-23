// A guest phone's side of a network game (docs/games/werewolf-network.md §3.5), for any game.
// It keeps what the host sends and reconnects with the same device id when the connection drops.
import type { Client, Transport } from '@/core/net';

import {
  encode,
  parseHostMsg,
  PROTOCOL,
  type GuestMsg,
  type Lobby,
  type RejectReason,
} from './protocol';
import { SILENCE_MS } from './host';

export const PING_MS = 2000;
/** Waits between reconnect attempts; the last one repeats. */
export const RETRY_MS = [500, 1000, 2000, 4000];

export type GuestStatus =
  /** First connection attempt. */
  | 'connecting'
  /** Joined, waiting for the host to start. */
  | 'lobby'
  | 'playing'
  /** Lost the host; trying again. */
  | 'reconnecting'
  /** The host said no (see `reason`); no more retries. */
  | 'rejected'
  /** Left on purpose. */
  | 'closed';

export interface GuestSnapshot {
  status: GuestStatus;
  reason: RejectReason | null;
  lobby: Lobby | null;
  /** This phone's seat in the lobby or game. */
  seat: number | null;
  names: string[];
  /** The running game's id, and this seat's view of it (the game's own type). */
  game: string | null;
  view: unknown;
  /** Connection attempts that failed in a row, and the last reason (shown to help fix it). */
  failures: number;
  error: string | null;
}

export interface GuestOptions {
  transport: Transport;
  address: string;
  deviceId: string;
  name: string;
  now(): number;
  /** setTimeout-like; returns a cancel function. Injected so tests control time. */
  schedule(fn: () => void, ms: number): () => void;
}

export class GuestSession {
  private client: Client | null = null;
  /** Where to (re)connect: the given address, then the host's resolved one. */
  private address: string;
  private attempt = 0;
  private rev = 0;
  private lastHeard = 0;
  private cancelTimer: (() => void) | null = null;
  private listeners = new Set<() => void>();
  private snapshot: GuestSnapshot = {
    status: 'connecting',
    reason: null,
    lobby: null,
    seat: null,
    names: [],
    game: null,
    view: null,
    failures: 0,
    error: null,
  };

  constructor(private readonly opts: GuestOptions) {
    this.address = opts.address;
    void this.connect();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  /** Sends this phone's choice; the host checks it and answers with a new view. */
  send(intent: Record<string, unknown>) {
    this.write({ t: 'intent', intent });
  }

  /**
   * Call when the app comes back to the foreground: a connection that went quiet while the phone
   * slept is dropped now and redialled at once, instead of after the silence timeout.
   */
  wake() {
    if (this.done) return;
    this.attempt = 0;
    if (this.client && this.opts.now() - this.lastHeard > PING_MS * 1.5) this.client.close();
  }

  leave() {
    this.update({ status: 'closed' });
    this.stop();
  }

  private stop() {
    this.cancelTimer?.();
    this.cancelTimer = null;
    const c = this.client;
    this.client = null;
    c?.close();
  }

  private get done() {
    return this.snapshot.status === 'closed' || this.snapshot.status === 'rejected';
  }

  private async connect() {
    if (this.done) return;
    let client: Client;
    try {
      client = await this.opts.transport.connect(this.address, {
        onMessage: (text) => this.onMessage(client, text),
        onClose: () => this.onClose(client),
      });
    } catch (e) {
      this.update({
        failures: this.snapshot.failures + 1,
        error: e instanceof Error ? e.message : String(e),
      });
      return this.retry();
    }
    if (this.done) return client.close();
    this.client = client;
    // A room found by Bonjour is only reachable while browsing; its IP works after that too.
    if (client.remote) this.address = client.remote;
    this.lastHeard = this.opts.now();
    this.write({ t: 'hello', v: PROTOCOL, deviceId: this.opts.deviceId, name: this.opts.name });
    this.heartbeat();
  }

  private heartbeat() {
    this.cancelTimer = this.opts.schedule(() => {
      if (!this.client) return;
      if (this.opts.now() - this.lastHeard > SILENCE_MS) return this.client.close();
      this.write({ t: 'ping' });
      this.heartbeat();
    }, PING_MS);
  }

  private retry() {
    if (this.done) return;
    const wait = RETRY_MS[Math.min(this.attempt, RETRY_MS.length - 1)] as number;
    this.attempt += 1;
    this.cancelTimer = this.opts.schedule(() => void this.connect(), wait);
  }

  private onClose(client: Client) {
    if (client !== this.client) return;
    this.client = null;
    this.cancelTimer?.();
    this.cancelTimer = null;
    // (Leaving or a rejection clears `client` before closing, so they never get here.)
    if (this.snapshot.status !== 'connecting') this.update({ status: 'reconnecting' });
    this.retry();
  }

  private onMessage(client: Client, text: string) {
    if (client !== this.client) return;
    this.lastHeard = this.opts.now();
    const m = parseHostMsg(text);
    if (!m) return;
    switch (m.t) {
      case 'welcome':
        if (this.snapshot.failures) this.update({ failures: 0, error: null });
        // A new connection (maybe to a relaunched host) numbers its views from scratch.
        this.attempt = 0;
        this.rev = 0;
        return;
      case 'lobby':
        return this.update({
          status: 'lobby',
          lobby: m.lobby,
          seat: m.seat,
          view: null,
          game: null,
        });
      case 'view':
        // The host numbers views; an older one can't replace a newer one.
        if (m.rev <= this.rev) return;
        this.rev = m.rev;
        return this.update({
          status: 'playing',
          game: m.game,
          seat: m.seat,
          view: m.view,
          names: m.names,
        });
      case 'reject':
        this.update({ status: 'rejected', reason: m.reason });
        return this.stop();
      case 'pong':
        return;
    }
  }

  private write(m: GuestMsg) {
    this.client?.send(encode(m));
  }

  private update(patch: Partial<GuestSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }
}
