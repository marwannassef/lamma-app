// Secret turns built from one seat's view (werewolf-network.md §2.1): seeing your card and the
// night action. Guests' phones use them, and so does the host phone for its own player's turns.
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { FlipInEasyY } from 'react-native-reanimated';

import { usePlayerName } from '@/core/players';
import { radius, space, STEALTH } from '@/core/theme';
import {
  Avatar,
  Button,
  HiddenFromScreenReader,
  HoldButton,
  PlayerPicker,
  Pressable,
  Screen,
  Text,
  Toggle,
  useCountdown,
} from '@/core/ui';

import { useWerewolfT } from '../components/i18n';
import { RoleCard } from '../components/RoleCard';
import { RoleIcon } from '../components/RoleIcon';
import { SoftPulse } from '../components/SoftPulse';
import { isPackWolf, type PlayerId, type SeatAction, type SeatView } from '../engine';

const SEAL_HOLD_MS = 500;
const FLIP_MS = 380;
const RESULT_MS = 3000;
const CARD_BG = '#15101F';
const TEXT = '#C9C2DA';

const SEAL = {
  werewolf: require('@/assets/images/werewolf/seal.png'),
  mafia: require('@/assets/images/mafia/stamp.png'),
};

/** The lines under a role card: your pack (wolves and the Sorcerer) and your lover. */
export function useViewExtras(view: SeatView): string[] {
  const { t } = useWerewolfT(['common']);
  const nameOf = usePlayerName();
  const names = (ids: readonly PlayerId[]) => ids.map(nameOf).join(t('common:list.and'));
  const { me } = view;
  const lines: string[] = [];
  if (me.role === 'sorcerer') lines.push(t('discovery.sorcererPack', { names: names(me.pack) }));
  else if (isPackWolf(me.role)) {
    lines.push(
      me.pack.length ? t('discovery.pack', { names: names(me.pack) }) : t('discovery.packAlone'),
    );
  }
  if (me.lover != null) lines.push(t('discovery.lover', { name: nameOf(me.lover) }));
  return lines;
}

/** Hold the seal to see your card; a Cupid links the lovers first. */
export function RevealTurn({
  view,
  onSeen,
  onLink,
}: {
  view: SeatView;
  onSeen(): void;
  onLink(lovers: [PlayerId, PlayerId]): void;
}) {
  const { t, theme } = useWerewolfT(['common']);
  const [showing, setShowing] = useState(false);
  const [lovers, setLovers] = useState<PlayerId[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extras = useViewExtras(view);
  const needsLink = view.task?.t === 'reveal' && view.task.cupid && !view.me.linked;
  const [picking, setPicking] = useState(false);

  if (picking && needsLink) {
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
              onLink([lovers[0] as PlayerId, lovers[1] as PlayerId]);
              onSeen();
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
          players={view.public.players}
          selected={lovers}
          onToggle={(id) =>
            setLovers((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id].slice(-2)))
          }
          fg={STEALTH.text}
          muted={STEALTH.text}
          bg={CARD_BG}
          accent={STEALTH.accent}
        />
      </Screen>
    );
  }

  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    setShowing(false);
  };

  return (
    <Screen
      stealthColor={STEALTH.bg}
      center
      scroll={false}
      footer={
        <Button
          testID="net-seen"
          variant="secondary"
          label={t('net.seen')}
          onPress={() => (needsLink ? setPicking(true) : onSeen())}
        />
      }
    >
      {showing ? (
        <View style={styles.stack}>
          <Animated.View entering={FlipInEasyY.duration(FLIP_MS)}>
            <HiddenFromScreenReader>
              <RoleCard role={view.me.role}>
                {extras.map((line) => (
                  <Text key={line} variant="label" align="center" style={styles.white}>
                    {line}
                  </Text>
                ))}
              </RoleCard>
            </HiddenFromScreenReader>
          </Animated.View>
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
          timer.current = setTimeout(() => setShowing(true), SEAL_HOLD_MS);
        }}
        onPressOut={release}
        style={({ pressed }) => [styles.seal, pressed && styles.sealPressed]}
      >
        <Image
          source={SEAL[theme]}
          style={styles.sealImage}
          accessible={false}
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    </Screen>
  );
}

/** "Hand the phone to…": the host phone's step before a player's private turn on it. */
export function TurnHandoff({ seat, onOpen }: { seat: PlayerId; onOpen(): void }) {
  const { t } = useWerewolfT();
  const nameOf = usePlayerName();
  const name = nameOf(seat);
  return (
    <Screen stealthColor={STEALTH.bg} center>
      <View style={styles.center}>
        <Avatar player={seat} size={96} />
        <Text variant="hero" align="center" style={styles.text} testID="turn-name">
          {t('net.yourTurn', { name })}
        </Text>
      </View>
      <HoldButton
        testID="open-my-turn"
        label={t('net.openMine')}
        color={STEALTH.accent}
        textColor={TEXT}
        onComplete={onOpen}
      />
    </Screen>
  );
}

/**
 * One seat's night action from its view: the same choose → hold-to-confirm rhythm and minimum
 * time as the one-phone pass (§4). After confirming, every phone shows a 3 s card: the Seer's or
 * Sorcerer's answer, or the dream card.
 */
export function ActionTurn({
  view,
  onConfirm,
  onDone,
}: {
  view: SeatView;
  onConfirm(action: SeatAction): void;
  /** After the result card (default: stay on the "done" screen). */
  onDone?(): void;
}) {
  const { t } = useWerewolfT(['common']);
  const nameOf = usePlayerName();
  const task = view.task?.t === 'action' ? view.task : null;
  const seat = view.seat;
  const [picked, setPicked] = useState<PlayerId[]>([]);
  const [heal, setHeal] = useState(false);
  const [poisoning, setPoisoning] = useState(false);
  // The host checks the minimum time with its own clock from when everyone started; counting
  // from when this phone got the turn is never shorter, whatever the clocks say.
  const [openedAt] = useState(() => Date.now());
  const minTurn = view.public.rules.minTurnSeconds * 1000;
  const left = useCountdown(openedAt + minTurn);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [cardGone, setCardGone] = useState(false);

  useEffect(() => {
    if (sentAt == null) return;
    const id = setTimeout(() => {
      setCardGone(true);
      onDone?.();
    }, RESULT_MS);
    return () => clearTimeout(id);
  }, [onDone, sentAt]);

  if (!task) return null;
  const { kind } = task;
  const allowed = (id: PlayerId) => task.targets.includes(id);

  if (sentAt != null || task.done) {
    const r = view.result;
    const result =
      r?.kind === 'seer'
        ? r.sawWolf
          ? t('pass.seerWolf')
          : t('pass.seerInnocent')
        : r?.kind === 'sorcerer'
          ? r.isSeer
            ? t('pass.isSeer')
            : t('pass.notSeer')
          : '💤';
    return (
      <Screen stealthColor={STEALTH.bg} center>
        {!cardGone && sentAt != null ? (
          <HiddenFromScreenReader style={[styles.result, { backgroundColor: CARD_BG }]}>
            <View testID="turn-result">
              <Text variant="hero" align="center" style={styles.text}>
                {result}
              </Text>
            </View>
          </HiddenFromScreenReader>
        ) : (
          <Text variant="heading" align="center" style={styles.muted} testID="turn-done">
            {t('net.done')}
          </Text>
        )}
      </Screen>
    );
  }

  let action: SeatAction | null = null;
  if (kind === 'dummy') action = picked.length ? { kind } : null;
  if (kind === 'wolf') action = picked.length === task.wolfKills ? { kind, targets: picked } : null;
  if (kind === 'seer' || kind === 'sorcerer' || kind === 'doctor' || kind === 'serialKiller') {
    action = picked[0] != null ? { kind, target: picked[0] } : null;
  }
  if (kind === 'witch') {
    action = poisoning
      ? picked[0] != null
        ? { kind, heal, poison: picked[0] }
        : null
      : { kind, heal };
  }
  const ready = action != null && left === 0;
  const { me } = view;
  const bitten = me.dealtRole === 'cursed' && me.role === 'werewolf';
  const promoted = me.dealtRole === 'apprenticeSeer' && me.role === 'seer';
  const prompt = !me.alive
    ? t('pass.dead')
    : kind === 'wolf'
      ? task.wolfKills === 2
        ? t('pass.wolfTwo')
        : t('pass.wolf')
      : kind === 'dummy'
        ? t('pass.dream')
        : kind === 'witch'
          ? t('pass.witch')
          : t(`pass.${kind}`);
  const showPicker = kind !== 'witch' || poisoning;
  const pack = new Set(kind === 'wolf' ? [...me.pack, seat] : []);

  return (
    <Screen
      stealthColor={STEALTH.bg}
      footer={
        <HoldButton
          testID="confirm-turn"
          label={left > 0 ? `${t('pass.waiting')} ${Math.ceil(left / 1000)}` : t('pass.confirm')}
          enabled={ready}
          color={STEALTH.accent}
          textColor={TEXT}
          onComplete={() => {
            if (!action) return;
            onConfirm(action);
            setSentAt(Date.now());
          }}
        />
      }
    >
      <SoftPulse since={openedAt}>
        <HiddenFromScreenReader style={styles.stack}>
          <View style={styles.header}>
            {me.alive ? (
              <RoleIcon role={me.role} size={56} />
            ) : (
              <Text style={styles.glyph} accessible={false}>
                💤
              </Text>
            )}
            <View style={styles.flex}>
              <Text variant="heading" style={styles.text}>
                {nameOf(seat)}
              </Text>
              {me.alive ? (
                <Text variant="caption" style={styles.muted}>
                  {t(`roles.${me.role}.name`)}
                </Text>
              ) : null}
            </View>
          </View>
          {bitten ? (
            <Text variant="label" align="center" style={styles.banner}>
              {`🩸 ${t('pass.bitten')}`}
            </Text>
          ) : null}
          {promoted ? (
            <Text variant="label" align="center" style={styles.banner} testID="promoted">
              {`🔮 ${t('pass.promoted')}`}
            </Text>
          ) : null}
          {me.lover != null ? (
            <Text variant="label" align="center" style={styles.banner}>
              {t('discovery.lover', { name: nameOf(me.lover) })}
            </Text>
          ) : null}
          <Text variant="body" align="center" style={styles.text}>
            {prompt}
          </Text>
          {kind === 'witch' ? (
            <View style={[styles.potions, { backgroundColor: CARD_BG }]}>
              <Toggle
                surface={false}
                testID="witch-heal"
                label={`🧪 ${t('pass.heal')}${task.witch.healUsed ? ` · ${t('pass.used')}` : ''}`}
                value={heal}
                onChange={(v) => !task.witch.healUsed && setHeal(v)}
              />
              <Toggle
                surface={false}
                testID="witch-poison"
                label={`☠️ ${t('pass.poison')}${task.witch.poisonUsed ? ` · ${t('pass.used')}` : ''}`}
                value={poisoning}
                onChange={(v) => {
                  if (task.witch.poisonUsed) return;
                  setPoisoning(v);
                  if (!v) setPicked([]);
                }}
              />
            </View>
          ) : null}
        </HiddenFromScreenReader>
        {showPicker ? (
          <PlayerPicker
            players={view.public.players}
            selected={picked}
            include={(p) => kind === 'dummy' || p.alive}
            disabled={(id) => !allowed(id)}
            tags={(id) => {
              if (id === seat) return { label: t('pass.you') };
              if (pack.has(id)) {
                return { label: id === me.alpha ? `👑 ${t('pass.alpha')}` : t('pass.pack') };
              }
              if (kind === 'doctor' && id === task.doctorLast)
                return { label: t('pass.doctorLast') };
              return undefined;
            }}
            onToggle={(id) => {
              if (kind === 'wolf') {
                setPicked((cur) =>
                  cur.includes(id)
                    ? cur.filter((x) => x !== id)
                    : [...cur, id].slice(-task.wolfKills),
                );
              } else setPicked([id]);
            }}
            announceTags={false}
            fg={TEXT}
            muted={STEALTH.text}
            bg={CARD_BG}
            accent={STEALTH.accent}
          />
        ) : null}
      </SoftPulse>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: space.md },
  stack: { gap: space.lg },
  text: { color: TEXT },
  muted: { color: STEALTH.text },
  white: { color: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  glyph: { fontSize: 40, lineHeight: 50 },
  banner: { color: TEXT, backgroundColor: CARD_BG, borderRadius: radius.md, padding: space.sm },
  potions: { borderRadius: radius.lg, padding: space.md, gap: space.sm },
  result: {
    borderRadius: radius.card,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: {
    alignSelf: 'center',
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  sealPressed: { transform: [{ scale: 0.92 }], opacity: 1 },
  sealImage: { width: 132, height: 132 },
});
