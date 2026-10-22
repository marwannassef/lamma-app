import type { RoleId, Team } from '../engine';

/** Emoji for each role, for plain-text places (role art is ROLE_ART). */
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

/** Role art (scripts/generate-role-art.py), in the style of the Werewolf game logo. */
export const ROLE_ART: Record<RoleId, number> = {
  villager: require('@/assets/images/roles/villager.png'),
  werewolf: require('@/assets/images/roles/werewolf.png'),
  alpha: require('@/assets/images/roles/alpha.png'),
  wolfCub: require('@/assets/images/roles/wolf-cub.png'),
  loneWolf: require('@/assets/images/roles/lone-wolf.png'),
  sorcerer: require('@/assets/images/roles/sorcerer.png'),
  seer: require('@/assets/images/roles/seer.png'),
  apprenticeSeer: require('@/assets/images/roles/apprentice-seer.png'),
  doctor: require('@/assets/images/roles/doctor.png'),
  witch: require('@/assets/images/roles/witch.png'),
  hunter: require('@/assets/images/roles/hunter.png'),
  cupid: require('@/assets/images/roles/cupid.png'),
  mayor: require('@/assets/images/roles/mayor.png'),
  lycan: require('@/assets/images/roles/lycan.png'),
  cursed: require('@/assets/images/roles/cursed.png'),
  tanner: require('@/assets/images/roles/tanner.png'),
  serialKiller: require('@/assets/images/roles/serial-killer.png'),
};

/** Mafia theme role art (scripts/generate-mafia-art.py): noir case-file portraits, no weapons (§15.3). */
export const MAFIA_ROLE_ART: Record<RoleId, number> = {
  villager: require('@/assets/images/mafia-roles/villager.png'),
  werewolf: require('@/assets/images/mafia-roles/werewolf.png'),
  alpha: require('@/assets/images/mafia-roles/alpha.png'),
  wolfCub: require('@/assets/images/mafia-roles/wolf-cub.png'),
  loneWolf: require('@/assets/images/mafia-roles/lone-wolf.png'),
  sorcerer: require('@/assets/images/mafia-roles/sorcerer.png'),
  seer: require('@/assets/images/mafia-roles/seer.png'),
  apprenticeSeer: require('@/assets/images/mafia-roles/apprentice-seer.png'),
  doctor: require('@/assets/images/mafia-roles/doctor.png'),
  witch: require('@/assets/images/mafia-roles/witch.png'),
  hunter: require('@/assets/images/mafia-roles/hunter.png'),
  cupid: require('@/assets/images/mafia-roles/cupid.png'),
  mayor: require('@/assets/images/mafia-roles/mayor.png'),
  lycan: require('@/assets/images/mafia-roles/lycan.png'),
  cursed: require('@/assets/images/mafia-roles/cursed.png'),
  tanner: require('@/assets/images/mafia-roles/tanner.png'),
  serialKiller: require('@/assets/images/mafia-roles/serial-killer.png'),
};
