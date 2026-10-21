import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { createInstance, type ParseKeys } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager, Platform } from 'react-native';

import type { LanguagePref } from '@/core/settings/store';
import { storage } from '@/core/storage';

import { fallbackLanguage, localeMeta, namespaces, resources, supportedLanguages } from './locales';

export { localeMeta, supportedLanguages };

/** Any translation key, namespaced for non-default namespaces (e.g. 'spy:title'). */
// The Mafia theme only overrides Werewolf strings (werewolf.md §15); it never names a screen key.
type KeyNamespaces = ['common', 'spy', 'werewolf', 'blendIn'];
export type I18nKey = ParseKeys<KeyNamespaces>;

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
  const want = rtl ? 'rtl' : 'ltr';
  if (Platform.OS === 'web') return false;
  if (I18nManager.isRTL === rtl) {
    storage.removeItem(RELOAD_KEY);
    return false;
  }
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  // Some builds (iOS store builds) only apply a new direction on a cold start. Reload at most once
  // per change: if the direction still hasn't flipped afterwards, carry on and let Settings ask the
  // player to close and reopen the app, instead of reloading forever.
  if (storage.getItem(RELOAD_KEY) === want) return false;
  storage.setItem(RELOAD_KEY, want);
  // reloadAppAsync works in every build (expo-updates' reloadAsync rejects when updates are off).
  reloadAppAsync('Layout direction changed').catch(() => {
    if (__DEV__) DevSettings.reload();
  });
  return true;
}

const RELOAD_KEY = 'layout-direction-reload';

/** True while the language's writing direction waits for the app to be reopened. */
export const directionPending = (lang: string) =>
  Platform.OS !== 'web' && I18nManager.isRTL !== isRTL(lang);

/** Switches language at runtime, reloading the app if the writing direction flips. */
export async function switchLanguage(pref: LanguagePref) {
  const lng = resolveLanguage(pref);
  await i18n.changeLanguage(lng);
  syncLayoutDirection(lng);
}

export { i18n };
export default i18n;
