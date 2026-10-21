import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/core/theme';
import { Text } from '@/core/ui';

import { ROLES, type RoleId } from '../engine';
import { useWerewolfT } from './i18n';
import { TEAM_COLOR, TEAM_GRADIENT } from './meta';
import { RoleIcon } from './RoleIcon';

/**
 * A role card: art, name, team, ability and optional extra lines. Werewolf shows it on the
 * team gradient; Mafia shows it as a manila case file with the portrait clipped on (§15.3).
 */
export function RoleCard({ role, children }: { role: RoleId; children?: ReactNode }) {
  const { t, theme } = useWerewolfT();
  const team = ROLES[role].team;
  if (theme === 'mafia') {
    return (
      <View style={styles.file} testID={`role-${role}`}>
        <View style={styles.tab} />
        <View style={styles.fileHead}>
          <Text variant="caption" style={styles.ink}>
            {t('discovery.caseFile')}
          </Text>
          <View style={[styles.teamTag, { borderColor: TEAM_COLOR[team] }]}>
            <Text variant="caption" style={{ color: TEAM_COLOR[team] }}>
              {t(`teams.${team}`)}
            </Text>
          </View>
        </View>
        <View style={styles.photo}>
          <RoleIcon role={role} size={140} />
          <View style={styles.clip} />
        </View>
        <Text variant="hero" align="center" style={styles.ink}>
          {t(`roles.${role}.name`)}
        </Text>
        <Text variant="body" align="center" style={styles.ink}>
          {t(`roles.${role}.ability`)}
        </Text>
        {children}
      </View>
    );
  }
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

// The case file's own paper colours (a fixed prop look, the same in light and dark mode).
const MANILA = '#D9C39A';
const MANILA_DARK = '#B89B68';
const INK = '#2B1A12';

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
  file: {
    backgroundColor: MANILA,
    borderRadius: radius.md,
    padding: space.lg,
    paddingTop: space.xl,
    gap: space.sm,
    alignItems: 'center',
    minHeight: 320,
    marginTop: space.md,
  },
  tab: {
    position: 'absolute',
    top: -16,
    start: space.lg,
    width: 120,
    height: 24,
    backgroundColor: MANILA,
    borderTopStartRadius: radius.sm,
    borderTopEndRadius: radius.sm,
  },
  fileHead: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: MANILA_DARK,
    paddingBottom: space.xs,
  },
  teamTag: {
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  ink: { color: INK },
  photo: {
    padding: 6,
    backgroundColor: '#F7F1E3',
    borderRadius: 4,
    transform: [{ rotate: '-3deg' }],
  },
  clip: {
    position: 'absolute',
    top: -10,
    end: 18,
    width: 14,
    height: 40,
    borderWidth: 3,
    borderColor: '#8C8C96',
    borderRadius: 7,
  },
});
