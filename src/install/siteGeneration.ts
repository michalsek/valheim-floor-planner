/**
 * The ground under an imported build, from the open world: whether it can be made
 * (`terrainAvailability`), the job for the terrain worker, and the finished
 * `SiteTerrain` (plan heights as int16 centimetres, the zone-corner biomes and the
 * notices). The seed goes to the worker only; the plan never holds it.
 */
import type { Library } from '../catalog/library';
import { Biome, biomeName } from '../gameData/valheim/terrain/biomes';
import { zoneOf } from '../gameData/valheim/terrain/heightmap';
import { SUPPORTED_WORLD_GEN_VERSION } from '../gameData/valheim/terrain/worldGenerator';
import { planBounds } from '../model/planBounds';
import { patchRect, type PatchRect } from '../model/terrain/sitePatch';
import { encodeHeights } from '../model/terrain/siteTerrain';
import type { ImportFrame, Plan, SiteTerrain } from '../model/types';

import { GENERATOR_REVISION, loadRivers, saveRivers } from './terrainCache';
import { runTerrainWorker } from './terrainClient';
import {
  unsupportedBiome,
  type TerrainJob,
  type TerrainPhase,
  type TerrainResult,
} from './terrainJob';
import type { StoredWorld } from './worldCache';

/** The save's location heights this far from the patch are checked (metres). */
export const CHECK_RADIUS = 1500;
/** Locations this close to the patch are listed in the notices (metres). */
export const NOTICE_REACH = 32;
/** A location height off by more than this says the ground may not match (metres). */
export const MISMATCH = 0.05;
/** A plan without terrain matches an open world with a build this close to its origin. */
const MATCH_DISTANCE = 100;

/** What of a read world the terrain needs. */
export type TerrainSource = Pick<
  StoredWorld,
  'name' | 'site' | 'terrainComps' | 'locations' | 'legacyEdits' | 'pieces'
>;

export type TerrainAvailability = { ok: true } | { ok: false; reason: string };

const BIOME_LABELS: Partial<Record<number, string>> = {
  [Biome.AshLands]: 'Ashlands',
  [Biome.DeepNorth]: 'Deep North',
};

/** Whether the planner can make this site's ground, and why not. */
export const terrainAvailability = (
  world: Pick<TerrainSource, 'site'>,
  rect: PatchRect
): TerrainAvailability => {
  const { site } = world;
  if (!site) {
    return { ok: false, reason: 'An old .db save has no seed, so its ground can’t be made.' };
  }
  if (site.worldGenVersion !== SUPPORTED_WORLD_GEN_VERSION) {
    return {
      ok: false,
      reason: `This world comes from an older world generator (v${site.worldGenVersion}); its ground isn’t supported yet.`,
    };
  }
  const biome = unsupportedBiome(site, rect);
  if (biome !== null) {
    const name = BIOME_LABELS[biome] ?? biomeName(biome);
    return { ok: false, reason: `${name} ground isn’t supported yet.` };
  }
  return { ok: true };
};

/** The patch for a plan's build (its pieces, not an underlay); null without one. */
export const siteRect = (plan: Plan, lib: Library): PatchRect | null => {
  const frame = plan.importFrame;
  const bounds = frame && planBounds({ ...plan, underlay: null }, lib);
  return frame && bounds ? patchRect(bounds, frame) : null;
};

/** Whether a plan imported without terrain came from this world: its name and a build near. */
export const worldMatchesFrame = (
  world: Pick<TerrainSource, 'name' | 'pieces'>,
  frame: ImportFrame
): boolean => {
  if (world.name !== frame.worldName) return false;
  const p = world.pieces.position;
  for (let i = 0; i < p.length; i += 3) {
    if (Math.hypot(p[i]! - frame.origin.x, p[i + 2]! - frame.origin.z) <= MATCH_DISTANCE) {
      return true;
    }
  }
  return false;
};

/** How far a world point is from the patch (0 inside). */
const distanceTo = (rect: PatchRect, x: number, z: number): number =>
  Math.hypot(
    Math.max(rect.x0 - x, 0, x - (rect.x0 + rect.cols - 1)),
    Math.max(rect.z0 - z, 0, z - (rect.z0 + rect.rows - 1))
  );

/** What the worker needs: the patch's terrain edits and the locations to check. */
export const terrainJobFor = (
  world: TerrainSource,
  rect: PatchRect,
  rivers: ArrayBuffer | null
): TerrainJob => {
  if (!world.site) throw new Error('The world has no seed.');
  const zones = (from: number, count: number) => [zoneOf(from), zoneOf(from + count - 1)];
  const [zx0, zx1] = zones(rect.x0, rect.cols);
  const [zz0, zz1] = zones(rect.z0, rect.rows);
  const comps = world.terrainComps.filter(
    (c) => c.zx >= zx0! && c.zx <= zx1! && c.zz >= zz0! && c.zz <= zz1!
  );
  const checks: number[] = [];
  const at = world.locations?.position ?? new Float32Array();
  for (let i = 0; i < at.length; i += 3) {
    if (distanceTo(rect, at[i]!, at[i + 2]!) <= CHECK_RADIUS)
      checks.push(at[i]!, at[i + 1]!, at[i + 2]!);
  }
  return { site: world.site, rect, comps, checks: Float32Array.from(checks), rivers };
};

/** The finished ground as the plan stores it, with its notices. */
export const siteTerrainFrom = (
  world: TerrainSource,
  frame: Pick<ImportFrame, 'origin'>,
  rect: PatchRect,
  result: Pick<TerrainResult, 'heights' | 'biomes' | 'check'>
): SiteTerrain => {
  const { heights } = encodeHeights(Float64Array.from(result.heights, (h) => h - frame.origin.y));
  const locations: { x: number; z: number }[] = [];
  const at = world.locations?.position ?? new Float32Array();
  for (let i = 0; i < at.length; i += 3) {
    if (distanceTo(rect, at[i]!, at[i + 2]!) <= NOTICE_REACH) {
      locations.push({ x: at[i]!, z: at[i + 2]! });
    }
  }
  let legacyEdits = 0;
  for (let i = 0; i < world.legacyEdits.length; i += 2) {
    if (distanceTo(rect, world.legacyEdits[i]!, world.legacyEdits[i + 1]!) === 0) legacyEdits++;
  }
  return {
    ...rect,
    heights,
    biomes: result.biomes,
    worldGenVersion: world.site?.worldGenVersion ?? SUPPORTED_WORLD_GEN_VERSION,
    revision: GENERATOR_REVISION,
    notices: { locations, legacyEdits, check: result.check },
  };
};

export interface SiteGeneration {
  terrain: SiteTerrain;
  /** The whole request, the worker's phases and whether the rivers were made now. */
  ms: TerrainResult['ms'] & { total: number };
  pregenerated: boolean;
}

/**
 * Makes the ground for `frame`'s build over `rect` in a worker: the world's kept rivers
 * (or pregenerated and kept), then the patch. `signal` cancels it (an `AbortError`).
 */
export const generateSiteTerrain = async (
  world: TerrainSource,
  frame: Pick<ImportFrame, 'origin'>,
  rect: PatchRect,
  onPhase: (phase: TerrainPhase) => void,
  signal?: AbortSignal
): Promise<SiteGeneration> => {
  const started = performance.now();
  const rivers = world.site && (await loadRivers(world.site));
  const result = await runTerrainWorker(terrainJobFor(world, rect, rivers), onPhase, signal);
  if (result.rivers && world.site) void saveRivers(world.site, result.rivers);
  const terrain = siteTerrainFrom(world, frame, rect, result);
  const total = performance.now() - started;
  const detail = { ...result.ms, pregenerated: result.rivers !== null };
  performance.measure('terrain', { start: started, duration: total, detail });
  return { terrain, ms: { ...result.ms, total }, pregenerated: result.rivers !== null };
};
