/** Floor tiles, per-floor sizes and floor warnings (tiles cached per floor). */
import type { FloorFamily } from '../catalog/floorFamilies';
import type { Library } from '../catalog/library';

import { boxArea, boxIntersection, boxSize } from './geometry/box';
import { EPS } from './geometry/polyline';
import { splitFloor, type FloorSplit } from './splitFloor';
import type { Floor, FloorId, PlacedPiece, Plan, PlanWarning, Vec2 } from './types';

export interface FloorInfo {
  id: FloorId;
  size: Vec2;
  area: number;
  /** Area (m²) the family's tiles can't cover. */
  leftover: number;
}

export interface FloorsResult {
  pieces: PlacedPiece[];
  warnings: PlanWarning[];
  floors: FloorInfo[];
}

const floorCache = new WeakMap<Floor, { family: FloorFamily | undefined; split: FloorSplit }>();

const splitCached = (floor: Floor, family: FloorFamily | undefined): FloorSplit => {
  const cached = floorCache.get(floor);
  if (cached && cached.family === family) return cached.split;
  const split = family ? splitFloor(floor, family) : { pieces: [], leftover: boxArea(floor) };
  floorCache.set(floor, { family, split });
  return split;
};

const round = (n: number): string => String(Math.round(n * 100) / 100);

const floorWarning = (id: FloorId, message: string): PlanWarning => ({
  source: { kind: 'floor', id },
  segment: null,
  message,
  level: 'warning',
});

/** One warning per later floor of each overlapping pair: both are counted in full. */
const overlapWarnings = (floors: readonly Floor[]): PlanWarning[] =>
  floors.flatMap((floor, i) =>
    floors.slice(0, i).flatMap((other) => {
      const overlap = boxIntersection(floor, other);
      const area = overlap ? boxArea(overlap) : 0;
      return area > EPS
        ? [floorWarning(floor.id, `Floors overlap by ${round(area)} m²: tiles counted twice`)]
        : [];
    })
  );

export const deriveFloors = (plan: Plan, lib: Library): FloorsResult => {
  const floors = Object.values(plan.floors);
  const pieces: PlacedPiece[] = [];
  const warnings: PlanWarning[] = [];
  const infos = floors.map((floor): FloorInfo => {
    const family = lib.floorFamilies.get(floor.familyId);
    const { pieces: tiles, leftover } = splitCached(floor, family);
    pieces.push(...tiles);
    if (!family) {
      warnings.push(floorWarning(floor.id, `Unknown floor family "${floor.familyId}"`));
    } else if (leftover > EPS) {
      const tile = `${family.minTile}×${family.minTile}`;
      const message = `${round(leftover)} m² of ${family.label.toLowerCase()} floor can't be tiled with ${tile}`;
      warnings.push(floorWarning(floor.id, message));
    }
    return { id: floor.id, size: boxSize(floor), area: boxArea(floor), leftover };
  });
  return { pieces, warnings: [...warnings, ...overlapWarnings(floors)], floors: infos };
};
