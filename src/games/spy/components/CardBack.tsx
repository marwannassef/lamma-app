import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { gradients, radius, space } from '@/core/theme';
import { Text } from '@/core/ui';

import { spy } from '..';

const MARKS = ['?', '✦', '?', '✧', '?', '✦', '?', '✧', '?', '✦', '?', '✧'];

/** Patterned back of a secret card: question marks, sparkles and the Lamma mark. */
export function CardBack({ hint }: { hint: string }) {
  return (
    <LinearGradient
      colors={gradients.spy}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.pattern} pointerEvents="none">
        {MARKS.map((m, i) => (
          <Text
            key={i}
            style={[styles.mark, { transform: [{ rotate: `${(i % 3) * 15 - 15}deg` }] }]}
          >
            {m}
          </Text>
        ))}
      </View>
      <View style={styles.inset} pointerEvents="none" />
      <View style={styles.center}>
        <Image source={spy.icon} style={styles.logo} accessible={false} />
        <Text variant="heading" align="center" style={styles.hint}>
          {hint}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.card, overflow: 'hidden' },
  pattern: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'space-around',
    justifyContent: 'space-around',
    padding: space.lg,
    opacity: 0.18,
  },
  mark: { width: '30%', textAlign: 'center', fontSize: 44, lineHeight: 70, color: '#FFFFFF' },
  inset: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    margin: 10,
    borderRadius: radius.card - 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  logo: { width: 110, height: 110, borderRadius: 28 },
  hint: { color: '#FFFFFF' },
});
