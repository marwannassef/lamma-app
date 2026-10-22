/**
 * What each game looks and sounds like on the home wheel: the emojis of its "surprise" burst when
 * the wheel stops on it, and where its How to play steps live.
 */
export interface Flavor {
  /** The big emoji that pops in the middle. */
  hero: string;
  /** Small emojis that fly out around it. */
  burst: readonly string[];
  /** i18n namespace holding `howTo.setup` / `howTo.play`; null when the game has none yet. */
  howTo: 'spy' | 'werewolf' | 'mafia' | 'blendIn' | null;
}

const MYSTERY: Flavor = { hero: '🎁', burst: ['❓', '❔', '✨', '🤫', '🎉'], howTo: null };

export const FLAVOR: Record<string, Flavor> = {
  spy: { hero: '🕵️', burst: ['🔍', '🤫', '👀', '🕶️', '❓'], howTo: 'spy' },
  werewolf: { hero: '🐺', burst: ['🌕', '🌙', '🐾', '✨', '🏚️'], howTo: 'werewolf' },
  mafia: { hero: '🕴️', burst: ['🕶️', '💼', '🔦', '🚨', '🃏'], howTo: 'mafia' },
  blendIn: { hero: '🦎', burst: ['🌈', '🎨', '👀', '🍃', '✨'], howTo: 'blendIn' },
  mystery: MYSTERY,
};

export const flavorOf = (id: string): Flavor => FLAVOR[id] ?? MYSTERY;
