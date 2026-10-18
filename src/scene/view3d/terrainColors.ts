/**
 * The 3D terrain's ground colours: a muted tint per biome, blended between the zone
 * corners as the game blends their heights, turning to rock on steep slopes and to sand
 * below the sea. Colours are linear RGB (three.js vertex colours).
 */
import { Color } from 'three/webgpu';

import type { SiteTerrain } from '../../model/types';

/** Biome codes (the game's bitmask) and their ground tints. */
const BIOME_TINTS: Readonly<Record<number, string>> = {
  1: '#7d9a4f', // Meadows
  2: '#5f5b3e', // Swamp
  4: '#c9ccd0', // Mountain (snow)
  8: '#556e3c', // Black Forest
  16: '#b0a45e', // Plains
  256: '#a39a78', // Ocean (sea bed)
  512: '#5c6560', // Mistlands
};
const FALLBACK_TINT = '#7d9a4f';
const ROCK = '#7b7871';
const SAND = '#a39a78';
/** The skirts: the cut earth under the site. */
export const EARTH = '#8a7058';

/** Slopes turn to rock from `ROCK_FROM` to `ROCK_FULL` degrees. */
const ROCK_FROM = 40;
const ROCK_FULL = 55;
/** Ground turns to sand from this far above the sea to this far below it (metres). */
const SAND_ABOVE = 0.5;
const SAND_BELOW = 1;

const ZONE = 64;

export type Rgb = readonly [number, number, number];

export const linear = (hex: string): Rgb => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const tints = new Map<number, Rgb>(
  Object.entries(BIOME_TINTS).map(([code, hex]) => [Number(code), linear(hex)])
);
const fallbackTint = linear(FALLBACK_TINT);
const tintOf = (code: number): Rgb => tints.get(code) ?? fallbackTint;
const rock = linear(ROCK);
const sand = linear(SAND);

const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Moves `out[at..at + 2]` towards `c` by `t`, in place. */
const mixInto = (out: Float32Array, at: number, c: ArrayLike<number>, t: number) => {
  for (let k = 0; k < 3; k++) out[at + k] = out[at + k]! + (c[k]! - out[at + k]!) * t;
};

const far = new Float32Array(3);

/**
 * Writes the colour of world vertex (x, z) to `out` at `at`: the zone's corner tints
 * blended with the heightmap's smoothstep weights, then rock by `slope` (degrees) and
 * sand by `belowSea` (metres under the sea, negative above it).
 */
export const groundColor = (
  out: Float32Array,
  at: number,
  biomes: SiteTerrain['biomes'],
  x: number,
  z: number,
  slope: number,
  belowSea: number
): void => {
  const zx = Math.floor((x + ZONE / 2) / ZONE);
  const zz = Math.floor((z + ZONE / 2) / ZONE);
  const tx = smoothstep(0, 1, (x - (zx * ZONE - ZONE / 2)) / ZONE);
  const tz = smoothstep(0, 1, (z - (zz * ZONE - ZONE / 2)) / ZONE);
  const i = Math.min(Math.max(zx - biomes.zx0, 0), biomes.cols - 2);
  const j = Math.min(Math.max(zz - biomes.zz0, 0), biomes.rows - 2);
  const tint = (di: number, dj: number) => tintOf(biomes.codes[(j + dj) * biomes.cols + i + di]!);
  out.set(tint(0, 0), at);
  far.set(tint(0, 1));
  mixInto(out, at, tint(1, 0), tx);
  mixInto(far, 0, tint(1, 1), tx);
  mixInto(out, at, far, tz);
  mixInto(out, at, rock, smoothstep(ROCK_FROM, ROCK_FULL, slope));
  mixInto(out, at, sand, smoothstep(-SAND_ABOVE, SAND_BELOW, belowSea));
};
