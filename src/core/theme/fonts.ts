// Bundled locally (assets/fonts, SIL OFL). Each weight is its own family so Android renders it.
export const fontAssets = {
  'Baloo2-Bold': require('@/assets/fonts/Baloo2_700Bold.ttf'),
  'Baloo2-ExtraBold': require('@/assets/fonts/Baloo2_800ExtraBold.ttf'),
  'BalooBhaijaan2-Bold': require('@/assets/fonts/BalooBhaijaan2_700Bold.ttf'),
  'BalooBhaijaan2-ExtraBold': require('@/assets/fonts/BalooBhaijaan2_800ExtraBold.ttf'),
  'Nunito-Regular': require('@/assets/fonts/Nunito_400Regular.ttf'),
  'Nunito-SemiBold': require('@/assets/fonts/Nunito_600SemiBold.ttf'),
  'Nunito-Bold': require('@/assets/fonts/Nunito_700Bold.ttf'),
  'Nunito-ExtraBold': require('@/assets/fonts/Nunito_800ExtraBold.ttf'),
  'Cairo-Regular': require('@/assets/fonts/Cairo_400Regular.ttf'),
  'Cairo-SemiBold': require('@/assets/fonts/Cairo_600SemiBold.ttf'),
  'Cairo-Bold': require('@/assets/fonts/Cairo_700Bold.ttf'),
  'Cairo-ExtraBold': require('@/assets/fonts/Cairo_800ExtraBold.ttf'),
} as const;

export type FontRole = 'display' | 'body';
export type FontWeight = 'regular' | 'semibold' | 'bold' | 'extrabold';
type Script = 'latin' | 'arabic';

const families: Record<Script, Record<FontRole, Record<FontWeight, keyof typeof fontAssets>>> = {
  latin: {
    display: {
      regular: 'Baloo2-Bold',
      semibold: 'Baloo2-Bold',
      bold: 'Baloo2-Bold',
      extrabold: 'Baloo2-ExtraBold',
    },
    body: {
      regular: 'Nunito-Regular',
      semibold: 'Nunito-SemiBold',
      bold: 'Nunito-Bold',
      extrabold: 'Nunito-ExtraBold',
    },
  },
  arabic: {
    display: {
      regular: 'BalooBhaijaan2-Bold',
      semibold: 'BalooBhaijaan2-Bold',
      bold: 'BalooBhaijaan2-Bold',
      extrabold: 'BalooBhaijaan2-ExtraBold',
    },
    body: {
      regular: 'Cairo-Regular',
      semibold: 'Cairo-SemiBold',
      bold: 'Cairo-Bold',
      extrabold: 'Cairo-ExtraBold',
    },
  },
};

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** Picks the font family from the text's own script, so a Franco word in the Arabic UI stays Latin. */
export function fontFamilyFor(text: string, role: FontRole, weight: FontWeight): string {
  const script: Script = ARABIC.test(text) ? 'arabic' : 'latin';
  return families[script][role][weight];
}
