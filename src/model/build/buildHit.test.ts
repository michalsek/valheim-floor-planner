import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { rawBox } from '../rawBoxes';
import type { TerrainGrid } from '../terrain/siteTerrain';

import { buildHit, hitOnGrid, type BuildScene } from './buildHit';

// Flat ground 1 m above the plan's datum, over plan x 0…20, z −20…0.
const grid: TerrainGrid = {
  x0: 0,
  z0: 0,
  cols: 21,
  rows: 21,
  heights: new Float32Array(21 * 21).fill(1),
};
const terrain = { grid, frame: { origin: { x: 0, y: 0, z: 0 }, yaw: 0 } };
const pole = rawBox(
  {
    id: 'p',
    prefab: 'wood_pole2',
    position: { x: 5, y: 2, z: -5 },
    rotation: { yaw: 0, pitch: 0, roll: 0 },
    elevation: 0,
  },
  testLibrary
);
const scene: BuildScene = { boxes: [pole], terrain, datum: 0 };
const down = (x: number, z: number) => ({ origin: { x, y: 10, z }, dir: { x: 0, y: -1, z: 0 } });

describe('buildHit', () => {
  it('takes the nearest of a piece, the ground and the plate', () => {
    expect(buildHit(down(5, -5), scene)).toMatchObject({ surface: 'piece', t: 7, box: pole });
    expect(buildHit(down(8, -5), scene)).toMatchObject({ surface: 'terrain', normal: { y: 1 } });
    expect(buildHit(down(8, 5), scene)).toMatchObject({ surface: 'plate', t: 10 });
    expect(buildHit(down(8, 5), { ...scene, maxT: 9 })).toBeNull();
  });

  it('gives a piece the normal of the face hit', () => {
    const side = { origin: { x: 0, y: 2, z: -5 }, dir: { x: 1, y: 0, z: 0 } };
    expect(buildHit(side, scene)?.normal.x).toBe(-1);
  });

  it('moves ground and plate hits onto the grid, not piece hits', () => {
    const plate = buildHit(down(8.3, 5.2), scene)!;
    expect(hitOnGrid(plate, 0.5, scene).point).toEqual({ x: 8.5, y: 0, z: 5 });
    const ground = buildHit(down(8.3, -5.2), scene)!;
    expect(hitOnGrid(ground, 1, scene).point).toEqual({ x: 8, y: 1, z: -5 });
    const piece = buildHit(down(5.1, -5.1), scene)!;
    expect(hitOnGrid(piece, 1, scene)).toBe(piece);
  });
});
