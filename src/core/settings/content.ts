import { ADULT_ENABLED } from '@/core/config';
import { allPacks, defaultRegions, filterPacks, type Pack } from '@/core/content';

import { useSettings } from './store';

/** Enabled regions, resolving "auto" from the device region. */
export function useRegions(): string[] {
  const regions = useSettings((s) => s.regions);
  return regions ?? defaultRegions();
}

/**
 * Packs for a game after the region filter. Adult packs are included whenever the build has
 * them; games keep them out of random play and ask for 18+ confirmation before using one.
 */
export function usePacks(game: string): Pack[] {
  const regions = useRegions();
  return filterPacks(allPacks, { game, regions, adult: ADULT_ENABLED });
}
