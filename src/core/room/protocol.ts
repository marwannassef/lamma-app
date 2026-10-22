// Messages between a host phone and guest phones in any game's network mode
// (docs/games/werewolf-network.md §3.4). The room is game-agnostic: a game's views and intents
// travel as opaque objects, and the game checks every intent itself.
import { MAX_NAME_LENGTH } from '@/core/players';

/**
 * Bumped on any incompatible change; phones on different versions can't play together.
 * v2: rooms carry their game (Werewolf, Spy, Blend In), so one "Join a game" fits all.
 */
export const PROTOCOL = 2;

/** Names are cut like the roster's, so they fit the same screens. */
export const MAX_NAME = MAX_NAME_LENGTH;

/** Largest message a guest may send; a game's intents are tiny. */
const MAX_GUEST_MESSAGE = 4096;

export type GuestMsg =
  | { t: 'hello'; v: number; deviceId: string; name: string }
  /** A game-specific request for this phone's own seat; the game validates it. */
  | { t: 'intent'; intent: Record<string, unknown> }
  | { t: 'ping' };

export interface Lobby {
  /** The game being set up: a game module id ('werewolf', 'spy', 'blendIn'). */
  game: string;
  /** The game's theme, when it has one (Werewolf's 'werewolf' or 'mafia'). */
  theme: string | null;
  kids: boolean;
  /** Joined players in seating order. */
  names: string[];
  /** Which of `names` are connected right now. */
  online: boolean[];
  /** The host player's seat in `names`. */
  host: number;
}

/** Why a phone can't (or can no longer) play in this room. 'closed': the host ended the room. */
export type RejectReason = 'version' | 'full' | 'started' | 'removed' | 'closed';

export type HostMsg =
  | { t: 'welcome'; v: number }
  | { t: 'lobby'; lobby: Lobby; seat: number }
  /** This seat's view of the running game (game-specific), numbered so the newest wins. */
  | { t: 'view'; rev: number; game: string; seat: number; names: string[]; view: unknown }
  | { t: 'reject'; reason: RejectReason }
  | { t: 'pong' };

const isInt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
export const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** A guest's message, or null when it isn't one (malformed, unknown, oversized). */
export function parseGuestMsg(text: string): GuestMsg | null {
  if (text.length > MAX_GUEST_MESSAGE) return null;
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
    case 'intent':
      return isObj(m.intent) ? { t: 'intent', intent: m.intent } : null;
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
