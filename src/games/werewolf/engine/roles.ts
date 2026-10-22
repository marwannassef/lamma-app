import type { GameState, Player, PlayerId, RoleDef, RoleId, Team } from './types';

const role = (
  id: RoleId,
  team: Team,
  nightAction: RoleDef['nightAction'],
  opts: Partial<Pick<RoleDef, 'isPackWolf' | 'seerSeesAs' | 'maxPerGame' | 'release'>> = {},
): RoleDef => ({
  id,
  team,
  nightAction,
  isPackWolf: opts.isPackWolf ?? false,
  seerSeesAs: opts.seerSeesAs ?? (opts.isPackWolf ? 'werewolf' : 'innocent'),
  maxPerGame: opts.maxPerGame ?? 1,
  i18nKey: `roles.${id}`,
  release: opts.release ?? 'core',
});

/** Role registry (§3). Adding a role means adding an entry here, not touching the engine core. */
export const ROLES: Record<RoleId, RoleDef> = {
  villager: role('villager', 'village', 'none', { maxPerGame: 20 }),
  werewolf: role('werewolf', 'wolves', 'wolfKill', { isPackWolf: true, maxPerGame: 4 }),
  alpha: role('alpha', 'wolves', 'wolfKill', { isPackWolf: true }),
  seer: role('seer', 'village', 'inspectWolf'),
  doctor: role('doctor', 'village', 'protect'),
  witch: role('witch', 'village', 'witch'),
  hunter: role('hunter', 'village', 'none'),
  cupid: role('cupid', 'village', 'none'),
  tanner: role('tanner', 'neutral', 'none'),
  wolfCub: role('wolfCub', 'wolves', 'wolfKill', { isPackWolf: true, release: 'expansion' }),
  loneWolf: role('loneWolf', 'wolves', 'wolfKill', { isPackWolf: true, release: 'expansion' }),
  sorcerer: role('sorcerer', 'wolves', 'inspectSeer', { release: 'expansion' }),
  apprenticeSeer: role('apprenticeSeer', 'village', 'none', { release: 'expansion' }),
  mayor: role('mayor', 'village', 'none', { release: 'expansion' }),
  lycan: role('lycan', 'village', 'none', { seerSeesAs: 'werewolf', release: 'expansion' }),
  cursed: role('cursed', 'village', 'none', { release: 'expansion' }),
  serialKiller: role('serialKiller', 'neutral', 'soloKill', { release: 'expansion' }),
};

export const ALL_ROLES = Object.keys(ROLES) as RoleId[];
export const CORE_ROLES = ALL_ROLES.filter((r) => ROLES[r].release === 'core');

export const isPackWolf = (r: RoleId) => ROLES[r].isPackWolf;
export const teamOf = (r: RoleId): Team => ROLES[r].team;

export const living = (s: GameState) => s.players.filter((p) => p.alive);
export const player = (s: GameState, id: PlayerId): Player => {
  const p = s.players[id];
  if (!p) throw new Error(`no player ${id}`);
  return p;
};
export const livingWith = (s: GameState, r: RoleId) => living(s).filter((p) => p.role === r);

/** Lovers on different teams play for themselves (team "lovers"). */
export function crossTeamLovers(s: GameState): boolean {
  if (!s.lovers) return false;
  const [a, b] = s.lovers.map((id) => teamOf(player(s, id).role));
  return a !== b;
}

export const isCrossLover = (s: GameState, id: PlayerId) =>
  crossTeamLovers(s) && (s.lovers?.includes(id) ?? false);

/** Pack members a wolf sees on their screens (the Sorcerer is not one of them). */
export const packOf = (s: GameState) => s.players.filter((p) => isPackWolf(p.role));

/** What the Seer learns about a player. */
export const seerSees = (s: GameState, target: PlayerId) =>
  ROLES[player(s, target).role].seerSeesAs;

/** What the Sorcerer learns: is this player the (current) Seer? */
export const sorcererSees = (s: GameState, target: PlayerId) => player(s, target).role === 'seer';
