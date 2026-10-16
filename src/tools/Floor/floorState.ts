import { atom } from 'jotai';

import { library } from '../../catalog';
import type { FloorFamily } from '../../catalog/floorFamilies';
import { boxFromCorners, type WorldBox } from '../../model/geometry/box';
import { splitFloor, type FloorSplit } from '../../model/splitFloor';
import type { Vec2 } from '../../model/types';
import { floorFamilyIdAtom } from '../../store/session';

/** The floor rectangle being dragged (session state, never in history). */
export type FloorDrag = { phase: 'idle' } | { phase: 'drag'; a: Vec2; b: Vec2 };

export const FLOOR_IDLE: FloorDrag = { phase: 'idle' };

export const floorDragAtom = atom<FloorDrag>(FLOOR_IDLE);

export interface FloorPreviewState {
  box: WorldBox;
  family: FloorFamily | undefined;
  split: FloorSplit | null;
}

/** The floor a release would commit, with its tiles. */
export const floorPreviewAtom = atom<FloorPreviewState | null>((get) => {
  const drag = get(floorDragAtom);
  if (drag.phase === 'idle') return null;
  const box = boxFromCorners(drag.a, drag.b);
  const familyId = get(floorFamilyIdAtom);
  const family = library.floorFamilies.get(familyId);
  const split = family ? splitFloor({ id: 'preview', familyId, ...box }, family) : null;
  return { box, family, split };
});
