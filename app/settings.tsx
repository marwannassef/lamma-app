import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { localeMeta, supportedLanguages, switchLanguage } from '@/core/i18n';
import { useSettings, type Appearance, type LanguagePref } from '@/core/settings/store';
import { radius, space, useTheme } from '@/core/theme';
import { Pressable, Screen, Text } from '@/core/ui';
import { BackHeader } from '@/core/ui/BackHeader';

interface Option<T extends string> {
  value: T;
  label: string;
}

function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: Option<T>[];
  value: T;
  onChange(v: T): void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[
              styles.option,
              {
                backgroundColor: selected ? colors.secondary : colors.surfaceRaised,
                borderColor: selected ? colors.secondary : colors.border,
              },
            ]}
          >
            <Text variant="label" style={{ color: selected ? colors.onSecondary : colors.text }}>
              {selected ? `✓ ${o.label}` : o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <Text variant="heading">{title}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange(v: boolean): void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Text variant="label" style={styles.flex}>
        {label}
      </Text>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.secondary, false: colors.border }}
        thumbColor={colors.surfaceRaised}
      />
    </View>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const s = useSettings();

  const languages: Option<LanguagePref>[] = [
    { value: 'system', label: t('settings.languageSystem') },
    ...supportedLanguages.map((code) => ({
      value: code,
      label: localeMeta[code]?.nativeName ?? code,
    })),
  ];
  const appearances: Option<Appearance>[] = [
    { value: 'system', label: t('settings.appearanceSystem') },
    { value: 'light', label: t('settings.appearanceLight') },
    { value: 'dark', label: t('settings.appearanceDark') },
  ];

  return (
    <Screen>
      <BackHeader title={t('settings.title')} />

      <Section title={t('settings.language')}>
        <OptionGroup
          testID="lang"
          options={languages}
          value={s.language}
          onChange={(v) => {
            s.setLanguage(v);
            void switchLanguage(v);
          }}
        />
        <Text variant="caption" tone="muted">
          {t('settings.directionNote')}
        </Text>
      </Section>

      <Section title={t('settings.appearance')}>
        <OptionGroup
          testID="appearance"
          options={appearances}
          value={s.appearance}
          onChange={s.setAppearance}
        />
      </Section>

      <Section title={t('settings.title')}>
        <ToggleRow
          testID="haptics"
          label={t('settings.haptics')}
          value={s.haptics}
          onChange={s.setHaptics}
        />
        <ToggleRow
          testID="sound"
          label={t('settings.sound')}
          value={s.sound}
          onChange={s.setSound}
        />
      </Section>

      <Section title={t('settings.about')}>
        <Text variant="label">{t('appName')}</Text>
        <Text variant="caption" tone="muted">
          {t('publisher')} · {t('settings.version', { version: Constants.expoConfig?.version })}
        </Text>
        <Text variant="body">{t('settings.privacy')}</Text>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { borderRadius: radius.lg, padding: space.lg, gap: space.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
});
