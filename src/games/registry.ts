import { spy } from './spy';
import { werewolf } from './werewolf';
import type { GameModule } from './types';

export type { GameModule };

/** Every game in the app, in home-screen order. */
export const games: readonly GameModule[] = [spy, werewolf];

export const getGame = (id: string) => games.find((g) => g.id === id);
