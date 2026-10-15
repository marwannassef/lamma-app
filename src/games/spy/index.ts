import type { GameModule } from '../types';

export const spy: GameModule = {
  id: 'spy',
  titleKey: 'spy:title',
  blurbKey: 'spy:blurb',
  icon: require('@/assets/images/games/spy.png'),
  minPlayers: 3,
  maxPlayers: 12,
  usesScores: true,
  usesPunishments: true,
  entryRoute: '/games/spy',
  ready: true,
};
