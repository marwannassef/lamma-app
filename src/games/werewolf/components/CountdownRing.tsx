import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/core/theme';

import { TEAM_COLOR } from './meta';

const TICKS = 60;

/** How many of the ring's ticks are still lit for `fraction` of the time left. */
export const litTicks = (fraction: number) =>
  Math.max(0, Math.min(TICKS, Math.ceil(Math.max(0, Math.min(1, fraction)) * TICKS)));

/**
 * The day's big circular countdown (§11): a ring of ticks that empties clockwise and turns orange
 * in the last 30 seconds.
 */
export function CountdownRing({
  fraction,
  late,
  size = 220,
  children,
}: {
  fraction: number;
  late: boolean;
  size?: number;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const lit = litTicks(fraction);
  const on = late ? TEAM_COLOR.neutral : colors.secondary;
  return (
    <View style={[styles.ring, { width: size, height: size }]}>
      {Array.from({ length: TICKS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.tickArm,
            { height: size, transform: [{ rotate: `${(i * 360) / TICKS}deg` }] },
          ]}
        >
          <View
            style={[
              styles.tick,
              i % 5 === 0 && styles.major,
              { backgroundColor: i < lit ? on : colors.border },
            ]}
          />
        </View>
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  tickArm: { position: 'absolute', width: 6, alignItems: 'center' },
  tick: { width: 4, height: 14, borderRadius: 2 },
  major: { width: 6, height: 20, borderRadius: 3 },
});
