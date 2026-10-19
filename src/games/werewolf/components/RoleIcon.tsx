import { Image } from 'react-native';

import type { RoleId } from '../engine';
import { ROLE_ART } from './meta';

/** A role's art at `size`. */
export function RoleIcon({ role, size }: { role: RoleId; size: number }) {
  return (
    <Image
      source={ROLE_ART[role]}
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
      accessible={false}
      accessibilityIgnoresInvertColors
    />
  );
}
