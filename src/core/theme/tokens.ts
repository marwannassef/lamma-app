import { palette } from './palette';

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryLip: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  danger: string;
  success: string;
  border: string;
  focus: string;
}

// Contrast (WCAG AA, 4.5:1 for body text) is asserted in tokens.test.ts.
export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    bg: palette.cream,
    surface: palette.sand,
    surfaceRaised: '#FFFFFF',
    text: palette.ink,
    textMuted: '#7A4A35',
    primary: palette.orange,
    primaryLip: palette.orangeDark,
    onPrimary: palette.ink,
    secondary: palette.violet,
    onSecondary: palette.cream,
    danger: '#B8322B',
    success: '#3B7D1F',
    border: '#E2D3BD',
    focus: palette.violet,
  },
  dark: {
    bg: palette.night,
    surface: palette.nightUp,
    surfaceRaised: '#33245A',
    text: palette.cream,
    textMuted: '#C9BBE6',
    primary: palette.orange,
    primaryLip: palette.orangeDark,
    onPrimary: palette.ink,
    secondary: '#A98BF0',
    onSecondary: palette.night,
    danger: '#FF8A80',
    success: palette.leaf,
    border: '#3D2C66',
    focus: palette.orange,
  },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, card: 28, pill: 999 } as const;
export const minTouch = 48;
