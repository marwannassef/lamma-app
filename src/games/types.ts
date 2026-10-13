import type { Href } from 'expo-router';
import type { ImageSourcePropType } from 'react-native';

import type { I18nKey } from '@/core/i18n';

export interface GameModule {
  id: string;
  /** i18n key, e.g. 'spy:title'. */
  titleKey: I18nKey;
  /** i18n key for the one-line description on the home screen. */
  blurbKey: I18nKey;
  icon: ImageSourcePropType;
  minPlayers: number;
  maxPlayers: number;
  usesScores: boolean;
  usesPunishments: boolean;
  entryRoute: Href;
  /** False until the game's screens ship; the home tile then shows "Coming soon". */
  ready: boolean;
}
