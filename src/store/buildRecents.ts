/**
 * The Build palette's Recent tab: the last prefabs armed from it, most recent first,
 * remembered per browser.
 */
import { atom } from 'jotai';

import { persistedAtom } from './browserStorage';

/** How many prefabs Recent keeps (M17 §9.1). */
export const MAX_RECENTS = 12;

const KEY = 'valheimFloorPlanner.buildRecents.v1';

/** A stored list, or null when it isn't a list of prefab names. */
export const parseRecents = (stored: string): string[] | null => {
  try {
    const value: unknown = JSON.parse(stored);
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) return null;
    return [...new Set(value as string[])].slice(0, MAX_RECENTS);
  } catch {
    return null;
  }
};

/** `prefab` moved to the front of `recents`, which keeps at most `MAX_RECENTS`. */
export const withRecent = (recents: readonly string[], prefab: string): string[] =>
  [prefab, ...recents.filter((p) => p !== prefab)].slice(0, MAX_RECENTS);

export const buildRecentsAtom = persistedAtom<readonly string[]>(KEY, [], parseRecents, (recents) =>
  JSON.stringify(recents)
);

/** Records `prefab` as armed just now. */
export const addRecentAtom = atom(null, (get, set, prefab: string) => {
  const recents = get(buildRecentsAtom);
  if (recents[0] !== prefab) set(buildRecentsAtom, withRecent(recents, prefab));
});
