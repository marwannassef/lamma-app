import type { Href } from 'expo-router';

import type { GameModule } from '../types';

export const werewolf: GameModule = {
  id: 'werewolf',
  titleKey: 'games.werewolf.title',
  blurbKey: 'games.werewolf.blurb',
  icon: require('@/assets/images/games/werewolf.png'),
  minPlayers: 4,
  maxPlayers: 20,
  usesScores: true,
  usesPunishments: true,
  entryRoute: { pathname: '/games/werewolf', params: { theme: 'werewolf' } } as Href,
  ready: true,
};
