import { atom } from 'jotai';

import type { PropDef, PropGroup } from '../../catalog/propDefs';
import { placementPosition } from '../../model/geometry/propGeometry';
import type { Vec2 } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { groundHeight } from '../../model/build/buildHit';
import { clampElevation, roundElevation } from '../../model/elevation';
import { committedPlanAtom } from '../../store/committedPlan';
import { cursorAtom, surfaceScene } from '../../store/pointer';
import { snapStepAtom } from '../../store/session';

/** The prefab the Prop tool places (null: nothing armed). */
export const armedPrefabAtom = atom<string | null>(null);
/** The rotation the next prop gets, in degrees (R / Shift+R turn it). */
export const propRotationAtom = atom<number>(0);
/**
 * How high a stair or ladder flight climbs, as set in the options; null for the gap to
 * the next storey's floor (`riseToNextStop`).
 */
export const flightRiseAtom = atom<number | null>(null);

export const armedDefAtom = atom<PropDef | null>((get) => {
  const prefab = get(armedPrefabAtom);
  return prefab === null ? null : (getLibrary().propDefs.get(prefab) ?? null);
});

export interface PropGhost {
  def: PropDef;
  position: Vec2;
  rotation: number;
  /**
   * The height it stands at (absolute): the surface under the pointer; on the ground,
   * the ground at its own position.
   */
  elevation: number;
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
  const step = cursor.snapping ? get(snapStepAtom) : null;
  const position = placementPosition(cursor.raw, rotation, def.rect, step, def.snap);
  const y =
    cursor.on === 'ground'
      ? groundHeight(surfaceScene(get, get(committedPlanAtom)), position)
      : cursor.y;
  const elevation = roundElevation(clampElevation(y));
  return { def, rotation, position, elevation };
});

// The catalogue browser's search and group chips (kept across tool switches).
export const catalogQueryAtom = atom<string>('');
export const catalogGroupsAtom = atom<ReadonlySet<PropGroup>>(new Set<PropGroup>());
