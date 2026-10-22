import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { fontFamilyFor, radius, space, useTheme } from '@/core/theme';
import { Pressable, Text } from '@/core/ui';
import type { GameModule } from '@/games/registry';

import { GameCard } from './GameCard';

/** Lower-case and strip Arabic diacritics so "لمّة" matches "لمة". */
const fold = (s: string) => s.toLocaleLowerCase().replace(/[ً-ْ]/g, '');

/** The games as a list, with a search box over their names and descriptions. */
export function GameList({ games }: { games: readonly GameModule[] }) {
  const { t } = useTranslation(['common', 'spy', 'werewolf', 'blendIn']);
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const q = fold(query.trim());
  const shown = q
    ? games.filter((g) => fold(`${t(g.titleKey)} ${t(g.blurbKey)}`).includes(q))
    : games;
  return (
    <View style={styles.stack}>
      <View
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text accessible={false}>🔎</Text>
        <TextInput
          testID="game-search"
          value={query}
          onChangeText={setQuery}
          placeholder={t('home.search')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('home.search')}
          autoCorrect={false}
          returnKeyType="search"
          maxFontSizeMultiplier={2}
          style={[
            styles.input,
            {
              color: colors.text,
              fontFamily: fontFamilyFor(query || t('home.search'), 'body', 'regular'),
            },
          ]}
        />
        {query ? (
          <Pressable
            testID="game-search-clear"
            accessibilityLabel={t('home.clearSearch')}
            onPress={() => setQuery('')}
            style={styles.clear}
          >
            <Text variant="label" tone="muted" accessible={false}>
              ✖
            </Text>
          </Pressable>
        ) : null}
      </View>
      {shown.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
      {shown.length === 0 ? (
        <Text variant="body" tone="muted" align="center" testID="no-games">
          {t('home.noResults', { query: query.trim() })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 17, paddingVertical: space.sm },
  clear: { minWidth: 44, alignItems: 'center', justifyContent: 'center' },
});
