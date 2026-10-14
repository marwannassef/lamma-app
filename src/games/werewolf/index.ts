import type { GameModule } from '../types';

export const werewolf: GameModule = {
  id: 'werewolf',
  titleKey: 'games.werewolf.title',
  blurbKey: 'games.werewolf.blurb',
  icon: require('@/assets/images/games/werewolf.png'),
  minPlayers: 6,
  maxPlayers: 12,
  usesScores: false,
  usesPunishments: false,
  entryRoute: '/games/werewolf',
  ready: false,
};
