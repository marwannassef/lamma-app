import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { isValidPin, useAge } from '@/core/age';
import { space } from '@/core/theme';
import { Button, Chip, Hint, PinInput, Screen, Text } from '@/core/ui';

/** First launch: "Who's playing tonight?" sets the content level (monetization §7). */
export default function Welcome() {
  const { t } = useTranslation('common');
  const { setAudience, setPin } = useAge();
  const [step, setStep] = useState<'choose' | 'pin' | 'confirm'>('choose');
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState<string | null>(null);

  const done = () => router.replace('/');

  if (step !== 'choose') {
    const confirming = step === 'confirm';
    const value = confirming ? second : first;
    return (
      <Screen
        center
        footer={
          <Button
            testID="pin-continue"
            label={t('age.continue')}
            onPress={() => {
              if (!isValidPin(value)) return setError(t('age.pinLabel'));
              if (!confirming) {
                setError(null);
                return setStep('confirm');
              }
              if (second !== first) {
                setError(t('age.pinMismatch'));
                setFirst('');
                setSecond('');
                return setStep('pin');
              }
              setPin(first);
              setAudience('kids');
              done();
            }}
          />
        }
      >
        <Text style={styles.big} align="center" accessible={false}>
          🔐
        </Text>
        <Text variant="title" align="center">
          {t('age.setPin')}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {confirming ? t('age.confirmPin') : t('age.setPinSub')}
        </Text>
        <PinInput
          key={step}
          testID="pin"
          label={t('age.pinLabel')}
          value={value}
          onChange={confirming ? setSecond : setFirst}
        />
        {error ? <Hint>{error}</Hint> : null}
        <Button
          variant="ghost"
          size="md"
          label={t('age.cancel')}
          onPress={() => setStep('choose')}
        />
      </Screen>
    );
  }

  return (
    <Screen center>
      <Image
        source={require('@/assets/images/lamma-logo.png')}
        style={styles.logo}
        accessible={false}
      />
      <Text variant="title" align="center">
        {t('age.welcomeTitle')}
      </Text>
      <Text variant="body" tone="muted" align="center">
        {t('age.welcomeSub')}
      </Text>
      <View style={styles.stack}>
        <Chip
          testID="audience-kids"
          emoji="🧒"
          title={t('age.kids.name')}
          subtitle={t('age.kids.sub')}
          selected={false}
          onPress={() => setStep('pin')}
        />
        <Chip
          testID="audience-teen"
          emoji="🎉"
          title={t('age.teen.name')}
          subtitle={t('age.teen.sub')}
          selected={false}
          onPress={() => {
            setAudience('teen');
            done();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 120, height: 120, alignSelf: 'center', borderRadius: 28 },
  big: { fontSize: 56, lineHeight: 70 },
  stack: { gap: space.md },
});
