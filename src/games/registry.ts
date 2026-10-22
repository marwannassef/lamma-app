import { blendIn } from './blendIn';
import { mystery } from './mystery';
import { spy } from './spy';
import { werewolf } from './werewolf';
import { mafia } from './werewolf/mafia';
import type { Theme } from './werewolf/engine';
import type { GameModule } from './types';

export type { GameModule };

/** Every game in the app, in home-screen order. */
export const games: readonly GameModule[] = [spy, werewolf, mafia, blendIn, mystery];

/** Home-screen order: Werewolf and Mafia swap so the theme people know best comes first (§15.4). */
export function homeOrder(list: readonly GameModule[], first: Theme): GameModule[] {
  if (first === 'werewolf') return [...list];
  return list.map((g) => (g.id === 'werewolf' ? mafia : g.id === 'mafia' ? werewolf : g));
}

export const getGame = (id: string) => games.find((g) => g.id === id);
