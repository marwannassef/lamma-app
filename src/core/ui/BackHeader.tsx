import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, StyleSheet, View } from 'react-native';

import { space } from '@/core/theme';

import { Pressable } from './Pressable';
import { Text } from './Text';

/** Back button plus screen title. The arrow flips in RTL. */
export function BackHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Pressable
        testID="back"
        accessibilityLabel={t('a11y.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.back}
      >
        <Text
          variant="title"
          tone="secondary"
          style={I18nManager.isRTL && { transform: [{ scaleX: -1 }] }}
        >
          ←
        </Text>
      </Pressable>
      <Text variant="title" style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  back: { minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
});
