import { spy } from './spy';
import type { GameModule } from './types';

export type { GameModule };

/** Every game in the app, in home-screen order. */
export const games: readonly GameModule[] = [spy];

export const getGame = (id: string) => games.find((g) => g.id === id);
