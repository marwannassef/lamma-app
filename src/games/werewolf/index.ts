import type { GameModule } from '../types';

export const werewolf: GameModule = {
  id: 'werewolf',
  titleKey: 'games.werewolf.title',
  blurbKey: 'games.werewolf.blurb',
  icon: require('@/assets/images/games/werewolf.png'),
  minPlayers: 4,
  maxPlayers: 16,
  usesScores: true,
  usesPunishments: true,
  entryRoute: '/games/werewolf',
  ready: false,
};
