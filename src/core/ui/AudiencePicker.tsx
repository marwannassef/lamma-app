import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { capFor, isValidPin, useAge } from '@/core/age';
import { space } from '@/core/theme';

import { Button } from './Button';
import { Chip } from './Chip';
import { Hint } from './Hint';
import { PinInput } from './PinInput';
import { Text } from './Text';

/**
 * "Who's playing" in Settings. Kids → Teen needs the parent PIN; choosing Kids without a PIN
 * sets one first. An under-13 age signal keeps Kids mode on (monetization §7).
 */
export function AudiencePicker() {
  const { t } = useTranslation('common');
  const { audience, pin, signal, setAudience, setPin, unlockTeen } = useAge();
  const [step, setStep] = useState<'idle' | 'unlock' | 'setPin' | 'confirmPin'>('idle');
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cappedKids = capFor(signal) === 'kids';

  const reset = () => {
    setStep('idle');
    setValue('');
    setFirst('');
    setError(null);
  };

  const chooseTeen = () => {
    if (cappedKids) return setError(t('age.lockedByAge'));
    if (audience === 'teen') return;
    if (pin) return setStep('unlock');
    setAudience('teen');
  };
  const chooseKids = () => {
    if (audience === 'kids') return;
    if (pin) return setAudience('kids');
    setStep('setPin');
  };

  const submit = () => {
    if (!isValidPin(value)) return setError(t('age.pinLabel'));
    if (step === 'unlock') {
      if (unlockTeen(value)) return reset();
      setValue('');
      return setError(t('age.wrongPin'));
    }
    if (step === 'setPin') {
      setFirst(value);
      setValue('');
      setError(null);
      return setStep('confirmPin');
    }
    if (value !== first) {
      reset();
      return setError(t('age.pinMismatch'));
    }
    setPin(first);
    setAudience('kids');
    reset();
  };

  return (
    <View style={styles.stack}>
      <Chip
        testID="audience-kids"
        emoji="🧒"
        title={t('age.kids.name')}
        subtitle={t('age.kids.sub')}
        selected={audience === 'kids' || cappedKids}
        onPress={chooseKids}
      />
      <Chip
        testID="audience-teen"
        emoji="🎉"
        title={t('age.teen.name')}
        subtitle={t('age.teen.sub')}
        selected={audience === 'teen' && !cappedKids}
        onPress={chooseTeen}
      />
      {step !== 'idle' ? (
        <View style={styles.stack}>
          <Text variant="label" align="center">
            {step === 'unlock'
              ? t('age.enterPin')
              : step === 'setPin'
                ? t('age.setPinSub')
                : t('age.confirmPin')}
          </Text>
          <PinInput
            key={step}
            testID="settings-pin"
            label={t('age.pinLabel')}
            value={value}
            onChange={setValue}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                size="md"
                testID="settings-pin-ok"
                label={t('age.continue')}
                onPress={submit}
              />
            </View>
            <View style={styles.flex}>
              <Button size="md" variant="ghost" label={t('age.cancel')} onPress={reset} />
            </View>
          </View>
        </View>
      ) : null}
      {error ? <Hint testID="audience-error">{error}</Hint> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
