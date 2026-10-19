export type LocaleCode = string;
/** Content level: Kids is fine for any age; Teen allows crude humor. Adult never ships in Lamma. */
export type ContentLevel = 'kids' | 'teen';
/** Default tier; the server can override which packs are free. */
export type PackTier = 'free' | 'premium';
/** "global" or an ISO-style region code such as "eg". */
export type Region = string;

export interface Word {
  id: string;
  text: Record<LocaleCode, string>;
  /** Latin transliteration (Franco/Arabizi, romaji, ...). */
  translit?: string;
  /** Per-word override of the pack's level. */
  level?: ContentLevel;
}

export interface Pack {
  id: string;
  region: Region;
  game: string;
  emoji: string;
  name: Record<LocaleCode, string>;
  subtitle?: Record<LocaleCode, string>;
  level: ContentLevel;
  tier: PackTier;
  /** How a word is laid out on the card, from biggest to smallest line. */
  display: {
    primary: LocaleCode | 'ui';
    secondary?: LocaleCode | 'translit';
    tertiary?: LocaleCode;
  };
  words: Word[];
  /** Close but different word pairs (word ids) for "odd one out" modes like Blend In Undercover. */
  pairs?: [string, string][];
}
