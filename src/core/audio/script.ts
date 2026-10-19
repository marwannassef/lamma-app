import { pick, type Rng } from '@/core/rng';

/**
 * Narration lines are i18n arrays with 2–3 variants (§10) so repeat games don't sound robotic.
 * A plain string counts as one variant.
 */
export function pickLine(variants: string | readonly string[], rng: Rng): string {
  return typeof variants === 'string' ? variants : variants.length ? pick(rng, variants) : '';
}

/** BCP 47 language for text-to-speech. */
export const speechLanguage = (lang: string) =>
  lang === 'ar' ? 'ar-EG' : lang === 'en' ? 'en-US' : lang;
