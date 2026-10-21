import type { Resource } from 'i18next';

import { localeFiles as ctx } from './localeFiles';

export interface LocaleMeta {
  /** Name in its own language, shown in the language picker. */
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

// Every locales/<code>/<namespace>.json is picked up here, so adding a locale means adding files.
// meta.json describes the locale; native.json holds store/home-screen names for app.config.ts.

export const resources: Resource = {};
export const localeMeta: Record<string, LocaleMeta> = {};

for (const key of ctx.keys()) {
  const match = /^\.\/([A-Za-z-]+)\/([A-Za-z]+)\.json$/.exec(key);
  if (!match) continue;
  const [, code = '', ns = ''] = match;
  const json = ctx(key) as Record<string, unknown>;
  if (ns === 'native') continue;
  if (ns === 'meta') {
    localeMeta[code] = json as unknown as LocaleMeta;
    continue;
  }
  resources[code] = { ...resources[code], [ns]: json };
}

export const supportedLanguages = Object.keys(localeMeta).sort();
export const namespaces = ['common', 'spy', 'werewolf', 'mafia', 'blendIn'] as const;
export const fallbackLanguage = 'en';
