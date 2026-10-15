import { StyleSheet, View } from 'react-native';

import { seats } from '@/core/theme';

import { Text } from './Text';

export const seatOf = (player: number) => seats[player % seats.length] ?? seats[0];

/** A player's seat badge: coloured circle with their animal. */
export function Avatar({
  player,
  size = 44,
  ring,
}: {
  player: number;
  size?: number;
  ring?: string;
}) {
  const seat = seatOf(player);
  return (
    <View
      accessible={false}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: seat.color,
          borderColor: ring ?? 'rgba(255,255,255,0.65)',
          borderWidth: ring ? 4 : 2,
        },
      ]}
    >
      <Text style={{ fontSize: size * 0.52, lineHeight: size * 0.68 }}>{seat.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
