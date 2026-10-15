import { palette } from './palette';

export type ColorScheme = 'light' | 'dark';
type Gradient = readonly [string, string, ...string[]];

export interface ThemeColors {
  bg: string;
  /** Full-screen background, top to bottom. */
  bgGradient: Gradient;
  /** Faint sparkles drawn over the background. */
  sparkle: string;
  surface: string;
  surfaceRaised: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryGradient: Gradient;
  primaryLip: string;
  onPrimary: string;
  secondary: string;
  secondaryGradient: Gradient;
  secondaryLip: string;
  onSecondary: string;
  danger: string;
  dangerGradient: Gradient;
  onDanger: string;
  success: string;
  gold: string;
  border: string;
  /** Shadow / glow tint for raised game elements. */
  glow: string;
  focus: string;
}

// Contrast (WCAG AA) for every text/background pair is asserted in tokens.test.ts.
export const colors: Record<ColorScheme, ThemeColors> = {
  light: {
    bg: '#FFF7EE',
    bgGradient: ['#FFF7EE', '#FDEBF4', '#EEE6FF'],
    sparkle: palette.violet,
    surface: '#FFFFFF',
    surfaceRaised: '#F6EEFF',
    text: '#22122E',
    textMuted: '#6A4A72',
    primary: palette.orange,
    primaryGradient: ['#FFB547', '#EF7A3C', '#E8605A'],
    primaryLip: '#B24A1E',
    onPrimary: palette.ink,
    secondary: '#5B2DB8',
    secondaryGradient: ['#7C4DEB', '#5B2DB8'],
    secondaryLip: '#3A1D6E',
    onSecondary: '#FFFFFF',
    danger: '#B8322B',
    dangerGradient: ['#D42A52', '#A3134A'],
    onDanger: '#FFFFFF',
    success: '#2E7D1F',
    gold: '#8F5A0B',
    border: '#E7D9F5',
    glow: '#9B6BFF',
    focus: palette.violet,
  },
  dark: {
    bg: '#140B2B',
    bgGradient: ['#0F0824', '#22104A', '#3A1670'],
    sparkle: '#FFFFFF',
    surface: '#24164A',
    surfaceRaised: '#33215F',
    text: palette.cream,
    textMuted: '#CDBEF0',
    primary: palette.orange,
    primaryGradient: ['#FFB547', '#EF7A3C', '#E8605A'],
    primaryLip: '#9C3F18',
    onPrimary: palette.ink,
    secondary: '#B89BFF',
    secondaryGradient: ['#7C4DEB', '#5B2DB8'],
    secondaryLip: '#2A1259',
    onSecondary: '#FFFFFF',
    danger: '#FF8FA3',
    dangerGradient: ['#D42A52', '#A3134A'],
    onDanger: '#FFFFFF',
    success: '#8EDB66',
    gold: '#FFD25E',
    border: '#4A3584',
    glow: '#B76BFF',
    focus: palette.orange,
  },
};

/** Seat colours and emoji for player avatars (cycled for more than 12 players). */
export const seats = [
  { color: '#EF7A3C', emoji: '🦊' },
  { color: '#2FB8C9', emoji: '🐼' },
  { color: '#D23C82', emoji: '🦄' },
  { color: '#6DBE45', emoji: '🐸' },
  { color: '#4F8FDB', emoji: '🐳' },
  { color: '#F2B33D', emoji: '🦁' },
  { color: '#9B59D0', emoji: '🐙' },
  { color: '#E8605A', emoji: '🦀' },
  { color: '#1FA38A', emoji: '🐢' },
  { color: '#FF6FB5', emoji: '🐷' },
  { color: '#5C6BC0', emoji: '🐧' },
  { color: '#C0843D', emoji: '🐻' },
] as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, card: 28, pill: 999 } as const;
export const minTouch = 48;
