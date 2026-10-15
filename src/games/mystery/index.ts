import type { GameModule } from '../types';

/** A teaser for the next game: no name, no details, just a locked "???" card. */
export const mystery: GameModule = {
  id: 'mystery',
  titleKey: 'games.mystery.title',
  blurbKey: 'games.mystery.blurb',
  icon: require('@/assets/images/games/mystery.png'),
  minPlayers: 0,
  maxPlayers: 0,
  usesScores: false,
  usesPunishments: false,
  entryRoute: '/games/mystery',
  ready: false,
  mystery: true,
};
