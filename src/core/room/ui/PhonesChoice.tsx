import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { space } from '@/core/theme';
import { Chip, Text } from '@/core/ui';

export type Phones = 'one' | 'all';

/** "How are you playing?": one phone passed around, or everyone on their own phone. */
export function PhonesChoice({ value, onChange }: { value: Phones; onChange(v: Phones): void }) {
  const { t } = useTranslation('common');
  return (
    <View style={styles.stack}>
      <Text variant="label">{t('net.phones')}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {(['one', 'all'] as const).map((v) => (
          <View key={v} style={styles.flex}>
            <Chip
              compact
              testID={`phones-${v}`}
              title={v === 'one' ? t('net.phonesOne') : t('net.phonesAll')}
              selected={value === v}
              onPress={() => onChange(v)}
            />
          </View>
        ))}
      </View>
      {value === 'all' ? (
        <Text variant="caption" tone="muted">
          {t('net.phonesAllSub')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
