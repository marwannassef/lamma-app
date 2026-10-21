import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useContentLevel } from '@/core/age';

import type { Theme } from '../engine';
import { useWerewolf } from '../store';

/** The theme on screen: the running game's, or the one picked in setup. */
export const useGameTheme = (): Theme => useWerewolf((s) => s.game?.theme ?? s.theme);

/**
 * `t` for Werewolf screens, in the game's theme (§15): Mafia strings come from the `mafia`
 * namespace and anything it doesn't override falls back to `werewolf`. In Kids mode a `<key>Kids`
 * variant wins when there is one (e.g. the Serial Killer is "The Shadow").
 */
export function useWerewolfT(extra: readonly 'common'[] = []) {
  const theme = useGameTheme();
  const level = useContentLevel();
  const kids = useWerewolf((s) => s.game?.kids) ?? level === 'kids';
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
