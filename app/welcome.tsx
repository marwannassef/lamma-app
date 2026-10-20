import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { capFor, isValidPin, useAge } from '@/core/age';
import { space } from '@/core/theme';
import { Button, Chip, Hint, PinInput, Screen, Text } from '@/core/ui';

type Step = 'setPin' | 'confirmPin' | 'choose' | 'unlock';

/**
 * First launch (monetization §7): a parent PIN first, then "Who's playing tonight?". Teens and
 * adults always needs the PIN. Installs that never set a PIN land here to set one.
 */
export default function Welcome() {
  const { t } = useTranslation('common');
  const { audience, pin, signal, setAudience, setPin, unlockTeen } = useAge();
  const [step, setStep] = useState<Step>(pin ? 'choose' : 'setPin');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cappedKids = capFor(signal) === 'kids';

  const done = () => router.replace('/');
  const go = (next: Step) => {
    setValue('');
    setError(null);
    setStep(next);
  };

  const submit = (entered = value) => {
    if (!isValidPin(entered)) return setError(t('age.pinLabel'));
    if (step === 'setPin') {
      setFirst(entered);
      return go('confirmPin');
    }
    if (step === 'confirmPin') {
      if (entered !== first) {
        setFirst('');
        go('setPin');
        return setError(t('age.pinMismatch'));
      }
      setPin(first);
      // An install that already chose who's playing only needed the PIN.
      return audience ? done() : go('choose');
    }
    if (unlockTeen(entered)) return done();
    setValue('');
    setError(t('age.wrongPin'));
  };

  if (step !== 'choose') {
    const title = step === 'unlock' ? t('age.enterPinTitle') : t('age.setPin');
    const sub =
      step === 'unlock'
        ? t('age.enterPin')
        : step === 'setPin'
          ? t('age.setPinSub')
          : t('age.confirmPin');
    return (
      <Screen
        center
        footer={<Button testID="pin-continue" label={t('age.continue')} onPress={() => submit()} />}
      >
        <Text style={styles.big} align="center" accessible={false}>
          🔐
        </Text>
        <Text variant="title" align="center">
          {title}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {sub}
        </Text>
        <PinInput
          key={step}
          testID="pin"
          label={t('age.pinLabel')}
          value={value}
          onChange={(v) => {
            setValue(v);
            // The 4th digit moves on by itself: on iOS the number pad covers the Continue button.
            if (isValidPin(v)) submit(v);
          }}
        />
        {error ? <Hint>{error}</Hint> : null}
        {step === 'unlock' ? (
          <Button
            variant="ghost"
            size="md"
            testID="pin-cancel"
            label={t('age.cancel')}
            onPress={() => go('choose')}
          />
        ) : null}
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
          onPress={() => {
            setAudience('kids');
            done();
          }}
        />
        <Chip
          testID="audience-teen"
          emoji="🎉"
          title={t('age.teen.name')}
          subtitle={t('age.teen.sub')}
          selected={false}
          onPress={() => (cappedKids ? setError(t('age.lockedByAge')) : go('unlock'))}
        />
      </View>
      {error ? <Hint testID="welcome-error">{error}</Hint> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 120, height: 120, alignSelf: 'center', borderRadius: 28 },
  big: { fontSize: 56, lineHeight: 70 },
  stack: { gap: space.md },
});
