import { getLocales } from 'expo-localization';

import type { Theme } from './engine';

/**
 * Where people mostly know this game as Mafia (§15.4): the Arab world, Russia and Eastern Europe,
 * and Italy. Elsewhere Werewolf comes first.
 */
const MAFIA_FIRST = new Set([
  // Arab world
  'EG',
  'SA',
  'AE',
  'KW',
  'QA',
  'BH',
  'OM',
  'JO',
  'LB',
  'SY',
  'IQ',
  'PS',
  'YE',
  'LY',
  'TN',
  'DZ',
  'MA',
  'SD',
  'MR',
  'DJ',
  'SO',
  'KM',
  // Russia and Eastern Europe
  'RU',
  'UA',
  'BY',
  'PL',
  'CZ',
  'SK',
  'HU',
  'RO',
  'BG',
  'RS',
  'HR',
  'BA',
  'SI',
  'MK',
  'ME',
  'AL',
  'MD',
  'LT',
  'LV',
  'EE',
  'GE',
  'AM',
  'AZ',
  'KZ',
  'UZ',
  'KG',
  'TJ',
  'TM',
  // Italy
  'IT',
  'SM',
  'VA',
]);

/** The theme shown first for a device region. */
export function regionTheme(region = getLocales()[0]?.regionCode): Theme {
  return region && MAFIA_FIRST.has(region.toUpperCase()) ? 'mafia' : 'werewolf';
}

export const isTheme = (v: unknown): v is Theme => v === 'werewolf' || v === 'mafia';
