import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { usePlayerName } from '@/core/players';
import { radius, space, STEALTH } from '@/core/theme';
import { Avatar, Button, PlayerPicker, Pressable, Screen, Text } from '@/core/ui';

import { RoleCard } from '../components/RoleCard';
import { isPackWolf, packOf, type GameState, type PlayerId } from '../engine';
import { useWerewolf } from '../store';

/** Same hold before the card shows for every role, so timing gives nothing away (§2.2). */
const SEAL_HOLD_MS = 500;

/** Who you can see on your card: the pack for wolves and the Sorcerer, your lover if linked. */
export function useRoleExtras(game: GameState, seat: PlayerId) {
  const { t } = useTranslation(['werewolf', 'common']);
  const nameOf = usePlayerName();
  const me = game.players[seat];
  const lines: string[] = [];
  if (!me) return lines;
  const pack = packOf(game).filter((p) => p.id !== seat);
  if (isPackWolf(me.role)) {
    lines.push(
      pack.length
        ? t('discovery.pack', { names: pack.map((p) => nameOf(p.id)).join(t('common:list.and')) })
        : t('discovery.packAlone'),
    );
  }
  if (me.role === 'sorcerer') {
    lines.push(
      t('discovery.sorcererPack', {
        names: packOf(game)
          .map((p) => nameOf(p.id))
          .join(t('common:list.and')),
      }),
    );
  }
  const lover = game.lovers?.find((id) => id !== seat && game.lovers?.includes(seat));
  if (lover != null) lines.push(t('discovery.lover', { name: nameOf(lover) }));
  return lines;
}

export default function Discovery({ game, seat }: { game: GameState; seat: PlayerId }) {
  const { t } = useTranslation(['werewolf', 'common']);
  const dispatch = useWerewolf((s) => s.dispatch);
  const nameOf = usePlayerName();
  const [step, setStep] = useState<'handoff' | 'seal' | 'cupid'>('handoff');
  const [showing, setShowing] = useState(false);
  const [lovers, setLovers] = useState<PlayerId[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const me = game.players[seat];
  const extras = useRoleExtras(game, seat);
  const name = nameOf(seat);

  if (!me) return null;

  if (step === 'handoff') {
    return (
      <Screen stealthColor={STEALTH.bg} center>
        <View style={styles.center}>
          <Text variant="label" align="center" style={styles.muted}>
            {t('discovery.passTo')}
          </Text>
          <Avatar player={seat} size={96} />
          <Text variant="hero" align="center" style={styles.text} testID="discovery-name">
            {name}
          </Text>
        </View>
        <Button
          testID="im-player"
          variant="secondary"
          label={t('discovery.imPlayer', { name })}
          onPress={() => setStep('seal')}
        />
      </Screen>
    );
  }

  if (step === 'cupid') {
    return (
      <Screen
        stealthColor={STEALTH.bg}
        footer={
          <Button
            testID="cupid-link"
            variant="secondary"
            label={t('discovery.cupidConfirm')}
            onPress={() => {
              if (lovers.length !== 2) return;
              dispatch({ t: 'cupidLink', lovers: [lovers[0] as PlayerId, lovers[1] as PlayerId] });
              dispatch({ t: 'hideRole' });
            }}
          />
        }
      >
        <Text variant="title" align="center" style={styles.text}>
          {`💘 ${t('discovery.cupidPick')}`}
        </Text>
        <Text variant="body" align="center" style={styles.muted}>
          {t('discovery.cupidHint')}
        </Text>
        <PlayerPicker
          players={game.players}
          selected={lovers}
          onToggle={(id) =>
            setLovers((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id].slice(-2)))
          }
          fg={STEALTH.text}
          muted={STEALTH.text}
          bg="#15101F"
          accent={STEALTH.accent}
        />
      </Screen>
    );
  }

  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    if (!showing) return;
    setShowing(false);
    if (me.role === 'cupid' && !game.lovers) setStep('cupid');
    else dispatch({ t: 'hideRole' });
  };

  return (
    <Screen stealthColor={STEALTH.bg} center scroll={false}>
      {showing ? (
        <View style={styles.stack}>
          <RoleCard role={me.role}>
            {extras.map((line) => (
              <Text key={line} variant="label" align="center" style={styles.white}>
                {line}
              </Text>
            ))}
          </RoleCard>
          <Text variant="caption" align="center" style={styles.muted}>
            {t('discovery.release')}
          </Text>
        </View>
      ) : (
        <Text variant="heading" align="center" style={styles.muted}>
          {t('discovery.hold')}
        </Text>
      )}
      <Pressable
        testID="seal"
        haptic={false}
        accessibilityLabel={t('discovery.hold')}
        onPressIn={() => {
          timer.current = setTimeout(() => {
            setShowing(true);
            if (!(game.phase.t === 'discovery' && game.phase.revealed))
              dispatch({ t: 'revealRole' });
          }, SEAL_HOLD_MS);
        }}
        onPressOut={release}
        style={({ pressed }) => [styles.seal, pressed && styles.sealPressed]}
      >
        <Text style={styles.sealGlyph} accessible={false}>
          🔴
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.md },
  stack: { gap: space.sm },
  text: { color: '#C9C2DA' },
  muted: { color: STEALTH.text },
  white: { color: '#FFFFFF' },
  seal: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#3A0D16',
    borderWidth: 4,
    borderColor: '#5E1622',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealPressed: { transform: [{ scale: 0.94 }], borderColor: '#8E2A36' },
  sealGlyph: { fontSize: 56, lineHeight: 70 },
  card: { borderRadius: radius.card },
});
