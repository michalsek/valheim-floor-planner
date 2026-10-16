import { atom } from 'jotai';

import type { FloorFamily } from '../../catalog/floorFamilies';
import { formatArea, formatSize } from '../../format';
import { boxArea, boxFromCorners, boxSize, type WorldBox } from '../../model/geometry/box';
import { splitFloor, type FloorSplit } from '../../model/splitFloor';
import type { Vec2 } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
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
  const family = getLibrary().floorFamilies.get(familyId);
  const split = family ? splitFloor({ id: 'preview', familyId, ...box }, family) : null;
  return { box, family, split };
});

/** "6× Wood Floor 2x2 · 4× Wood Floor 1x1": tile counts, largest first. */
const tileSummary = (prefabs: readonly string[]): string => {
  const counts = new Map<string, number>();
  for (const prefab of prefabs) counts.set(prefab, (counts.get(prefab) ?? 0) + 1);
  return [...counts]
    .map(([prefab, n]) => `${n}× ${getLibrary().catalog.pieces.get(prefab)?.name ?? prefab}`)
    .join(' · ');
};

/**
 * The dragged floor's label: size, area and tiles; and the warning for what its tiles
 * can't cover (null when they cover it all). Both views show it.
 */
export const floorPreviewText = ({
  box,
  family,
  split,
}: FloorPreviewState): { summary: string; leftover: string | null } => {
  const size = boxSize(box);
  const tiles = split ? tileSummary(split.pieces.map((p) => p.prefab)) : '';
  const summary = [`${formatSize(size.x, size.z)} m`, formatArea(boxArea(box)), tiles]
    .filter(Boolean)
    .join(' · ');
  const leftover =
    split && split.leftover > 0 && family
      ? `${formatArea(split.leftover)} can't be tiled with ${family.minTile}×${family.minTile}`
      : null;
  return { summary, leftover };
};
