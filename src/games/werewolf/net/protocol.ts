// Messages between the host phone and guest phones (docs/games/werewolf-network.md §3.4).
// Everything a guest sends is untrusted: the host parses it strictly and the engine validates it.
import type { PlayerId, SeatAction, SeatView, Theme } from '../engine';

/** Bumped on any incompatible change; phones on different versions can't play together. */
export const PROTOCOL = 1;

export const MAX_NAME = 24;

/** What a guest asks to do; the host turns it into a game event for that guest's seat. */
export type Intent =
  | { t: 'seen' }
  | { t: 'cupidLink'; lovers: [PlayerId, PlayerId] }
  | { t: 'seatAction'; action: SeatAction }
  | { t: 'hunterShoot'; target: PlayerId }
  | { t: 'passBadge'; to: PlayerId | null }
  | { t: 'mayorDecide'; pick: PlayerId | null };

export type GuestMsg =
  | { t: 'hello'; v: number; deviceId: string; name: string }
  | { t: 'intent'; intent: Intent }
  | { t: 'ping' };

export interface Lobby {
  theme: Theme;
  kids: boolean;
  /** Joined players in seating order. */
  names: string[];
  /** Which of `names` are connected right now. */
  online: boolean[];
}

export type RejectReason = 'version' | 'full' | 'started' | 'removed';

export type HostMsg =
  | { t: 'welcome'; v: number }
  | { t: 'lobby'; lobby: Lobby; seat: number }
  | { t: 'view'; rev: number; names: string[]; view: SeatView }
  | { t: 'reject'; reason: RejectReason }
  | { t: 'pong' };

const isInt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
const isSeatOrNull = (x: unknown): x is number | null => x === null || isInt(x);
const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

function parseAction(a: unknown): SeatAction | null {
  if (!isObj(a)) return null;
  switch (a.kind) {
    case 'dummy':
      return { kind: 'dummy' };
    case 'wolf':
      return Array.isArray(a.targets) && a.targets.length <= 2 && a.targets.every(isInt)
        ? { kind: 'wolf', targets: a.targets }
        : null;
    case 'seer':
    case 'sorcerer':
    case 'doctor':
    case 'serialKiller':
      return isInt(a.target) ? { kind: a.kind, target: a.target } : null;
    case 'witch':
      if (typeof a.heal !== 'boolean') return null;
      if (a.poison === undefined) return { kind: 'witch', heal: a.heal };
      return isInt(a.poison) ? { kind: 'witch', heal: a.heal, poison: a.poison } : null;
    default:
      return null;
  }
}

function parseIntent(i: unknown): Intent | null {
  if (!isObj(i)) return null;
  switch (i.t) {
    case 'seen':
      return { t: 'seen' };
    case 'cupidLink': {
      const l = i.lovers;
      return Array.isArray(l) && l.length === 2 && isInt(l[0]) && isInt(l[1])
        ? { t: 'cupidLink', lovers: [l[0], l[1]] }
        : null;
    }
    case 'seatAction': {
      const action = parseAction(i.action);
      return action ? { t: 'seatAction', action } : null;
    }
    case 'hunterShoot':
      return isInt(i.target) ? { t: 'hunterShoot', target: i.target } : null;
    case 'passBadge':
      return isSeatOrNull(i.to) ? { t: 'passBadge', to: i.to } : null;
    case 'mayorDecide':
      return isSeatOrNull(i.pick) ? { t: 'mayorDecide', pick: i.pick } : null;
    default:
      return null;
  }
}

/** A guest's message, or null when it isn't one (malformed, unknown, oversized). */
export function parseGuestMsg(text: string): GuestMsg | null {
  if (text.length > 4096) return null;
  let m: unknown;
  try {
    m = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(m)) return null;
  switch (m.t) {
    case 'hello': {
      const name = typeof m.name === 'string' ? m.name.trim().slice(0, MAX_NAME) : '';
      if (!isInt(m.v) || typeof m.deviceId !== 'string' || !m.deviceId || m.deviceId.length > 64)
        return null;
      return { t: 'hello', v: m.v, deviceId: m.deviceId, name };
    }
    case 'intent': {
      const intent = parseIntent(m.intent);
      return intent ? { t: 'intent', intent } : null;
    }
    case 'ping':
      return { t: 'ping' };
    default:
      return null;
  }
}

/** The host's message. The host is trusted to send well-formed data, so only the shape is checked. */
export function parseHostMsg(text: string): HostMsg | null {
  try {
    const m: unknown = JSON.parse(text);
    return isObj(m) && typeof m.t === 'string' ? (m as HostMsg) : null;
  } catch {
    return null;
  }
}

export const encode = (m: GuestMsg | HostMsg) => JSON.stringify(m);
