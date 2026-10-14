import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { usePlayerName } from '@/core/players';
import { rankScores } from '@/core/session';
import { radius, space, useTheme } from '@/core/theme';

import { Text } from './Text';

/** Ranked scores with a crown for the leader(s) and this round's gains. */
export function Scoreboard({
  scores,
  gains,
  testID,
}: {
  scores: readonly number[];
  gains?: readonly number[];
  testID?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const nameOf = usePlayerName();
  return (
    <View testID={testID} style={styles.list}>
      {rankScores(scores, gains).map((row) => {
        const name = nameOf(row.player);
        const label = [
          name,
          t('scores.points', { count: row.points }),
          row.gain > 0 && t('scores.gain', { count: row.gain }),
          row.leader && t('scores.leader'),
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <View
            key={row.player}
            accessible
            accessibilityLabel={label}
            style={[styles.row, { backgroundColor: colors.surfaceRaised }]}
          >
            <Text style={styles.crown}>{row.leader ? '👑' : '·'}</Text>
            <Text variant="label" style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {row.gain > 0 ? (
              <Text variant="caption" tone="success">
                {`\u200E+${row.gain}`}
              </Text>
            ) : null}
            <Text variant="heading" tone="secondary">
              {String(row.points)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  crown: { width: 28, textAlign: 'center' },
  name: { flex: 1 },
});
