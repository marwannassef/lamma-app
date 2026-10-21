import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { usePlayerName } from '@/core/players';

import { storyKey, type GameState, type StoryLine } from '../engine';

/** Turns dawn story lines (§16) into sentences in the game's theme, language and Kids mode. */
export function useStoryText() {
  const { t } = useTranslation(['werewolf', 'common']);
  const nameOf = usePlayerName();
  return useCallback(
    (g: GameState, lines: readonly StoryLine[]): string[] => {
      const scene = g.story.setting
        ? t(`story.${g.theme}.settings.${g.story.setting}.scene` as never)
        : '';
      return lines.map((l) => {
        const variants = t(storyKey(l, g.theme, g.kids) as never, {
          returnObjects: true,
          scene,
          count: l.count,
          name: l.name != null ? nameOf(l.name) : '',
          lover: l.lover != null ? nameOf(l.lover) : '',
          names: (l.names ?? []).map(nameOf).join(t('common:list.and')),
        }) as unknown;
        return Array.isArray(variants) ? String(variants[l.variant] ?? variants[0] ?? '') : '';
      });
    },
    [nameOf, t],
  );
}
