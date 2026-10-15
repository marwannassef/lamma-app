import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { localized, wordLines, type Pack, type Word } from '@/core/content';
import { colors as themes, gradients, radius, space } from '@/core/theme';
import { Text } from '@/core/ui';

// The card is cream in both themes so it reads the same in a dim room.
const paper = themes.light;
const spyInk = themes.dark.text;

const LINE_SIZES = [44, 26, 22] as const;

/** Front of a player's secret card: the word, or "You're the spy!". Fills its container. */
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
      <View style={[styles.fill, styles.glow]} testID="card-spy">
        <LinearGradient
          colors={gradients.spy}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, styles.fill, styles.inner]}
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
      </View>
    );
  }

  const lines = wordLines(pack, word, i18n.language);
  return (
    <View style={styles.fill} testID="card-word">
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.fill, styles.border]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  card: { borderRadius: radius.card },
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
