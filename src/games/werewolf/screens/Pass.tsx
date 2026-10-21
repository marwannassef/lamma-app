import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePlayerName } from '@/core/players';
import { radius, space, STEALTH } from '@/core/theme';
import {
  Avatar,
  HiddenFromScreenReader,
  HoldButton,
  PlayerPicker,
  Screen,
  Text,
  Toggle,
  useCountdown,
} from '@/core/ui';

import { RoleIcon } from '../components/RoleIcon';
import { SoftPulse } from '../components/SoftPulse';
import {
  expectedAction,
  isPackWolf,
  seerSees,
  sorcererSees,
  validAction,
  wolfTargetable,
  type GameState,
  type PlayerId,
  type SeatAction,
} from '../engine';
import { useWerewolf } from '../store';
import { useWerewolfT } from '../components/i18n';

const RESULT_MS = 3000;
const CARD_BG = '#15101F';
const TEXT = '#C9C2DA';

type PassPhase = Extract<GameState['phase'], { t: 'pass' }>;

function Handoff({ seat }: { seat: PlayerId }) {
  const { t } = useWerewolfT();
  const nameOf = usePlayerName();
  const dispatch = useWerewolf((s) => s.dispatch);
  const name = nameOf(seat);
  return (
    <Screen stealthColor={STEALTH.bg} center>
      <View style={styles.center}>
        <Text variant="label" align="center" style={styles.muted}>
          {t('pass.passTo')}
        </Text>
        <Avatar player={seat} size={96} />
        <Text variant="hero" align="center" style={styles.text} testID="pass-name">
          {name}
        </Text>
      </View>
      <HoldButton
        testID="open-turn"
        label={`${t('pass.imPlayer', { name })} · ${t('pass.hold')}`}
        color={STEALTH.accent}
        textColor={TEXT}
        onComplete={() => dispatch({ t: 'openTurn' })}
      />
    </Screen>
  );
}

/** One seat's secret night screen. Every role uses the same choose → hold-to-confirm rhythm. */
function Action({ game, phase }: { game: GameState; phase: PassPhase }) {
  const { t } = useWerewolfT(['common']);
  const nameOf = usePlayerName();
  const dispatch = useWerewolf((s) => s.dispatch);
  const seat = phase.seat;
  const me = game.players[seat];
  const kind = expectedAction(game, seat);
  const [picked, setPicked] = useState<PlayerId[]>([]);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [heal, setHeal] = useState(false);
  const [poisoning, setPoisoning] = useState(false);
  const left = useCountdown(phase.startedAt + game.rules.minTurnSeconds * 1000);
  const [resultVisible, setResultVisible] = useState(false);

  // Seer/Sorcerer results and the dummy "dream" card show for the same 3 s (§4).
  useEffect(() => {
    if (shownAt == null) return;
    const id = setTimeout(() => setResultVisible(false), RESULT_MS);
    return () => clearTimeout(id);
  }, [shownAt]);

  if (!me) return null;
  const single = (id: PlayerId) => {
    if (shownAt != null) return; // the choice is locked once the result flips
    setPicked([id]);
    if (kind === 'seer' || kind === 'sorcerer' || kind === 'dummy') {
      setShownAt(Date.now());
      setResultVisible(true);
    }
  };

  let action: SeatAction | null = null;
  if (kind === 'dummy') action = picked.length ? { kind } : null;
  if (kind === 'wolf') action = picked.length === game.wolfKills ? { kind, targets: picked } : null;
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
  const ready = action != null && validAction(game, seat, action) && left === 0;

  const lover = game.lovers?.includes(seat) ? game.lovers.find((id) => id !== seat) : undefined;
  const bitten = me.dealtRole === 'cursed' && me.role === 'werewolf';
  const promoted = me.dealtRole === 'apprenticeSeer' && me.role === 'seer';
  const alphaPick = game.players.find((p) => p.role === 'alpha' && p.alive);

  const prompt = !me.alive
    ? t('pass.dead')
    : kind === 'wolf'
      ? game.wolfKills === 2
        ? t('pass.wolfTwo')
        : t('pass.wolf')
      : kind === 'dummy'
        ? t('pass.dream')
        : kind === 'witch'
          ? t('pass.witch')
          : t(`pass.${kind}`);

  const result =
    picked[0] == null
      ? ''
      : kind === 'seer'
        ? seerSees(game, picked[0]) === 'werewolf'
          ? t('pass.seerWolf')
          : t('pass.seerInnocent')
        : kind === 'sorcerer'
          ? sorcererSees(game, picked[0])
            ? t('pass.isSeer')
            : t('pass.notSeer')
          : '💤';

  const showPicker = kind !== 'witch' || poisoning;

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
          onComplete={() => action && dispatch({ t: 'confirmTurn', action })}
        />
      }
    >
      <SoftPulse since={phase.startedAt}>
        {/* Everything that names a role stays silent for screen readers: the table would hear it (W6). */}
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
          {lover != null ? (
            <Text variant="label" align="center" style={styles.banner}>
              {t('discovery.lover', { name: nameOf(lover) })}
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
                label={`🧪 ${t('pass.heal')}${game.witch.healUsed ? ` · ${t('pass.used')}` : ''}`}
                value={heal}
                onChange={(v) => !game.witch.healUsed && setHeal(v)}
              />
              <Toggle
                surface={false}
                testID="witch-poison"
                label={`☠️ ${t('pass.poison')}${game.witch.poisonUsed ? ` · ${t('pass.used')}` : ''}`}
                value={poisoning}
                onChange={(v) => {
                  if (game.witch.poisonUsed) return;
                  setPoisoning(v);
                  if (!v) setPicked([]);
                }}
              />
            </View>
          ) : null}
        </HiddenFromScreenReader>
        {resultVisible && result ? (
          <HiddenFromScreenReader style={[styles.result, { backgroundColor: CARD_BG }]}>
            <View testID="turn-result">
              <Text variant="hero" align="center" style={styles.text}>
                {result}
              </Text>
            </View>
          </HiddenFromScreenReader>
        ) : showPicker ? (
          <PlayerPicker
            players={game.players}
            selected={picked}
            include={(p) => kind === 'dummy' || p.alive}
            disabled={(id) => {
              if (kind === 'dummy') return false;
              if (kind === 'wolf') return !wolfTargetable(game, id);
              if (kind === 'witch') return !validAction(game, seat, { kind, heal, poison: id });
              if (kind === 'doctor') return !validAction(game, seat, { kind, target: id });
              return id === seat;
            }}
            tags={(id) => {
              const p = game.players[id];
              if (id === seat) return { label: t('pass.you') };
              if (kind === 'wolf' && p && isPackWolf(p.role)) {
                return { label: p.id === alphaPick?.id ? `👑 ${t('pass.alpha')}` : t('pass.pack') };
              }
              if (kind === 'doctor' && id === game.doctorLastTarget)
                return { label: t('pass.doctorLast') };
              return undefined;
            }}
            onToggle={(id) => {
              if (kind === 'wolf') {
                setPicked((cur) =>
                  cur.includes(id)
                    ? cur.filter((x) => x !== id)
                    : [...cur, id].slice(-game.wolfKills),
                );
              } else single(id);
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

export default function Pass({ game, phase }: { game: GameState; phase: PassPhase }) {
  return phase.step === 'handoff' ? (
    <Handoff seat={phase.seat} />
  ) : (
    <Action key={`${phase.seat}-${phase.turn}`} game={game} phase={phase} />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: space.md },
  stack: { gap: space.lg },
  text: { color: TEXT },
  muted: { color: STEALTH.text },
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
});
