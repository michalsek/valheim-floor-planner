/**
 * Importing a world build: its pieces as a new plan, on its main floor
 * (`ImportedBuild.level`), fitted in view, optionally with the ground under it (M16).
 * Either way it is one `plan.replace`, so one undo step. Adding terrain later to a plan
 * imported without it is one `site.setTerrain` ("Add terrain").
 *
 * The terrain is made in a worker (`generateSiteTerrain`), one request at a time: an
 * import and an Add terrain exclude each other.
 */
import type { WorldCluster } from '../model/world/clusters';
import { clampElevation, roundElevation } from '../model/elevation';
import { planBounds } from '../model/planBounds';
import { isPlanEmpty } from '../model/selection';
import type { PatchRect } from '../model/terrain/sitePatch';
import type { Plan, SiteTerrain } from '../model/types';
import { importCluster } from '../model/world/importCluster';
import {
  generateSiteTerrain,
  siteRect,
  terrainAvailability,
  type SiteGeneration,
  type TerrainAvailability,
  type TerrainSource,
} from '../install/siteGeneration';
import type { TerrainPhase } from '../install/terrainJob';

import { getLibrary } from './libraryInstance';
import type { PlanStore } from './planStore';
import { hoverAtom, selectionAtom } from './selection';
import { fitViewTo, workDatumAtom, type SessionAccess } from './session';
import { resetOrbit } from './view3d';

type ImportContext = SessionAccess & { plan: PlanStore };

/** A build made into a plan, ready to import, and whether its ground can be made. */
export interface PreparedBuild {
  plan: Plan;
  level: number;
  rect: PatchRect | null;
  terrain: TerrainAvailability;
}

export type ImportResult = 'done' | 'kept' | 'cancelled' | { error: string };

export interface TerrainOptions {
  onPhase(phase: TerrainPhase): void;
  /** Cancels everything (the panel closed). */
  signal: AbortSignal;
  /** Stops making the ground; the import goes on without it ("Skip terrain"). */
  skip?: AbortSignal;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/** The build as a plan (or why it can't be one), and its site's availability. */
export const prepareBuild = (
  world: TerrainSource,
  cluster: WorldCluster
): PreparedBuild | { error: string } => {
  try {
    const { plan, level } = importCluster(world.pieces, cluster, getLibrary(), world.name);
    const rect = siteRect(plan, getLibrary());
    const terrain: TerrainAvailability = rect
      ? terrainAvailability(world, rect)
      : { ok: false, reason: 'The build has no extent.' };
    return { plan, level, rect, terrain };
  } catch (error) {
    return { error: messageOf(error) };
  }
};

/**
 * An import or an Add terrain is under way: only one at a time, so neither replaces the
 * plan the other is making ground for (the World panel also disables the other button).
 */
let busy = false;
const BUSY: ImportResult = { error: 'The ground is still being made for another request.' };

const exclusively = async (run: () => Promise<ImportResult>): Promise<ImportResult> => {
  if (busy) return BUSY;
  busy = true;
  try {
    return await run();
  } finally {
    busy = false;
  }
};

/** The ground for `plan`'s frame, or null when skipped; throws an `AbortError` when cancelled. */
const makeTerrain = async (
  world: TerrainSource,
  plan: Plan,
  rect: PatchRect,
  opts: TerrainOptions
): Promise<SiteGeneration | null> => {
  const signal = opts.skip ? AbortSignal.any([opts.signal, opts.skip]) : opts.signal;
  try {
    return await generateSiteTerrain(world, plan.importFrame!, rect, opts.onPhase, signal);
  } catch (error) {
    if (isAbort(error) && opts.skip?.aborted && !opts.signal.aborted) return null;
    throw error;
  }
};

/**
 * Replaces the plan with the build (asking first unless the plan is empty), with its
 * ground when `opts` is given and it can be made.
 */
export const importBuild = async (
  ctx: ImportContext,
  world: TerrainSource,
  build: PreparedBuild,
  opts: TerrainOptions | null
): Promise<ImportResult> => {
  if (busy) return BUSY;
  if (
    !isPlanEmpty(ctx.plan.getPlan()) &&
    !window.confirm('Replace the current plan with this build? You can undo this.')
  ) {
    return 'kept';
  }
  return exclusively(() => replaceWithBuild(ctx, world, build, opts));
};

const replaceWithBuild = async (
  ctx: ImportContext,
  world: TerrainSource,
  build: PreparedBuild,
  opts: TerrainOptions | null
): Promise<ImportResult> => {
  let terrain: SiteTerrain | null = null;
  if (opts && build.rect && build.terrain.ok) {
    try {
      terrain = (await makeTerrain(world, build.plan, build.rect, opts))?.terrain ?? null;
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      return { error: `The ground couldn’t be made: ${messageOf(error)}` };
    }
  }
  if (opts?.signal.aborted) return 'cancelled';
  const plan: Plan = { ...build.plan, importFrame: { ...build.plan.importFrame!, terrain } };
  ctx.plan.dispatch({ type: 'plan.replace', plan }, { label: `Import from ${world.name}` });
  ctx.set(selectionAtom, []);
  ctx.set(hoverAtom, null);
  ctx.set(workDatumAtom, roundElevation(clampElevation(build.level)));
  fitViewTo(ctx, planBounds(plan, getLibrary()));
  resetOrbit(ctx);
  return 'done';
};

/** Adds the ground to the current plan's import (one undoable "Add terrain"). */
export const addTerrain = (
  ctx: ImportContext,
  world: TerrainSource,
  opts: TerrainOptions
): Promise<ImportResult> => exclusively(() => addToPlan(ctx, world, opts));

const addToPlan = async (
  ctx: ImportContext,
  world: TerrainSource,
  opts: TerrainOptions
): Promise<ImportResult> => {
  const plan = ctx.plan.getPlan();
  const rect = siteRect(plan, getLibrary());
  if (!plan.importFrame || !rect) return { error: 'The plan has no imported build.' };
  const available = terrainAvailability(world, rect);
  if (!available.ok) return { error: available.reason };
  let made: SiteGeneration | null;
  try {
    made = await makeTerrain(world, plan, rect, opts);
  } catch (error) {
    if (isAbort(error)) return 'cancelled';
    return { error: `The ground couldn’t be made: ${messageOf(error)}` };
  }
  // Cancelled, or the plan changed under it (an undo).
  if (!made || opts.signal.aborted || ctx.plan.getPlan().importFrame !== plan.importFrame) {
    return 'cancelled';
  }
  const result = ctx.plan.dispatch(
    { type: 'site.setTerrain', terrain: made.terrain },
    { label: 'Add terrain' }
  );
  return result.ok ? 'done' : { error: result.error.message };
};
