import { Image } from 'react-native';

import type { RoleId } from '../engine';
import { useGameTheme } from './i18n';
import { MAFIA_ROLE_ART, ROLE_ART } from './meta';

/** A role's art at `size`. */
export function RoleIcon({ role, size }: { role: RoleId; size: number }) {
  const theme = useGameTheme();
  return (
    <Image
      source={(theme === 'mafia' ? MAFIA_ROLE_ART : ROLE_ART)[role]}
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
      accessible={false}
      accessibilityIgnoresInvertColors
    />
  );
}
