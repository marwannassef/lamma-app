import type { Href } from 'expo-router';

import type { GameModule } from '../types';
import { werewolf } from './index';

/**
 * The Mafia tile (§15.4): the same game as Werewolf with the Mafia theme picked. It shares
 * Werewolf's engine, setups, free-tier limits and scoreboard.
 */
export const mafia: GameModule = {
  ...werewolf,
  id: 'mafia',
  titleKey: 'games.mafia.title',
  blurbKey: 'games.mafia.blurb',
  icon: require('@/assets/images/games/mafia.png'),
  entryRoute: { pathname: '/games/werewolf', params: { theme: 'mafia' } } as Href,
};
