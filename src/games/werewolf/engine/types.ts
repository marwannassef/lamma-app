// Werewolf engine types (docs/games/werewolf.md §3, §6, §7, §8, §12). Pure data, no React.

/** A seat index in roster order (clockwise around the table). */
export type PlayerId = number;

export type Team = 'village' | 'wolves' | 'neutral';

export type RoleId =
  | 'villager'
  | 'werewolf'
  | 'alpha'
  | 'wolfCub'
  | 'loneWolf'
  | 'sorcerer'
  | 'seer'
  | 'apprenticeSeer'
  | 'doctor'
  | 'witch'
  | 'hunter'
  | 'cupid'
  | 'mayor'
  | 'lycan'
  | 'cursed'
  | 'tanner'
  | 'serialKiller';

export type Theme = 'werewolf' | 'mafia';

/** Pass-and-play on one phone, or every player on their own phone (werewolf-network.md). */
export type PlayMode = 'pass' | 'network';

/** Whether the dawn story tells what the Seer saw last night (§6). */
export type SeerAtDawn = 'off' | 'result' | 'named';

/** One sentence of the dawn story (§16): a beat, its variant, and ids the screen turns into names. */
export interface StoryLine {
  beat: string;
  variant: number;
  name?: PlayerId;
  names?: PlayerId[];
  lover?: PlayerId;
  count?: number;
}

export interface StoryState {
  /** Tonight's setting id (§16.3); null before the first night. */
  setting: string | null;
  /** Variants not used yet in this game, per beat: no repeats until a beat runs out. */
  decks: Partial<Record<string, number[]>>;
  /** Yesterday's vote: who was banished, null for nobody, undefined before the first day. */
  lastVote?: PlayerId | null;
  /** Nights in a row without a death, this one included. */
  quietNights: number;
}

export type NightAction =
  'none' | 'wolfKill' | 'inspectWolf' | 'inspectSeer' | 'protect' | 'witch' | 'soloKill';

export interface RoleDef {
  id: RoleId;
  team: Team;
  /** Counts as a wolf for parity and knows the pack. */
  isPackWolf: boolean;
  seerSeesAs: 'werewolf' | 'innocent';
  nightAction: NightAction;
  maxPerGame: number;
  /** i18n key prefix: `<key>.name`, `<key>.ability`, `<key>.description`. */
  i18nKey: string;
  release: 'core' | 'expansion';
}

/** Count per role. Villagers are usually filled in to reach the player count. */
export type RoleCounts = Partial<Record<RoleId, number>>;

export type DeathCause =
  'wolves' | 'serialKiller' | 'poison' | 'heartbreak' | 'execution' | 'hunter';

export interface Player {
  id: PlayerId;
  role: RoleId;
  /** The dealt role when it later changed (Cursed → werewolf, Apprentice → seer). */
  dealtRole: RoleId;
  alive: boolean;
}

export interface HouseRules {
  discussionSeconds: 60 | 120 | 180 | null;
  glanceSeconds: number; // 8–15
  minTurnSeconds: number; // 3–8
  revealRoleOnDeath: boolean; // false = hardcore
  doctorSelfProtect: 'never' | 'night1' | 'always';
  detailedNarration: boolean;
  seerAtDawn: SeerAtDawn;
  mayor: 'off' | 'assigned' | 'elected';
  ambienceVolume: number; // 0–1
  deadMayTalk: boolean;
}

export const DEFAULT_RULES: HouseRules = {
  discussionSeconds: 120,
  glanceSeconds: 10,
  minTurnSeconds: 4.5,
  revealRoleOnDeath: true,
  doctorSelfProtect: 'night1',
  detailedNarration: false,
  seerAtDawn: 'off',
  mayor: 'off',
  ambienceVolume: 0.7,
  deadMayTalk: false,
};

/** One seat's choice during the night action pass. */
export type SeatAction =
  | { kind: 'dummy' }
  | { kind: 'wolf'; targets: PlayerId[] }
  | { kind: 'seer'; target: PlayerId }
  | { kind: 'sorcerer'; target: PlayerId }
  | { kind: 'doctor'; target: PlayerId }
  | { kind: 'witch'; heal: boolean; poison?: PlayerId }
  | { kind: 'serialKiller'; target: PlayerId };

export interface NightActions {
  /** Per living pack wolf: their one or two picks. */
  wolfVotes: Record<PlayerId, PlayerId[]>;
  doctorTarget?: PlayerId;
  witchHeal: boolean;
  witchPoison?: PlayerId;
  serialKillerTarget?: PlayerId;
  /** What the Seer saw tonight, for the dawn story's Seer result (§6). */
  seerCheck?: { target: PlayerId; sawWolf: boolean };
}

export const emptyNightActions = (): NightActions => ({ wolfVotes: {}, witchHeal: false });

/** What a seat learned from its own night action, shown on its own phone (network mode). */
export type SeatResult =
  | { kind: 'seer'; target: PlayerId; sawWolf: boolean }
  | { kind: 'sorcerer'; target: PlayerId; isSeer: boolean };

export interface Death {
  playerId: PlayerId;
  cause: DeathCause;
}

export interface Pending {
  hunterShot?: PlayerId;
  mayorHandoff?: PlayerId;
}

export interface NightReport {
  deaths: Death[];
  saves: { playerId: PlayerId; by: 'doctor' | 'witch' | 'immune' }[];
  /** Cursed players turned into wolves. */
  conversions: PlayerId[];
  witchHealConsumed: boolean;
  witchPoisonConsumed: boolean;
  pending: Pending;
  nextNight: { wolfKills: 1 | 2; promotedApprentice?: PlayerId };
}

export type Outcome = 'tanner' | 'draw' | 'lovers' | 'serialKiller' | 'wolves' | 'village';

export interface WinResult {
  outcome: Outcome;
  winners: PlayerId[];
  /** Winners who won alone (+2 on the scoreboard instead of +1). */
  soloWinners: PlayerId[];
}

/** A public, interactive effect after deaths (§2.5 step 3), handled in queue order. */
export type Effect = { t: 'hunterShot'; hunter: PlayerId } | { t: 'mayorHandoff'; mayor: PlayerId };

export type VoteChoice =
  { t: 'player'; id: PlayerId } | { t: 'tie'; tied: PlayerId[] } | { t: 'none' };

export type Phase =
  | { t: 'setup' }
  | { t: 'discovery'; seat: number; revealed: boolean }
  /** Network mode: everyone looks at their own card at once; `seen` seats are done. */
  | { t: 'reveal'; seen: PlayerId[] }
  | { t: 'nightIntro'; night: number }
  | { t: 'glance'; endsAt: number }
  | { t: 'pass'; seat: number; step: 'handoff' | 'action'; startedAt: number; turn: number }
  /** Network mode: every seat acts on its own phone at once, in any order. */
  | { t: 'actions'; startedAt: number; acted: PlayerId[] }
  | { t: 'morning'; report: NightReport; story: StoryLine[] }
  | { t: 'deathEffects'; queue: Effect[]; then: 'day' | 'night' }
  | { t: 'mayorElection' }
  | { t: 'discussion'; endsAt: number | null; pausedLeft: number | null }
  | { t: 'vote' }
  | { t: 'mayorTieBreak'; tied: PlayerId[] }
  /** `effects`: death effects to run after the reveal (Hunter's shot, Mayor's badge). */
  | { t: 'execution'; playerId: PlayerId | null; effects: Effect[] }
  | { t: 'gameOver'; result: WinResult };

export interface GameState {
  players: Player[];
  theme: Theme;
  /** Missing in games saved before network mode: treat as 'pass'. */
  mode?: PlayMode;
  /** Kids mode: softer narration (§15.2). */
  kids: boolean;
  story: StoryState;
  rules: HouseRules;
  phase: Phase;
  /** Current or last night number (1-based); 0 before the first night. */
  night: number;
  day: number;
  lovers: [PlayerId, PlayerId] | null;
  /** Holder of the Mayor badge, if any. */
  mayor: PlayerId | null;
  witch: { healUsed: boolean; poisonUsed: boolean };
  doctorLastTarget: PlayerId | null;
  /** Kills the pack gets this coming night (2 after the Wolf Cub dies). */
  wolfKills: 1 | 2;
  /** Seat that starts tonight's action pass; moves one seat each night. */
  startSeat: number;
  /** Actions collected during the current pass. */
  actions: NightActions;
  /** Tonight's Seer and Sorcerer answers, per seat; cleared at nightfall. */
  nightResults?: Partial<Record<PlayerId, SeatResult>>;
  /** Last night's report (for the morning screen and detailed narration). */
  lastReport: NightReport | null;
}
