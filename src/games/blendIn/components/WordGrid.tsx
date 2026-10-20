import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { wordLines, type Pack } from '@/core/content';
import { radius, space, useTheme } from '@/core/theme';
import { Pressable, Text } from '@/core/ui';

const LEAF = '#6DBE45';

/**
 * The topic's word grid (4 columns). Each word gets its own line and shrinks to fit, so words are
 * never cut off or split mid-word (§5). With `onPick`, tiles are buttons (the escape guess).
 */
export function WordGrid({
  pack,
  words,
  highlight,
  onPick,
  compact = false,
  colors: override,
}: {
  pack: Pack;
  words: readonly string[];
  highlight?: string;
  onPick?: (id: string) => void;
  compact?: boolean;
  /** Fixed colours for secret (stealth) screens. */
  colors?: { bg: string; fg: string };
}) {
  const { i18n } = useTranslation();
  const theme = useTheme().colors;
  const bg = override?.bg ?? theme.surface;
  const fg = override?.fg ?? theme.text;
  return (
    <View style={styles.grid} accessibilityRole={onPick ? 'radiogroup' : undefined}>
      {words.map((id) => {
        const word = pack.words.find((w) => w.id === id);
        if (!word) return null;
        const [main, sub] = wordLines(pack, word, i18n.language);
        const on = id === highlight;
        // One word per line: a word too wide for its line then shrinks instead of breaking mid-word.
        const lines = (main ?? '').split(' ');
        const tile = (
          <View
            style={[
              styles.tile,
              compact && styles.compact,
              { backgroundColor: on ? LEAF : bg, borderColor: on ? LEAF : 'transparent' },
            ]}
          >
            <Text
              variant={compact ? 'caption' : 'label'}
              align="center"
              numberOfLines={lines.length}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              style={{ color: on ? '#10240A' : fg }}
            >
              {lines.join('\n')}
            </Text>
            {!compact && sub ? (
              <Text
                variant="caption"
                align="center"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{ color: on ? '#10240A' : fg, opacity: 0.7 }}
              >
                {sub}
              </Text>
            ) : null}
          </View>
        );
        return (
          <View key={id} style={styles.cell}>
            {onPick ? (
              <Pressable testID={`word-${id}`} accessibilityLabel={main} onPress={() => onPick(id)}>
                {tile}
              </Pressable>
            ) : (
              tile
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, justifyContent: 'center' },
  cell: { width: '23.5%' },
  tile: {
    minHeight: 64,
    borderRadius: radius.sm,
    borderWidth: 2,
    padding: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 30, padding: 2 },
});
