import { atom } from 'jotai';

import { openingChoicesFor, type OpeningDef } from '../../catalog/openingDefs';
import { getLibrary } from '../../store/libraryInstance';
import { openingFamilyAtom, openingPrefabAtom } from '../../store/session';

import type { Placement } from './openingPlacement';

/** Where a click would place the opening (null off walls). */
export const openingHoverAtom = atom<Placement | null>(null);

/** The picker's list: the sticky family's openings, then the generic ones. */
export const openingChoicesAtom = atom<OpeningDef[]>((get) => {
  const lib = getLibrary();
  return openingChoicesFor(lib.openingDefs, lib.wallFamilies.get(get(openingFamilyAtom)));
});

/** The opening the tool places: the chosen one, or the list's first when it isn't listed. */
export const openingDefAtom = atom<OpeningDef | null>((get) => {
  const choices = get(openingChoicesAtom);
  const prefab = get(openingPrefabAtom);
  return choices.find((d) => d.prefab === prefab) ?? choices[0] ?? null;
});
