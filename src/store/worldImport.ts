/**
 * Importing a world build: its pieces as a new plan at their absolute heights, shown
 * whole (the cut at All) and fitted in view, optionally with the ground under it (M16).
 * Either way it is one `plan.replace`, so one undo step. Adding terrain later to a plan
 * imported without it is one `site.setTerrain` ("Add terrain").
 *
 * Growing the site on one side (the expand handles) is one `site.setTerrain` too
 * ("Extend terrain north"), with the sites the larger patch reveals (`site.reveal`) in
 * the same step when "Load revealed sites" is on. An import brings the sites on its
 * starting patch along ("Include nearby sites").
 *
 * The terrain is made in a worker (`generateSiteTerrain`), one request at a time: an
 * import, an Add terrain and an extension exclude each other.
 *
 * An import's grid runs along the world's axes unless "Align grid to the build" is on
 * (`alignToBuildAtom`); `reframeImport` turns it either way later ("Turn the grid").
 */
import type { WorldCluster } from '../model/world/clusters';
import { planBounds } from '../model/planBounds';
import { isPlanEmpty } from '../model/selection';
import { growRect, type SiteSide } from '../model/terrain/siteExtend';
import { MAX_SITE_SIDE, type PatchRect } from '../model/terrain/sitePatch';
import type { Plan, SiteTerrain } from '../model/types';
import type { FrameGrid } from '../model/world/frameGrid';
import { importCluster } from '../model/world/importCluster';
import { reframePlan } from '../model/world/reframe';
import { revealSites, type Reveal } from '../model/world/revealSites';
import {
  generateSiteTerrain,
  growSiteGround,
  siteRect,
  terrainAvailability,
  type SiteGeneration,
  type TerrainAvailability,
  type TerrainSource,
} from '../install/siteGeneration';
import type { TerrainPhase } from '../install/terrainJob';

import { persistedAtom } from './browserStorage';
import { fileStatusAtom } from './fileActions';
import { getLibrary } from './libraryInstance';
import type { PlanStore } from './planStore';
import { hoverAtom, selectionAtom } from './selection';
import { fitViewTo, resetCut, type SessionAccess } from './session';
import { sitesOf } from './siteWorld';
import { resetOrbit } from './view3d';

type ImportContext = SessionAccess & { plan: PlanStore };

/**
 * Whether an import's grid follows its build ("Align grid to the build") rather than the
 * world's axes, remembered per browser. Off by default.
 */
export const alignToBuildAtom = persistedAtom<boolean>(
  'valheimFloorPlanner.alignToBuild.v1',
  false,
  (stored) => (stored === 'true' ? true : stored === 'false' ? false : null),
  String
);

/** Sites added to a plan beside its build: their piece counts, and those left out. */
export type RevealSummary = Pick<Reveal, 'sites' | 'refused'>;

/** A build made into a plan, ready to import, and whether its ground can be made. */
export interface PreparedBuild {
  plan: Plan;
  rect: PatchRect | null;
  terrain: TerrainAvailability;
  /** The sites on its starting patch brought along (none unless asked for). */
  nearby: RevealSummary;
}

const NO_SITES: RevealSummary = { sites: [], refused: [] };

export type ImportResult = 'done' | 'kept' | 'cancelled' | { error: string };

export interface TerrainOptions {
  onPhase(phase: TerrainPhase): void;
  /** Cancels everything (the panel closed). */
  signal: AbortSignal;
  /** Stops making the ground; the import goes on without it ("Skip terrain"). */
  skip?: AbortSignal;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const attempt = <T extends object>(run: () => T): T | { error: string } => {
  try {
    return run();
  } catch (error) {
    return { error: messageOf(error) };
  }
};
const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

/**
 * The build as a plan on `grid` (or why it can't be one), and its site's availability;
 * with `nearby`, the other sites on its starting patch (the build and its margin) come
 * along in its frame, the patch staying the build's.
 */
export const prepareBuild = (
  world: TerrainSource,
  cluster: WorldCluster,
  nearby = false,
  grid: FrameGrid = 'world'
): PreparedBuild | { error: string } => {
  try {
    const built = importCluster(world.pieces, cluster, getLibrary(), world.name, grid);
    const rect = siteRect(built, getLibrary());
    const terrain: TerrainAvailability = rect
      ? terrainAvailability(world, rect)
      : { ok: false, reason: 'The build has no extent.' };
    if (!nearby || !rect) return { plan: built, rect, terrain, nearby: NO_SITES };
    const found = revealSites(world.pieces, sitesOf(world), built, rect, getLibrary());
    const plan: Plan = {
      ...built,
      rawPieces: {
        ...built.rawPieces,
        ...Object.fromEntries(found.pieces.map((p) => [p.id, p])),
      },
      importFrame: { ...built.importFrame!, worldPieces: found.worldPieces },
    };
    return { plan, rect, terrain, nearby: found };
  } catch (error) {
    return { error: messageOf(error) };
  }
};

/**
 * An import or an Add terrain is under way: only one at a time, so neither replaces the
 * plan the other is making ground for (the World panel also disables the other button).
 */
let busy = false;
const BUSY = { error: 'The ground is still being made for another request.' };

const exclusively = async <T>(run: () => Promise<T>): Promise<T | typeof BUSY> => {
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
  // A file's outcome (a "Left out …" notice) was about the plan this one replaces.
  ctx.set(fileStatusAtom, null);
  resetCut(ctx);
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

/** Whether a terrain request (an import, Add terrain, an extension) is running. */
export const isTerrainBusy = (): boolean => busy;

export type ExtendResult = 'cancelled' | { error: string } | RevealSummary;

/**
 * Grows the plan's site by `metres` on `side` (up to `MAX_SITE_SIDE`), from `world`, and
 * with `reveal` adds the sites the larger patch reveals: one undoable "Extend terrain …".
 * The site's own heights, frame and datum stay.
 */
export const extendTerrain = (
  ctx: ImportContext,
  world: TerrainSource,
  side: SiteSide,
  metres: number,
  opts: Pick<TerrainOptions, 'onPhase' | 'signal'> & { reveal: boolean }
): Promise<ExtendResult> => exclusively(() => growPlanSite(ctx, world, side, metres, opts));

const growPlanSite = async (
  ctx: ImportContext,
  world: TerrainSource,
  side: SiteSide,
  metres: number,
  opts: Pick<TerrainOptions, 'onPhase' | 'signal'> & { reveal: boolean }
): Promise<ExtendResult> => {
  const frame = ctx.plan.getPlan().importFrame;
  const terrain = frame?.terrain;
  if (!frame || !terrain) return { error: 'The plan has no terrain.' };
  const growth = growRect(terrain, side, metres);
  if (!growth) return { error: `The site is at its largest: ${MAX_SITE_SIDE} m a side.` };
  const available = terrainAvailability(world, growth.strip);
  if (!available.ok) return { error: available.reason };
  let made: SiteGeneration;
  try {
    made = await growSiteGround(world, frame, terrain, growth, opts.onPhase, opts.signal);
  } catch (error) {
    if (isAbort(error)) return 'cancelled';
    return { error: `The ground couldn’t be made: ${messageOf(error)}` };
  }
  // Cancelled, or the terrain changed under it (an undo, another plan).
  const plan = ctx.plan.getPlan();
  if (opts.signal.aborted || plan.importFrame?.terrain !== terrain) return 'cancelled';
  const found = opts.reveal
    ? revealSites(world.pieces, sitesOf(world), plan, growth.rect, getLibrary())
    : null;
  const sites = found?.sites ?? [];
  const label =
    sites.length === 0
      ? `Extend terrain ${side}`
      : `Extend terrain ${side}, ${sites.length} ${sites.length === 1 ? 'site' : 'sites'}`;
  const result = ctx.plan.transact(label, (dispatch) => {
    dispatch({ type: 'site.setTerrain', terrain: made.terrain });
    if (found && found.pieces.length > 0) {
      dispatch({ type: 'site.reveal', pieces: found.pieces, worldPieces: found.worldPieces });
    }
  });
  if (!result.ok) return { error: result.error.message };
  return found ? { sites, refused: found.refused } : NO_SITES;
};

/**
 * Turns the plan's grid onto `grid` (world axes or its build's), every piece staying put
 * in the world and the terrain as it is: one undoable "Grid on world axes" / "Grid along
 * the build", then the view fitted to the turned plan.
 */
export const reframeImport = (ctx: ImportContext, grid: FrameGrid): { error: string } | 'done' => {
  const next = attempt(() => reframePlan(ctx.plan.getPlan(), getLibrary(), grid));
  if ('error' in next) return next;
  const label = grid === 'world' ? 'Grid on world axes' : 'Grid along the build';
  const result = ctx.plan.dispatch({ type: 'site.reframe', ...next }, { label });
  if (!result.ok) return { error: result.error.message };
  ctx.set(hoverAtom, null);
  fitViewTo(ctx, planBounds(ctx.plan.getPlan(), getLibrary()));
  resetOrbit(ctx);
  return 'done';
};
