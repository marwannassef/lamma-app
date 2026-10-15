import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/core/theme';
import { Text } from '@/core/ui';

import { ROLES, type RoleId } from '../engine';
import { TEAM_GRADIENT } from './meta';
import { RoleIcon } from './RoleIcon';

/** A role card: glyph on the team gradient, name, team, ability and optional extra lines. */
export function RoleCard({ role, children }: { role: RoleId; children?: ReactNode }) {
  const { t } = useTranslation('werewolf');
  const team = ROLES[role].team;
  return (
    <LinearGradient colors={TEAM_GRADIENT[team]} style={styles.card} testID={`role-${role}`}>
      <RoleIcon role={role} size={150} />
      <Text variant="hero" align="center" style={styles.white}>
        {t(`roles.${role}.name`)}
      </Text>
      <View style={styles.team}>
        <Text variant="caption" style={styles.white}>
          {t(`teams.${team}`)}
        </Text>
      </View>
      <Text variant="body" align="center" style={styles.white}>
        {t(`roles.${role}.ability`)}
      </Text>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: space.xl,
    gap: space.sm,
    alignItems: 'center',
    minHeight: 320,
    justifyContent: 'center',
  },
  white: { color: '#FFFFFF' },
  team: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 2,
  },
});
