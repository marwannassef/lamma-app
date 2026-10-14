import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FlipInEasyY } from 'react-native-reanimated';

import { localized, wordLines, type Pack, type Word } from '@/core/content';
import { colors as themes, gradients, radius, space } from '@/core/theme';
import { Text } from '@/core/ui';

// The card is cream in both themes so it reads the same in a dim room.
const paper = themes.light;
const spyInk = themes.dark.text;

const LINE_SIZES = [44, 26, 22] as const;

/** A player's secret card: the word, or "You're the spy!". Flips in (instant with reduced motion). */
export function RoleCard({
  pack,
  word,
  isSpy,
  spySeesCategory,
}: {
  pack: Pack;
  word: Word;
  isSpy: boolean;
  spySeesCategory: boolean;
}) {
  const { t, i18n } = useTranslation('spy');
  const category = `${pack.emoji} ${localized(pack.name, i18n.language)}`;

  if (isSpy) {
    return (
      <Animated.View entering={FlipInEasyY.duration(450)} style={styles.glow} testID="card-spy">
        <LinearGradient
          colors={gradients.spy}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, styles.inner]}
        >
          <Text style={styles.spyEmoji} accessible={false}>
            🕵️
          </Text>
          <Text variant="hero" align="center" style={{ color: spyInk }}>
            {t('card.spyTitle')}
          </Text>
          <Text variant="label" align="center" style={{ color: spyInk }}>
            {spySeesCategory
              ? t('card.spyCategory', {
                  emoji: pack.emoji,
                  name: localized(pack.name, i18n.language),
                })
              : t('card.spyNoCategory')}
          </Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  const lines = wordLines(pack, word, i18n.language);
  return (
    <Animated.View entering={FlipInEasyY.duration(450)} testID="card-word">
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.border]}
      >
        <View style={[styles.inner, styles.paper, { backgroundColor: paper.bg }]}>
          <Text variant="label" align="center" style={{ color: paper.textMuted }}>
            {category}
          </Text>
          {lines.map((line, i) => (
            <Text
              key={i}
              variant={i === 0 ? 'hero' : 'label'}
              align="center"
              testID={i === 0 ? 'card-word-text' : undefined}
              style={{
                color: i === 0 ? paper.text : paper.textMuted,
                fontSize: LINE_SIZES[i],
                lineHeight: Math.round((LINE_SIZES[i] ?? 22) * 1.3),
                opacity: i === 2 ? 0.75 : 1,
              }}
            >
              {line}
            </Text>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, minHeight: 300 },
  border: { padding: 6 },
  inner: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xl,
  },
  paper: { borderRadius: radius.card - 6 },
  glow: {
    borderRadius: radius.card,
    shadowColor: '#D23C82',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  spyEmoji: { fontSize: 64, lineHeight: 80 },
});
