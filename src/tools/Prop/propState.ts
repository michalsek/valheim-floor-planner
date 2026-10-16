import { atom } from 'jotai';

import { library } from '../../catalog';
import type { PropDef, PropGroup } from '../../catalog/propDefs';
import { placementPosition } from '../../model/geometry/propGeometry';
import type { Vec2 } from '../../model/types';
import { cursorAtom, effectiveSnapStepAtom } from '../../store/session';

/** The prefab the Prop tool places (null: nothing armed). */
export const armedPrefabAtom = atom<string | null>(null);
/** The rotation the next prop gets, in degrees (R / Shift+R turn it). */
export const propRotationAtom = atom<number>(0);

export const armedDefAtom = atom<PropDef | null>((get) => {
  const prefab = get(armedPrefabAtom);
  return prefab === null ? null : (library.propDefs.get(prefab) ?? null);
});

export interface PropGhost {
  def: PropDef;
  position: Vec2;
  rotation: number;
}

/**
 * Where a click would place the armed prop. Derived from the cursor, so it follows
 * pans, zooms, snap changes and rotations without pointer events.
 */
export const propGhostAtom = atom<PropGhost | null>((get) => {
  const def = get(armedDefAtom);
  const cursor = get(cursorAtom);
  if (!def || !cursor) return null;
  const rotation = get(propRotationAtom);
  const step = cursor.snapping ? get(effectiveSnapStepAtom) : null;
  return { def, rotation, position: placementPosition(cursor.raw, rotation, def.rect, step) };
});

// The catalogue browser's search and group chips (kept across tool switches).
export const catalogQueryAtom = atom<string>('');
export const catalogGroupsAtom = atom<ReadonlySet<PropGroup>>(new Set<PropGroup>());
