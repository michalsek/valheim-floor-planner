/**
 * Tiles a floor rectangle with a family's square tiles, largest first: a block of the
 * largest tile that fits from the min corner, then the strips left on the right and
 * at the bottom with the smaller sizes. What no tile fits is reported as leftover.
 */
import type { FloorFamily, FloorTileDef } from '../catalog/floorFamilies';

import { boxSize, type WorldBox } from './geometry/box';
import { EPS } from './geometry/polyline';
import type { Floor, PlacedPiece, Vec2 } from './types';

export interface FloorSplit {
  pieces: PlacedPiece[];
  /** Area (m²) no tile fits. */
  leftover: number;
}

interface PlacedTile {
  tile: FloorTileDef;
  min: Vec2;
}

/** Tiles `rect` with `tiles` (largest first) into `out`; returns the leftover area. */
const tileRect = (rect: WorldBox, tiles: readonly FloorTileDef[], out: PlacedTile[]): number => {
  const { x: w, z: d } = boxSize(rect);
  if (w < EPS || d < EPS) return 0;
  const tile = tiles.find((t) => t.size <= Math.min(w, d) + EPS);
  if (!tile) return w * d;

  const s = tile.size;
  const nx = Math.floor((w + EPS) / s);
  const nz = Math.floor((d + EPS) / s);
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      out.push({ tile, min: { x: rect.min.x + i * s, z: rect.min.z + j * s } });
    }
  }

  const smaller = tiles.filter((t) => t.size < s - EPS);
  const blockMax = { x: rect.min.x + nx * s, z: rect.min.z + nz * s };
  const right = { min: { x: blockMax.x, z: rect.min.z }, max: rect.max };
  const bottom = { min: { x: rect.min.x, z: blockMax.z }, max: { x: blockMax.x, z: rect.max.z } };
  return tileRect(right, smaller, out) + tileRect(bottom, smaller, out);
};

/**
 * Which checkerboard shade a tile gets (true for the darker one), from its place on its
 * own size's grid.
 */
export const isOddTile = (tile: PlacedPiece): boolean => {
  const size = tile.footprint.length;
  const i = Math.round((tile.center.x - size / 2) / size);
  const j = Math.round((tile.center.z - size / 2) / size);
  return (i + j) % 2 !== 0;
};

export const splitFloor = (floor: Floor, family: FloorFamily): FloorSplit => {
  const placed: PlacedTile[] = [];
  const leftover = tileRect(floor, family.tiles, placed);
  const pieces = placed.map(({ tile, min }, n): PlacedPiece => ({
    key: `${floor.id}:0:0:${n}`,
    kind: 'floor',
    prefab: tile.prefab,
    material: family.material,
    sourceId: floor.id,
    segment: 0,
    course: 0,
    base: 0,
    height: tile.thickness,
    center: { x: min.x + tile.size / 2, z: min.z + tile.size / 2 },
    rotation: 0,
    footprint: { length: tile.size, thickness: tile.size },
  }));
  return { pieces, leftover: leftover < EPS ? 0 : leftover };
};
