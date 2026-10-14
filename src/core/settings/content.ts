import { ADULT_ENABLED } from '@/core/config';
import { allPacks, defaultRegions, filterPacks, type Pack } from '@/core/content';

import { useSettings } from './store';

/** Enabled regions, resolving "auto" from the device region. */
export function useRegions(): string[] {
  const regions = useSettings((s) => s.regions);
  return regions ?? defaultRegions();
}

/** Adult content is on only when the build includes it and the user turned it on. */
export function useAdult(): boolean {
  const adultMode = useSettings((s) => s.adultMode);
  return ADULT_ENABLED && adultMode;
}

/** Packs for a game after the region and adult filters. */
export function usePacks(game: string): Pack[] {
  const regions = useRegions();
  const adult = useAdult();
  return filterPacks(allPacks, { game, regions, adult });
}
