/**
 * What the terrain worker does, as a plain function (the gated world test runs it in
 * Node): the world's rivers (kept, or pregenerated once per world), the generated ground
 * over the patch, the save's terrain edits on top, then the self-check of the save's own
 * location heights against the generator's. No network, no DOM.
 */
import { gunzip } from '../gameData/bytes/gunzip';
import { GameDataError } from '../gameData/GameDataError';
import { biomeName, isPorted } from '../gameData/valheim/terrain/biomes';
import {
  buildPatch,
  patchCorners,
  type CornerBiomes,
  type PatchRect,
} from '../gameData/valheim/terrain/heightmap';
import { decodePregenerated, encodePregenerated } from '../gameData/valheim/terrain/pregenCodec';
import {
  patchRiverCells,
  pregenerate,
  restoreRivers,
  withDeepNorth,
  type Pregenerated,
} from '../gameData/valheim/terrain/pregenerate';
import { cellKey, riverCell } from '../gameData/valheim/terrain/rivers';
import { applyTerrainComps, decodeTerrainComp } from '../gameData/valheim/terrain/terrainComp';
import { WorldGenerator } from '../gameData/valheim/terrain/worldGenerator';
import type { WorldSite } from '../gameData/valheim/world/worldFiles';
import type { TerrainCompBlob } from '../gameData/valheim/world/worldTerrain';

/**
 * The Deep North stream pass (~3 000 more attempts) runs only for ground this close to
 * the Deep North (metres): its streams start inside it and run at most ~200 m.
 */
export const DEEP_NORTH_MARGIN = 600;
/** Spacing of the points tested for the Deep North (metres). */
const DEEP_NORTH_STEP = 50;

export interface TerrainJob {
  site: WorldSite;
  rect: PatchRect;
  /** The save's terrain edits of the zones the patch touches. */
  comps: TerrainCompBlob[];
  /** x, y, z of the save's location instances to check the generator against. */
  checks: Float32Array;
  /** The world's kept pregeneration (`encodePregenerated`), or null. */
  rivers: ArrayBuffer | null;
}

/** 'rivers': pregenerating them (the first time for a world, ~1 s). */
export type TerrainPhase = 'rivers' | 'deepNorth' | 'ground' | 'edits' | 'check';

export interface TerrainResult {
  /** World heights (metres) at the patch's vertices, row-major (row = world z). */
  heights: Float32Array<ArrayBuffer>;
  biomes: CornerBiomes;
  /** The save's location heights against the generator's (Ashlands and Deep North skipped). */
  check: { n: number; maxError: number };
  /** Vertices the save's terrain edits changed. */
  edited: number;
  /** A new or extended pregeneration to keep; null when the kept one served. */
  rivers: ArrayBuffer | null;
  /** Milliseconds per phase. */
  ms: { rivers: number; ground: number; edits: number; check: number };
}

const firstUnported = (gen: WorldGenerator, rect: PatchRect): number | null =>
  patchCorners(gen, rect).codes.find((code) => !isPorted(code)) ?? null;

/**
 * The first zone-corner biome under the patch the port can't make ground for (Ashlands,
 * Deep North), or null: milliseconds, so a site is turned away before pregenerating.
 */
export const unsupportedBiome = (site: WorldSite, rect: PatchRect): number | null =>
  firstUnported(new WorldGenerator(site.seed, site.worldGenVersion), rect);

/** Whether any point of the box (world x, z) lies in the Deep North, sampled. */
const touchesDeepNorth = (
  gen: WorldGenerator,
  x0: number,
  z0: number,
  x1: number,
  z1: number
): boolean => {
  const steps = (a: number, b: number) => Math.max(1, Math.ceil((b - a) / DEEP_NORTH_STEP));
  const nx = steps(x0, x1);
  const nz = steps(z0, z1);
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      if (gen.isDeepNorth(x0 + ((x1 - x0) * i) / nx, z0 + ((z1 - z0) * j) / nz)) return true;
    }
  }
  return false;
};

const nearDeepNorth = (gen: WorldGenerator, rect: PatchRect): boolean =>
  touchesDeepNorth(
    gen,
    rect.x0 - DEEP_NORTH_MARGIN,
    rect.z0 - DEEP_NORTH_MARGIN,
    rect.x0 + rect.cols - 1 + DEEP_NORTH_MARGIN,
    rect.z0 + rect.rows - 1 + DEEP_NORTH_MARGIN
  );

const decodeKept = (buffer: ArrayBuffer | null): Pregenerated | null => {
  if (!buffer) return null;
  try {
    return decodePregenerated(buffer);
  } catch {
    return null; // A damaged file: pregenerate again.
  }
};

/** The check locations to use: without the Deep North pass, none near the Deep North. */
const checkPoints = (gen: WorldGenerator, checks: Float32Array, deep: boolean): number[] => {
  const kept: number[] = [];
  for (let i = 0; i < checks.length; i += 3) {
    const x = checks[i]!;
    const z = checks[i + 2]!;
    const m = DEEP_NORTH_MARGIN;
    if (deep || !touchesDeepNorth(gen, x - m, z - m, x + m, z + m)) kept.push(i);
  }
  return kept;
};

const decodeComps = async (blobs: readonly TerrainCompBlob[]) =>
  Promise.all(
    blobs.map(async ({ zx, zz, data }) => ({ zx, zz, comp: decodeTerrainComp(await gunzip(data)) }))
  );

/** Makes the site's ground; `onPhase` hears each step as it starts. */
export const runTerrainJob = async (
  job: TerrainJob,
  onPhase: (phase: TerrainPhase) => void = () => {}
): Promise<TerrainResult> => {
  const { site, rect } = job;
  const gen = new WorldGenerator(site.seed, site.worldGenVersion);
  const unsupported = firstUnported(gen, rect);
  if (unsupported !== null) {
    throw new GameDataError('unsupported', `${biomeName(unsupported)} ground isn’t supported yet`);
  }
  const needDeep = nearDeepNorth(gen, rect);
  let at = performance.now();
  const lap = () => {
    const now = performance.now();
    const ms = now - at;
    at = now;
    return ms;
  };

  // The rivers: a fresh pregeneration (or adding the Deep North pass) leaves every point
  // rendered; a kept one is re-rendered for the cells the patch and the checks read.
  const kept = decodeKept(job.rivers);
  let pre: Pregenerated;
  let rivers: ArrayBuffer | null = null;
  if (!kept) {
    onPhase('rivers');
    pre = pregenerate(gen, { deepNorth: needDeep });
    rivers = encodePregenerated(pre);
  } else if (needDeep && !kept.deepStreams) {
    onPhase('deepNorth');
    pre = withDeepNorth(gen, kept);
    rivers = encodePregenerated(pre);
  } else {
    pre = kept;
  }
  const checks = checkPoints(gen, job.checks, pre.deepStreams !== null);
  if (!rivers) {
    const cells = patchRiverCells(rect);
    for (const i of checks) {
      cells.add(cellKey(riverCell(job.checks[i]!), riverCell(job.checks[i + 2]!)));
    }
    restoreRivers(gen, pre, cells);
  }
  const riversMs = lap();

  onPhase('ground');
  const { heights, biomes } = buildPatch(gen, rect);
  if (heights.some((h) => !Number.isFinite(h))) {
    throw new GameDataError('unsupported', 'part of this ground isn’t supported yet');
  }
  const groundMs = lap();

  onPhase('edits');
  const edited = applyTerrainComps(heights, rect, await decodeComps(job.comps));
  const editsMs = lap();

  onPhase('check');
  let n = 0;
  let maxError = 0;
  for (const i of checks) {
    const h = gen.getHeight(job.checks[i]!, job.checks[i + 2]!);
    if (!Number.isFinite(h)) continue; // Ashlands and Deep North: not ported
    n++;
    maxError = Math.max(maxError, Math.abs(job.checks[i + 1]! - h));
  }
  const checkMs = lap();

  return {
    heights: heights as Float32Array<ArrayBuffer>,
    biomes,
    check: { n, maxError },
    edited,
    rivers,
    ms: { rivers: riversMs, ground: groundMs, edits: editsMs, check: checkMs },
  };
};
