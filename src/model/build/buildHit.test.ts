import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { rawBox } from '../rawBoxes';
import type { TerrainGrid } from '../terrain/siteTerrain';

import { buildHit, downHit, hitOnGrid, restingHit, type BuildScene } from './buildHit';

// Flat terrain 1 m above the plan's 0, over plan x 0…20, z −20…0.
const grid: TerrainGrid = {
  x0: 0,
  z0: 0,
  cols: 21,
  rows: 21,
  heights: new Float32Array(21 * 21).fill(1),
};
const terrain = { grid, frame: { origin: { x: 0, y: 0, z: 0 }, yaw: 0 } };
/** A 2 m pole about its middle, at height `y`. */
const poleAt = (y: number) => ({
  id: 'p',
  prefab: 'wood_pole2',
  position: { x: 5, y, z: -5 },
  rotation: { yaw: 0, pitch: 0, roll: 0 },
});
// 1 m to 3 m.
const pole = rawBox(poleAt(2), testLibrary);
const scene: BuildScene = { boxes: [pole], terrain };
const down = (x: number, z: number) => ({ origin: { x, y: 10, z }, dir: { x: 0, y: -1, z: 0 } });

describe('buildHit', () => {
  it('takes the nearest of a piece, the terrain and the ground', () => {
    expect(buildHit(down(5, -5), scene)).toMatchObject({ surface: 'piece', t: 7, box: pole });
    expect(buildHit(down(8, -5), scene)).toMatchObject({
      surface: 'terrain',
      point: { y: 1 },
      normal: { y: 1 },
    });
    // Off the patch, the plane 0, from above only.
    expect(buildHit(down(8, 5), scene)).toMatchObject({
      surface: 'ground',
      t: 10,
      point: { y: 0 },
    });
    expect(buildHit(down(8, 5), { ...scene, maxT: 9 })).toBeNull();
    const up = { origin: { x: 8, y: -2, z: 5 }, dir: { x: 0, y: 1, z: 0 } };
    expect(buildHit(up, scene)).toBeNull();
  });

  it('gives a piece the normal of the face hit', () => {
    const side = { origin: { x: 0, y: 2, z: -5 }, dir: { x: 1, y: 0, z: 0 } };
    expect(buildHit(side, scene)?.normal.x).toBe(-1);
  });

  it('moves ground and terrain hits onto the grid, not piece hits', () => {
    const ground = buildHit(down(8.3, 5.2), scene)!;
    expect(hitOnGrid(ground, 0.5, scene).point).toEqual({ x: 8.5, y: 0, z: 5 });
    const onTerrain = buildHit(down(8.3, -5.2), scene)!;
    expect(hitOnGrid(onTerrain, 1, scene).point).toEqual({ x: 8, y: 1, z: -5 });
    const piece = buildHit(down(5.1, -5.1), scene)!;
    expect(hitOnGrid(piece, 1, scene)).toBe(piece);
  });

  it('rests a side-face hit on the surface below it', () => {
    const side = { origin: { x: 0, y: 2, z: -5 }, dir: { x: 1, y: 0, z: 0 } };
    expect(restingHit(side, scene)).toMatchObject({ surface: 'terrain', point: { y: 1 } });
    // An underside drops too: a ray up into a pole from 4 m to 6 m.
    const high = rawBox({ ...poleAt(5), id: 'h' }, testLibrary);
    const up = { origin: { x: 5, y: 2, z: -5 }, dir: { x: 0, y: 1, z: 0 } };
    expect(restingHit(up, { ...scene, boxes: [high] })).toMatchObject({
      surface: 'terrain',
      point: { y: 1 },
    });
    // With nothing below (a pole under the flat ground), the face hit stays.
    const buried = rawBox(poleAt(-5), testLibrary);
    const under = { origin: { x: 0, y: -5, z: -5 }, dir: { x: 1, y: 0, z: 0 } };
    expect(restingHit(under, { boxes: [buried], terrain: null })).toMatchObject({
      surface: 'piece',
      normal: { x: -1 },
    });
  });

  it('looks straight down from the sky onto the topmost piece, else the ground', () => {
    expect(downHit({ x: 5, z: -5 }, scene)).toMatchObject({ surface: 'piece', point: { y: 3 } });
    expect(downHit({ x: 8, z: -5 }, scene)).toMatchObject({ surface: 'terrain', point: { y: 1 } });
    expect(downHit({ x: 8, z: 5 }, scene)).toMatchObject({ surface: 'ground', point: { y: 0 } });
  });
});
