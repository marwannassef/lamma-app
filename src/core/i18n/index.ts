import { getLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import { createInstance, type ParseKeys } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager, Platform } from 'react-native';

import type { LanguagePref } from '@/core/settings/store';

import { fallbackLanguage, localeMeta, namespaces, resources, supportedLanguages } from './locales';

export { localeMeta, supportedLanguages };

/** Any translation key, namespaced for non-default namespaces (e.g. 'spy:title'). */
export type I18nKey = ParseKeys<typeof namespaces>;

const i18n = createInstance();

/** Resolves 'system' to the first device language we ship, else English. */
export function resolveLanguage(pref: LanguagePref): string {
  if (pref !== 'system' && supportedLanguages.includes(pref)) return pref;
  for (const locale of getLocales()) {
    if (locale.languageCode && supportedLanguages.includes(locale.languageCode)) {
      return locale.languageCode;
    }
  }
  return fallbackLanguage;
}

export const isRTL = (lang: string) => localeMeta[lang]?.dir === 'rtl';

export function initI18n(pref: LanguagePref) {
  const lng = resolveLanguage(pref);
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: fallbackLanguage,
      ns: [...namespaces],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
      initAsync: false,
    });
  }
  return lng;
}

/**
 * Makes the native layout direction match the language. Direction only changes after a
 * reload, so this returns true when a reload has been triggered and rendering should wait.
 */
export function syncLayoutDirection(lang: string): boolean {
  const rtl = isRTL(lang);
  if (Platform.OS === 'web' || I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  if (__DEV__) DevSettings.reload();
  else void Updates.reloadAsync();
  return true;
}

/** Switches language at runtime, reloading the app if the writing direction flips. */
export async function switchLanguage(pref: LanguagePref) {
  const lng = resolveLanguage(pref);
  await i18n.changeLanguage(lng);
  syncLayoutDirection(lng);
}

export { i18n };
export default i18n;
