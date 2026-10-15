// Test helpers only (not used by the app).
import { newGame } from './reducer';
import {
  DEFAULT_RULES,
  emptyNightActions,
  type GameState,
  type HouseRules,
  type RoleId,
} from './types';

/** A game in the middle of night 1 with the given seats (roles in seat order). */
export function game(
  roles: RoleId[],
  opts: Partial<Omit<GameState, 'rules'>> & { rules?: Partial<HouseRules>; dead?: number[] } = {},
): GameState {
  const { rules, dead = [], ...rest } = opts;
  const base = newGame(roles, { ...DEFAULT_RULES, ...rules });
  return {
    ...base,
    night: 1,
    day: 0,
    phase: { t: 'nightIntro', night: 1 },
    actions: emptyNightActions(),
    ...rest,
    players: base.players.map((p) => ({ ...p, alive: !dead.includes(p.id) })),
  };
}
