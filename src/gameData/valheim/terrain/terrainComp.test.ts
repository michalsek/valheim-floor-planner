/// <reference types="node" />
import { gunzipSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { zoneOrigin } from './heightmap';
import { applyTerrainComps, decodeTerrainComp, type TerrainComp } from './terrainComp';

/** A `TCData` payload: `edits` maps vertex index → [level, smooth]; one painted vertex. */
const payload = (edits: Map<number, [number, number]>): Uint8Array => {
  const bytes: number[] = [];
  const view = new DataView(new ArrayBuffer(4));
  const i32 = (v: number) => {
    view.setInt32(0, v, true);
    bytes.push(...new Uint8Array(view.buffer));
  };
  const f32 = (v: number) => {
    view.setFloat32(0, v, true);
    bytes.push(...new Uint8Array(view.buffer));
  };
  i32(1);
  i32(edits.size);
  [10, 0, 20, 4].forEach(f32); // last op point, radius
  i32(4225);
  for (let i = 0; i < 4225; i++) {
    const e = edits.get(i);
    bytes.push(e ? 1 : 0);
    if (e) e.forEach(f32);
  }
  i32(4225);
  for (let i = 0; i < 4225; i++) {
    bytes.push(i === 7 ? 1 : 0);
    if (i === 7) [1, 0, 0, 1].forEach(f32);
  }
  return gunzipSync(gzipSync(Uint8Array.from(bytes)));
};

const comp = (edits: [number, number, number][]): TerrainComp =>
  decodeTerrainComp(payload(new Map(edits.map(([i, l, s]) => [i, [l, s]]))));

describe('TerrainComp', () => {
  it('decodes a payload to the last byte', () => {
    const c = comp([[5 * 65 + 3, -1.5, 0.25]]);
    expect(c).toMatchObject({ version: 1, ops: 1 });
    expect(c.delta[5 * 65 + 3]).toBe(-1.25);
    expect(c.edited.reduce((a, b) => a + b, 0)).toBe(1);
    const extra = new Uint8Array([...payload(new Map()), 0]);
    expect(() => decodeTerrainComp(extra)).toThrow(/after terrain edits/);
  });

  it('puts vertex (col 3, row 5) at world (x0 + 3, z0 + 5) and clamps to ±8 m', () => {
    const [zx, zz] = [2, -1];
    const rect = { x0: zoneOrigin(zx), z0: zoneOrigin(zz), cols: 10, rows: 10 };
    const heights = new Float32Array(100).fill(30);
    const c = comp([
      [5 * 65 + 3, 2, -0.5],
      [65 + 1, -12, 0],
    ]);
    expect(applyTerrainComps(heights, rect, [{ zx, zz, comp: c }])).toBe(2);
    expect(heights[5 * 10 + 3]).toBe(31.5);
    expect(heights[1 * 10 + 1]).toBe(22);
    expect(heights.filter((h) => h !== 30)).toHaveLength(2);
  });

  it('takes an edge vertex from the zone that owns it', () => {
    // World x = zoneOrigin(1) is col 64 of zone 0 and col 0 of zone 1, which owns it.
    const rect = { x0: zoneOrigin(1) - 1, z0: zoneOrigin(0), cols: 3, rows: 1 };
    const heights = new Float32Array(3);
    const left = { zx: 0, zz: 0, comp: comp([[64, 5, 0]]) };
    const right = { zx: 1, zz: 0, comp: comp([[0, 1, 0]]) };
    applyTerrainComps(heights, rect, [left, right]);
    expect([...heights]).toEqual([0, 1, 0]);
    applyTerrainComps(heights, rect, [left]);
    expect([...heights]).toEqual([0, 1, 0]);
  });
});
