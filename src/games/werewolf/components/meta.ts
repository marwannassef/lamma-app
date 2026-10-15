import type { RoleId, Team } from '../engine';

/** Placeholder role art (§11: a large glyph on a team-colour gradient until the art ships). */
export const ROLE_GLYPH: Record<RoleId, string> = {
  villager: '🧑‍🌾',
  werewolf: '🐺',
  alpha: '👑',
  wolfCub: '🐾',
  loneWolf: '🌑',
  sorcerer: '🧙',
  seer: '🔮',
  apprenticeSeer: '📖',
  doctor: '🩺',
  witch: '🧪',
  hunter: '🏹',
  cupid: '💘',
  mayor: '🎖️',
  lycan: '🌕',
  cursed: '🩸',
  tanner: '🪢',
  serialKiller: '🔪',
};

/** Team colours (§11). */
export const TEAM_COLOR: Record<Team | 'lovers', string> = {
  village: '#4F8FDB',
  wolves: '#D23C82',
  neutral: '#EF7A3C',
  lovers: '#FF6FB5',
};

export const TEAM_GRADIENT: Record<Team, readonly [string, string]> = {
  village: ['#4F8FDB', '#2B4F9E'],
  wolves: ['#D23C82', '#5B1440'],
  neutral: ['#EF7A3C', '#8C3A12'],
};

/** Commissioned role art. Roles without art yet fall back to ROLE_GLYPH. */
export const ROLE_ART: Partial<Record<RoleId, number>> = {
  villager: require('@/assets/images/roles/villager.png'),
  werewolf: require('@/assets/images/roles/werewolf.png'),
  alpha: require('@/assets/images/roles/alpha.png'),
  seer: require('@/assets/images/roles/seer.png'),
  doctor: require('@/assets/images/roles/doctor.png'),
  witch: require('@/assets/images/roles/witch.png'),
  hunter: require('@/assets/images/roles/hunter.png'),
  cupid: require('@/assets/images/roles/cupid.png'),
  mayor: require('@/assets/images/roles/mayor.png'),
  tanner: require('@/assets/images/roles/tanner.png'),
};
