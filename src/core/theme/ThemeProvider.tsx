import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/core/settings/store';

import { useDayNight } from './dayNight';
import { colors, type ColorScheme, type ThemeColors } from './tokens';

interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
}

const ThemeContext = createContext<Theme>({ scheme: 'light', colors: colors.light });

/**
 * Follows the system appearance unless Settings picks light, dark or day & night (by local time). Pass `scheme` to force one
 * for a subtree, e.g. the dark "party night" Pass and Card screens.
 */
export function ThemeProvider({ scheme, children }: { scheme?: ColorScheme; children: ReactNode }) {
  const system = useColorScheme();
  const appearance = useSettings((s) => s.appearance);
  const byTime = useDayNight(scheme == null && appearance === 'auto');
  const resolved: ColorScheme =
    scheme ??
    (appearance === 'system'
      ? system === 'dark'
        ? 'dark'
        : 'light'
      : appearance === 'auto'
        ? byTime
        : appearance);
  return (
    <ThemeContext.Provider value={{ scheme: resolved, colors: colors[resolved] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
