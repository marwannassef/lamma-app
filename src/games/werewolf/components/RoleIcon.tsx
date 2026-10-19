import { Image } from 'react-native';

import { Text } from '@/core/ui';

import type { RoleId } from '../engine';
import { ROLE_ART, ROLE_GLYPH } from './meta';

/** A role's art at `size`, or its emoji glyph while the art isn't ready. */
export function RoleIcon({ role, size }: { role: RoleId; size: number }) {
  const art = ROLE_ART[role];
  if (art) {
    return (
      <Image
        source={art}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        accessible={false}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <Text
      accessible={false}
      style={{ fontSize: size * 0.8, lineHeight: size, width: size, textAlign: 'center' }}
    >
      {ROLE_GLYPH[role]}
    </Text>
  );
}
