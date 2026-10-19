export type LocaleCode = string;
/** "global" or an ISO-style region code such as "eg". */
export type Region = string;

export interface Word {
  id: string;
  text: Record<LocaleCode, string>;
  /** Latin transliteration (Franco/Arabizi, romaji, ...). */
  translit?: string;
}

export interface Pack {
  id: string;
  region: Region;
  game: string;
  emoji: string;
  name: Record<LocaleCode, string>;
  subtitle?: Record<LocaleCode, string>;
  adult?: boolean;
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
