import { describe, expect, it } from 'vitest';

import type { SiteTerrain } from '../types';

import { growRect, growSiteTerrain } from './siteExtend';
import { siteTiles } from './siteTiles';

/** A 300 × 200 vertex patch of rolling ground, biomes over it. */
const terrain: SiteTerrain = {
  x0: -100,
  z0: 40,
  cols: 300,
  rows: 200,
  heights: Int16Array.from({ length: 300 * 200 }, (_, k) => Math.round(500 * Math.sin(k / 97))),
  biomes: { zx0: -2, zz0: 0, cols: 7, rows: 5, codes: new Array<number>(35).fill(1) },
  worldGenVersion: 2,
  revision: 1,
  notices: { locations: [], legacyEdits: 0, unreadEdits: 0, check: { n: 0, maxError: 0 } },
};
const frame = { origin: { x: 10, y: 30, z: -5 }, yaw: 22.5 };

describe('site tiles', () => {
  it('cover every quad once, on 128 m squares from a zone border', () => {
    const tiles = siteTiles(terrain, frame);
    const quads = new Uint8Array((terrain.cols - 1) * (terrain.rows - 1));
    for (const t of tiles) {
      expect((terrain.x0 + t.i0 + 32) % 128 === 0 || t.i0 === 0).toBe(true);
      for (let j = t.j0; j < t.j1; j++) {
        for (let i = t.i0; i < t.i1; i++) quads[j * (terrain.cols - 1) + i]!++;
      }
    }
    expect(quads.every((n) => n === 1)).toBe(true);
  });

  it('keep the keys of the tiles an extension leaves alone', () => {
    const growth = growRect(terrain, 'east', 64)!;
    const strip = {
      heights: new Int16Array(growth.strip.cols * growth.strip.rows).fill(-100),
      biomes: { zx0: 2, zz0: 0, cols: 3, rows: 5, codes: new Array<number>(15).fill(8) },
    };
    const grown = growSiteTerrain(terrain, growth, strip, terrain.notices);
    const before = new Map(siteTiles(terrain, frame).map((t) => [t.id, t.key]));
    const after = siteTiles(grown, frame);
    const kept = after.filter((t) => before.get(t.id) === t.key).map((t) => t.id);
    // The east column of tiles (its border and the new strip) changed; the rest did not.
    const eastmost = Math.max(...after.map((t) => Number(t.id.split(',')[0])));
    const changedColumns = new Set(
      after.filter((t) => !kept.includes(t.id)).map((t) => Number(t.id.split(',')[0]))
    );
    expect(kept.length).toBeGreaterThan(0);
    expect([...changedColumns].every((tx) => tx >= eastmost - 1)).toBe(true);
    expect(siteTiles(terrain, { ...frame, yaw: 0 }).every((t) => before.get(t.id) !== t.key)).toBe(
      true
    );
  });
});
