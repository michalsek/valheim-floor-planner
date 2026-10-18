/**
 * `HeightmapBuilder.Build`: the game's 1 m vertex grid. A zone (64 m) has 65 × 65 vertices
 * at integer world coordinates `zone × 64 − 32 + i`, rows along z. When the zone's four
 * corner biomes differ, each vertex blends their heights with `SmoothStep(0, 1, i / 64)`
 * weights. Our port of `worldGen.py` (`zone_heights`).
 */
import { lerp, smoothStep } from './mathHelpers';
import { f } from './unityNatives';
import type { WorldGenerator } from './worldGenerator';

export const ZONE_SIZE = 64;
export const ZONE_VERTICES = ZONE_SIZE + 1;

/** A block of world vertices: (x0, z0) is vertex (0, 0); rows run along world +z. */
export interface PatchRect {
  x0: number;
  z0: number;
  cols: number;
  rows: number;
}

/** The zone that owns a world vertex coordinate: its low edge is in, its high edge is not. */
export const zoneOf = (v: number): number => Math.floor((v + ZONE_SIZE / 2) / ZONE_SIZE);

/** World coordinate of a zone's vertex 0. */
export const zoneOrigin = (zone: number): number => zone * ZONE_SIZE - ZONE_SIZE / 2;

const BLEND = Float64Array.from({ length: ZONE_VERTICES }, (_, i) =>
  smoothStep(0, 1, f(i / ZONE_SIZE))
);

/** The biomes at a zone's corners: (x0, z0), (x0 + 64, z0), (x0, z0 + 64), (x0 + 64, z0 + 64). */
export const zoneCorners = (gen: WorldGenerator, zx: number, zz: number): number[] => {
  const x0 = zoneOrigin(zx);
  const z0 = zoneOrigin(zz);
  return [
    gen.biome(x0, z0),
    gen.biome(x0 + ZONE_SIZE, z0),
    gen.biome(x0, z0 + ZONE_SIZE),
    gen.biome(x0 + ZONE_SIZE, z0 + ZONE_SIZE),
  ];
};

/** Height (metres) of vertex (col, row) of a zone with these corner biomes. */
const vertexHeight = (
  gen: WorldGenerator,
  corners: readonly number[],
  x0: number,
  z0: number,
  col: number,
  row: number
): number => {
  const x = x0 + col;
  const z = z0 + row;
  const [b0, b1, b2, b3] = corners as [number, number, number, number];
  if (b0 === b1 && b0 === b2 && b0 === b3) return gen.biomeHeight(b0, x, z);
  const memo = new Map<number, number>();
  const h = (b: number) => {
    let v = memo.get(b);
    if (v === undefined) memo.set(b, (v = gen.biomeHeight(b, x, z)));
    return v;
  };
  const tx = BLEND[col]!;
  const tz = BLEND[row]!;
  return lerp(lerp(h(b0), h(b1), tx), lerp(h(b2), h(b3), tx), tz);
};

/** A zone's 65 × 65 base heights (metres), index `row × 65 + col`, and its corner biomes. */
export const zoneHeights = (gen: WorldGenerator, zx: number, zz: number) => {
  const corners = zoneCorners(gen, zx, zz);
  const x0 = zoneOrigin(zx);
  const z0 = zoneOrigin(zz);
  const heights = new Float32Array(ZONE_VERTICES * ZONE_VERTICES);
  for (let row = 0; row < ZONE_VERTICES; row++) {
    for (let col = 0; col < ZONE_VERTICES; col++) {
      heights[row * ZONE_VERTICES + col] = vertexHeight(gen, corners, x0, z0, col, row);
    }
  }
  return { heights, corners };
};

/** Zone-corner biomes over a patch; corner (0, 0) is at world (zx0·64 − 32, zz0·64 − 32). */
export interface CornerBiomes {
  zx0: number;
  zz0: number;
  cols: number;
  rows: number;
  codes: number[];
}

/** The zone-corner biome grid over the zones a patch touches. */
export const patchCorners = (gen: WorldGenerator, rect: PatchRect): CornerBiomes => {
  const zx0 = zoneOf(rect.x0);
  const zz0 = zoneOf(rect.z0);
  const cols = zoneOf(rect.x0 + rect.cols - 1) - zx0 + 2;
  const rows = zoneOf(rect.z0 + rect.rows - 1) - zz0 + 2;
  const codes: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) codes.push(gen.biome(zoneOrigin(zx0 + i), zoneOrigin(zz0 + j)));
  }
  return { zx0, zz0, cols, rows, codes };
};

/**
 * Base heights (metres) over a patch, row-major (row = z), zone by zone: each vertex comes
 * from the zone that owns it (shared edges are equal in both zones anyway).
 */
export const buildPatch = (gen: WorldGenerator, rect: PatchRect) => {
  const biomes = patchCorners(gen, rect);
  const heights = new Float32Array(rect.cols * rect.rows);
  const corner = (i: number, j: number) => biomes.codes[j * biomes.cols + i]!;
  for (let row = 0; row < rect.rows; row++) {
    const z = rect.z0 + row;
    const j = zoneOf(z) - biomes.zz0;
    const z0 = zoneOrigin(zoneOf(z));
    for (let col = 0; col < rect.cols; col++) {
      const x = rect.x0 + col;
      const i = zoneOf(x) - biomes.zx0;
      const x0 = zoneOrigin(zoneOf(x));
      const corners = [corner(i, j), corner(i + 1, j), corner(i, j + 1), corner(i + 1, j + 1)];
      heights[row * rect.cols + col] = vertexHeight(gen, corners, x0, z0, x - x0, z - z0);
    }
  }
  return { heights, biomes };
};
