import { useContentLevel } from '@/core/age';
import { allPacks, defaultRegions, filterPacks, type Pack } from '@/core/content';

import { useSettings } from './store';

/** Enabled regions, resolving "auto" from the device region. */
export function useRegions(): string[] {
  const regions = useSettings((s) => s.regions);
  return regions ?? defaultRegions();
}

/**
 * Packs for a game in the enabled regions at the current content level. Kids mode removes
 * Teen packs and Teen words everywhere. Premium packs are included (shown with a lock for free
 * users); use usePackLocked() to tell which ones can be played.
 */
export function usePacks(game: string): Pack[] {
  const regions = useRegions();
  const level = useContentLevel();
  return filterPacks(allPacks, { game, regions, level });
}
