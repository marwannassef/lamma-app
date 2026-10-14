import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { customName, usePlayers } from '@/core/players';
import { space, useTheme } from '@/core/theme';
import { Button, Screen, Text } from '@/core/ui';

/** "Pass the phone to …" between players. */
export default function Pass({ player, onShow }: { player: number; onShow(): void }) {
  const { t } = useTranslation('spy');
  const { colors } = useTheme();
  const { count, names } = usePlayers();
  const name = customName(names, player);

  return (
    <Screen center>
      <View style={styles.block} accessible accessibilityLiveRegion="polite">
        <Text variant="heading" tone="muted" align="center">
          {t('pass.label')}
        </Text>
        <Text variant="title" align="center" testID="pass-name">
          {name || t('pass.player')}
        </Text>
        <Text variant="hero" tone="primary" align="center" style={styles.num}>
          {String(player + 1)}
        </Text>
      </View>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={t('pass.progress', { n: player + 1, total: count })}
      >
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < player ? colors.primary : colors.surfaceRaised,
                borderColor: i === player ? colors.primary : 'transparent',
              },
            ]}
          />
        ))}
      </View>
      <Text variant="body" tone="muted" align="center">
        {t('pass.hint')}
      </Text>
      <Button testID="show-card" label={t('pass.show')} onPress={onShow} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', gap: space.xs },
  num: { fontSize: 140, lineHeight: 160 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
