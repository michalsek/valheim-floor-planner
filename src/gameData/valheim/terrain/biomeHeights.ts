/**
 * Per-biome height functions (normalised; × 200 = metres) and river carving. Our port of
 * `worldGen.py` (`h_*`, `_detail`, `_fine`, `add_rivers`); float32 rounding sits exactly
 * where the Python rounds. Ashlands and Deep North are only ported in their pregeneration
 * form (research/README.md §8).
 */
import { clamp01, lerp, lerpStep } from './mathHelpers';
import { riverWeight, type RiverPoints } from './rivers';
import { f, perlin as P } from './unityNatives';

/** What the biome functions need from the generator. */
export interface HeightContext {
  readonly off3: number;
  readonly rivers: RiverPoints;
  baseHeight(x: number, z: number): number;
}

export const C0001 = f(0.001);
export const C0002 = f(0.002);
export const C0003 = f(0.003);
export const C0005 = f(0.005);
export const C001 = f(0.01);
export const C002 = f(0.02);
export const C003 = f(0.03);
export const C004 = f(0.04);
export const C005 = f(0.05);
export const C008 = f(0.08);
export const C01 = f(0.1);
export const C02 = f(0.2);
export const C04 = f(0.4);
const C07 = f(0.7);
const C012 = f(0.12);
const C0128 = f(0.128);
const C0137 = f(0.137);
const C0139 = f(0.139);
const C014 = f(0.14);
const C015 = f(0.15);
const C075 = f(0.75);
const C085 = f(0.85);
const C12 = f(1.2);

/** Pulls `h` down into the river bed by the river weight at (x, z). */
export const addRivers = (ctx: HeightContext, x: number, z: number, h: number): number => {
  const { weight: w, width } = riverWeight(ctx.rivers, x, z);
  if (!(w > 0)) return h;
  const t = lerpStep(20, 60, width);
  const a = lerp(C014, C012, t);
  const b = lerp(C0139, C0128, t);
  const h1 = h > a ? lerp(h, a, w) : h;
  return h1 > b ? lerp(h1, b, lerpStep(C085, 1, w)) : h1;
};

interface Detail {
  X: number;
  Z: number;
  n: number;
}

/** The shifted coordinates and the two-octave-pair detail noise. */
const detail = (x: number, z: number, off: number): Detail => {
  const X = f(x + 100000 + off);
  const Z = f(z + 100000 + off);
  let n = f(P(X * C001, Z * C001) * P(X * C002, Z * C002));
  n = f(n + P(X * C005, Z * C005) * P(X * C01, Z * C01) * n * 0.5);
  return { X, Z, n };
};

/** The fine noise every land biome ends with. */
const fine = (X: number, Z: number, h: number): number => {
  const g = f(h + P(X * C01, Z * C01) * C001);
  return f(g + P(X * C04, Z * C04) * C0003);
};

/** Meadows and Plains. */
export const meadowsHeight = (ctx: HeightContext, x: number, z: number): number => {
  const base = ctx.baseHeight(x, z);
  const { X, Z, n } = detail(x, z, ctx.off3);
  let h = f(base + n * C01);
  const d = f(h - C015);
  const t = f(clamp01(base / C04));
  if (d > 0) h = f(h - d * (1 - t) * C075);
  return fine(X, Z, addRivers(ctx, x, z, h));
};

export const forestHeight = (ctx: HeightContext, x: number, z: number): number => {
  const base = ctx.baseHeight(x, z);
  const { X, Z, n } = detail(x, z, ctx.off3);
  return fine(X, Z, addRivers(ctx, x, z, f(base + n * C01)));
};

export const marshHeight = (ctx: HeightContext, x: number, z: number): number => {
  const X = f(x + 100000);
  const Z = f(z + 100000);
  const n = f(P(X * C004, Z * C004) * P(X * C008, Z * C008));
  const h = f(C0137 + n * C003);
  return fine(X, Z, addRivers(ctx, x, z, h));
};

export const mountainHeight = (ctx: HeightContext, x: number, z: number): number => {
  const base = ctx.baseHeight(x, z);
  const bh = (a: number, b: number) => ctx.baseHeight(a, b);
  const tilt = f(
    Math.abs(f(bh(f(x + 1), z) - bh(f(x - 1), z))) + Math.abs(f(bh(x, f(z + 1)) - bh(x, f(z - 1))))
  );
  const { X, Z, n } = detail(x, z, ctx.off3);
  let h = f(base + f(base - C04));
  h = f(h + n * C02);
  h = fine(X, Z, addRivers(ctx, x, z, h));
  return f(h + P(X * C02, Z * C02) * 2 * tilt);
};

export const mistlandsHeight = (ctx: HeightContext, x: number, z: number): number => {
  const base = ctx.baseHeight(x, z);
  const X = f(x + 100000 + ctx.off3);
  const Z = f(z + 100000 + ctx.off3);
  let n = f(P(X * C002 * C07, Z * C002 * C07) * P(X * C004 * C07, Z * C004 * C07));
  n = f(n + P(X * C003 * C07, Z * C003 * C07) * P(X * C005 * C07, Z * C005 * C07) * n * 0.5);
  if (n > 0) n = f(Math.pow(n, 1.5));
  let h = addRivers(ctx, x, z, f(base + n * C04));
  const t = f(clamp01(n * 7));
  h = f(h + P(X * C01, Z * C01) * C003 * t);
  h = f(h + P(X * C04, Z * C04) * C001 * t);
  const tmp = f(h + P(X * C04, Z * C04) * C0002);
  const terraced = f(Math.ceil(f(h * 400)) / 400);
  return lerp(tmp, terraced, t);
};

/** Ashlands, pregeneration form only. */
export const ashlandsPregenHeight = (ctx: HeightContext, x: number, z: number): number => {
  const base = ctx.baseHeight(x, z);
  const { X, Z, n } = detail(x, z, ctx.off3);
  const h = f(f(base + n * C01) + C01);
  return addRivers(ctx, x, z, fine(X, Z, h));
};

/** Deep North, pregeneration form only; `flag` is false in the Deep North stream pass. */
export const deepNorthPregenHeight = (
  ctx: HeightContext,
  x: number,
  z: number,
  flag: boolean
): number => {
  let b = ctx.baseHeight(x, z);
  if (!flag) b = f(b + C01);
  const X = f(x + 100000 + ctx.off3);
  const Z = f(z + 100000 + ctx.off3);
  b = f(b + Math.max(0, f(b - C04)));
  let n = f(P(X * C001, Z * C001) * P(X * C002, Z * C002));
  n = f(n + P(X * C005, Z * C005) * P(X * C01, Z * C01) * n * 0.5);
  b = f(f(b + n * C02) * C12);
  b = addRivers(ctx, x, z, b);
  b = f(b + P(f(X * C01), f(Z * C01)) * C001);
  return f(b + P(f(X * C04), f(Z * C04)) * C0003);
};
