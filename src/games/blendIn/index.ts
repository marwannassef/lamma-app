import type { GameModule } from '../types';

export const blendIn: GameModule = {
  id: 'blendIn',
  titleKey: 'blendIn:title',
  blurbKey: 'blendIn:blurb',
  icon: require('@/assets/images/games/blend-in.png'),
  minPlayers: 3,
  maxPlayers: 12,
  usesScores: true,
  usesPunishments: true,
  entryRoute: '/games/blend-in',
  ready: true,
};
