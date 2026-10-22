import { createContext, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { useContentLevel } from '@/core/age';

import type { Theme } from '../engine';
import { useWerewolf } from '../store';

/**
 * A guest phone in a network game shows the host's theme and Kids mode, not its own (the
 * host's content level applies to the room, werewolf-network.md §6).
 */
export const GameLookContext = createContext<{ theme: Theme; kids: boolean } | null>(null);

/**
 * The theme on screen: the home tile opened (Werewolf or Mafia), or the host's on a guest phone.
 * A game only plays in the theme it was started in, since Resume is offered only from its own tile.
 */
export function useGameTheme(): Theme {
  const look = useContext(GameLookContext);
  const own = useWerewolf((s) => s.theme);
  return look?.theme ?? own;
}

/**
 * `t` for Werewolf screens, in the game's theme (§15): Mafia strings come from the `mafia`
 * namespace and anything it doesn't override falls back to `werewolf`. In Kids mode a `<key>Kids`
 * variant wins when there is one (e.g. the Serial Killer is "The Shadow").
 */
export function useWerewolfT(extra: readonly 'common'[] = []) {
  const theme = useGameTheme();
  const level = useContentLevel();
  const look = useContext(GameLookContext);
  const own = useWerewolf((s) => s.game?.kids) ?? level === 'kids';
  const kids = look?.kids ?? own;
  const { t, i18n } = useTranslation(['werewolf', ...extra]);
  const themed = useCallback(
    (key: unknown, opts?: Record<string, unknown>) => {
      if (typeof key !== 'string' || key.includes(':')) return t(key as never, opts as never);
      const ns = theme === 'mafia' ? ['mafia', 'werewolf'] : ['werewolf'];
      const keys = kids ? [`${key}Kids`, key] : key;
      return t(keys as never, { ...opts, ns } as never);
    },
    [kids, t, theme],
  ) as unknown as typeof t;
  return { t: themed, i18n, theme, kids };
}
