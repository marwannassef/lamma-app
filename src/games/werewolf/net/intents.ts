// What a Werewolf/Mafia guest phone may ask for its own seat (werewolf-network.md §3.1). The room
// passes these through untouched; they're parsed strictly here, then checked by the engine.
import { isObj } from '@/core/room';

import type { PlayerId, SeatAction } from '../engine';

/** What a guest asks to do; the host turns it into a game event for that guest's seat. */
export type Intent =
  | { t: 'seen' }
  | { t: 'cupidLink'; lovers: [PlayerId, PlayerId] }
  | { t: 'seatAction'; action: SeatAction }
  | { t: 'hunterShoot'; target: PlayerId }
  | { t: 'passBadge'; to: PlayerId | null }
  | { t: 'mayorDecide'; pick: PlayerId | null };

const isInt = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
const isSeatOrNull = (x: unknown): x is number | null => x === null || isInt(x);

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

/** A Werewolf intent, or null when it isn't one. */
export function parseIntent(i: unknown): Intent | null {
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
