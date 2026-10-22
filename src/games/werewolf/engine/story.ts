// Dawn story engine (docs/games/werewolf.md §16). Pure: it picks story beats and variant numbers
// from the night's events; the screen turns them into text in the right theme and language.
import { pick, shuffle, type Rng } from '@/core/rng';

import type { GameState, NightReport, PlayerId, StoryLine, StoryState, Theme } from './types';

/** Tonight's setting (§16.3): used in both the nightfall line and the dawn opening. */
export const SETTINGS: Record<Theme, readonly string[]> = {
  werewolf: ['rain', 'fog', 'fullMoon', 'wind', 'snow', 'warm'],
  mafia: ['powerCut', 'heatWave', 'neonRain', 'harborFog', 'festival', 'quietSunday'],
};

/** Every beat and how many variants it has in each theme and language (checked by content CI). */
export const BEATS = {
  openingFirst: 6,
  openingMid: 6,
  openingFinal: 6,
  stopped: 6,
  savedDoctor: 3,
  savedWitch: 3,
  savedImmune: 3,
  deathOne: 6,
  deathMany: 6,
  causeWolves: 3,
  causeSerialKiller: 3,
  causePoison: 3,
  heartbreak: 6,
  quiet: 6,
  seerFound: 6,
  seerInnocent: 6,
  seerFoundNamed: 6,
  seerInnocentNamed: 6,
  seerNone: 6,
  callbackVote: 6,
  callbackNoVote: 6,
  callbackQuiet: 6,
  tension: 6,
  closingFirst: 6,
  closingMid: 6,
  closingFinal: 6,
} as const;
export type Beat = keyof typeof BEATS;

/** Beats with softer Kids-mode variants, stored as `<beat>Kids` (§15.2, §16.5). */
export const KIDS_BEATS: readonly Beat[] = ['deathOne', 'deathMany', 'heartbreak'];

export const newStory = (): StoryState => ({ setting: null, decks: {}, quietNights: 0 });

/** Draws a variant from a beat's deck, refilling it (shuffled) once every variant was used. */
export function drawVariant(
  decks: StoryState['decks'],
  beat: Beat,
  rng: Rng,
): { variant: number; decks: StoryState['decks'] } {
  const left = decks[beat];
  const deck = left?.length ? [...left] : shuffle(rng, range(BEATS[beat]));
  const variant = deck.pop() as number;
  return { variant, decks: { ...decks, [beat]: deck } };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** A new setting for tonight, never the same as last night's. */
export function pickSetting(theme: Theme, last: string | null, rng: Rng): string {
  const pool = SETTINGS[theme].filter((s) => s !== last);
  return pick(rng, pool);
}

export type Stage = 'first' | 'mid' | 'final';

export function stageOf(night: number, alive: number): Stage {
  if (night <= 1) return 'first';
  return alive <= 4 ? 'final' : 'mid';
}

const CAUSE_BEAT = {
  wolves: 'causeWolves',
  serialKiller: 'causeSerialKiller',
  poison: 'causePoison',
} as const satisfies Partial<Record<string, Beat>>;

const SAVE_BEAT = {
  doctor: 'savedDoctor',
  witch: 'savedWitch',
  immune: 'savedImmune',
} as const satisfies Record<NightReport['saves'][number]['by'], Beat>;

/**
 * Tells the morning's story (§16.2): opening, events, an optional callback, tension and a
 * closing, 2 to 6 sentences. It never mentions a Cursed conversion, and names the saving role
 * or the cause of death only with detailed narration on (§16.4). `state` is after the night.
 */
export function tellDawn(
  state: GameState,
  report: NightReport,
  seerCheck: { target: PlayerId; sawWolf: boolean } | undefined,
  rng: Rng,
): { lines: StoryLine[]; story: StoryState } {
  let decks = state.story.decks;
  const lines: StoryLine[] = [];
  const say = (beat: Beat, extra: Omit<StoryLine, 'beat' | 'variant'> = {}) => {
    const d = drawVariant(decks, beat, rng);
    decks = d.decks;
    lines.push({ beat, variant: d.variant, ...extra });
  };
  const detailed = state.rules.detailedNarration;
  const alive = state.players.filter((p) => p.alive).length;
  const stage = stageOf(state.night, alive);

  say(stage === 'first' ? 'openingFirst' : stage === 'final' ? 'openingFinal' : 'openingMid');

  const killed = report.deaths.filter((d) => d.cause !== 'heartbreak');
  const broken = report.deaths.filter((d) => d.cause === 'heartbreak');

  if (report.saves.length > 0) {
    if (detailed) for (const s of report.saves) say(SAVE_BEAT[s.by], { name: s.playerId });
    else say('stopped');
  }
  const [only] = killed;
  if (killed.length === 1 && only) say('deathOne', { name: only.playerId });
  if (killed.length > 1) {
    say('deathMany', { names: killed.map((d) => d.playerId), count: killed.length });
  }
  if (detailed && !state.kids) {
    for (const d of killed) {
      const beat = CAUSE_BEAT[d.cause as keyof typeof CAUSE_BEAT];
      if (beat) say(beat, { name: d.playerId });
    }
  }
  for (const d of broken) {
    const lover = state.lovers?.find((id) => id !== d.playerId);
    say('heartbreak', { name: d.playerId, ...(lover != null && { lover }) });
  }
  const quietNight = report.deaths.length === 0;
  if (quietNight && report.saves.length === 0) say('quiet');

  const seerRule = state.rules.seerAtDawn;
  if (seerRule !== 'off') {
    if (!seerCheck) say('seerNone');
    else if (seerRule === 'named') {
      say(seerCheck.sawWolf ? 'seerFoundNamed' : 'seerInnocentNamed', { name: seerCheck.target });
    } else say(seerCheck.sawWolf ? 'seerFound' : 'seerInnocent');
  }

  const quietNights = quietNight ? state.story.quietNights + 1 : 0;
  // A callback only when the night was short on news, and not every morning.
  if (state.night > 1 && lines.length <= 3 && rng.next() < 0.7) {
    if (quietNights >= 2) say('callbackQuiet', { count: quietNights });
    else if (typeof state.story.lastVote === 'number') {
      say('callbackVote', { name: state.story.lastVote });
    } else if (state.story.lastVote === null) say('callbackNoVote');
  }

  if (stage !== 'first') say('tension', { count: alive });
  say(stage === 'first' ? 'closingFirst' : stage === 'final' ? 'closingFinal' : 'closingMid');

  return { lines, story: { ...state.story, decks, quietNights } };
}

/** The i18n key of a line in a theme, using the Kids variant when there is one. */
export function storyKey(line: StoryLine, theme: Theme, kids: boolean): string {
  const kidsBeat =
    kids && (KIDS_BEATS as readonly string[]).includes(line.beat) ? `${line.beat}Kids` : line.beat;
  return `story.${theme}.${kidsBeat}`;
}
