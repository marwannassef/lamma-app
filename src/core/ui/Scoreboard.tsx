import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { usePlayerName } from '@/core/players';
import { rankScores } from '@/core/session';
import { radius, space, useTheme } from '@/core/theme';

import { Avatar, seatOf } from './Avatar';
import { Text } from './Text';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Leaderboard: medals for the top three, a crown for leader(s), bars and this round's gains. */
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
  const rows = rankScores(scores, gains);
  const top = Math.max(1, ...scores);
  // Dense ranking: equal points share a place.
  const places = rows.map(
    (r) => 1 + new Set(rows.filter((o) => o.points > r.points).map((o) => o.points)).size,
  );

  return (
    <View testID={testID} style={styles.list}>
      {rows.map((row, i) => {
        const name = nameOf(row.player);
        const place = places[i] ?? i + 1;
        const medal = row.points > 0 ? MEDALS[place - 1] : undefined;
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
            style={[
              styles.row,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: row.leader ? colors.gold : 'transparent',
              },
            ]}
          >
            <View
              style={[
                styles.bar,
                {
                  width: `${(row.points / top) * 100}%`,
                  backgroundColor: seatOf(row.player).color,
                },
              ]}
            />
            <Text variant="label" style={styles.place} align="center">
              {medal ?? String(place)}
            </Text>
            <Avatar player={row.player} size={36} />
            <Text variant="label" style={styles.name} numberOfLines={1}>
              {row.leader ? `${name} 👑` : name}
            </Text>
            {row.gain > 0 ? (
              <View style={[styles.gain, { backgroundColor: colors.surface }]}>
                <Text variant="caption" tone="success">
                  {`‎+${row.gain}`}
                </Text>
              </View>
            ) : null}
            <Text variant="heading" tone="secondary" style={styles.points}>
              {String(row.points)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    minHeight: 52,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', top: 0, bottom: 0, start: 0, opacity: 0.18 },
  place: { width: 30 },
  name: { flex: 1 },
  gain: { borderRadius: radius.pill, paddingHorizontal: space.sm },
  points: { minWidth: 28, textAlign: 'center' },
});
