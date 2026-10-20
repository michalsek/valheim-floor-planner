/**
 * The cut: one session height H (null is All, no cut) above which the plan isn't shown.
 * A piece shows when its box's bottom is below H (`shownAt`), so one straddling H shows
 * whole. Storey stops are where H hides a floor: the bottoms of the plan's floor-tile
 * clusters. Pure.
 *
 * `cutPlan` is the plan as the cut shows it. It shares the entity objects and reuses a
 * filtered record while it keeps the same objects (an edit above the cut leaves it
 * alone), so the per-object caches (boxes, outlines) keep hitting; with everything
 * shown it is the plan itself. Its caches are fixed slots, so memory stays bounded.
 */
import type { Library } from '../catalog/library';
import { FLOOR_TILE_PREFABS } from '../catalog/pieceClasses';

import type { PlanCommand } from './commands';
import { clampElevation, MAX_ELEVATION, MIN_ELEVATION, roundElevation } from './elevation';
import { boxCorners } from './geometry/orient';
import { ITEM_KINDS } from './itemKinds';
import { propBox, type BoxLib, type PieceBox } from './pieceBoxes';
import { rawBox } from './rawBoxes';
import type { Selection, SelectionItem } from './selection';
import type { Plan } from './types';

/**
 * A box whose bottom is within this below the cut counts as at it (hidden): it covers
 * floor tiles' 1 mm lift, H's mm rounding and float noise.
 */
export const CUT_EPS = 0.005;

/** Floor tiles whose walking tops are more than this apart are on different storeys. */
export const STOP_GAP = 0.1;

/** A storey needs at least this many floor tiles at one height. */
export const MIN_STOP_TILES = 2;

/** A step of the cut: up or down. */
export type CutDirection = 1 | -1;

const shownAt = (bottom: number, h: number): boolean => bottom < h - CUT_EPS;

const bottoms = new WeakMap<PieceBox, number>();

/** The height of a box's lowest corner (a tilted roof slab's too). */
export const boxBottom = (box: PieceBox): number => {
  let bottom = bottoms.get(box);
  if (bottom === undefined) {
    bottom = Math.min(...boxCorners(box).map((c) => c.y));
    bottoms.set(box, bottom);
  }
  return bottom;
};

const NONE: readonly PieceBox[] = [];

interface Split {
  h: number;
  shown: readonly PieceBox[];
  above: readonly PieceBox[];
}

const splits = new WeakMap<readonly PieceBox[], Split>();

const split = (boxes: readonly PieceBox[], h: number): Split => {
  const cached = splits.get(boxes);
  if (cached?.h === h) return cached;
  const shown: PieceBox[] = [];
  const above: PieceBox[] = [];
  for (const box of boxes) (shownAt(boxBottom(box), h) ? shown : above).push(box);
  const result = { h, shown: above.length === 0 ? boxes : shown, above };
  splits.set(boxes, result);
  return result;
};

/** The boxes the cut at `h` shows; `boxes` itself when that is all of them. */
export const cutBoxes = (boxes: readonly PieceBox[], h: number | null): readonly PieceBox[] =>
  h === null ? boxes : split(boxes, h).shown;

/** The boxes above the cut at `h` (drawn as ghosts, if at all). */
export const aboveCut = (boxes: readonly PieceBox[], h: number | null): readonly PieceBox[] =>
  h === null ? NONE : split(boxes, h).above;

// --- cutPlan -----------------------------------------------------------------------

type CutRecord = 'props' | 'dimensions' | 'rawPieces';

const bottomMaps = new WeakMap<readonly PieceBox[], Map<string, number>>();

/** Each box's bottom by its key (`prop:<id>`, `raw:<id>`). */
const bottomsByKey = (boxes: readonly PieceBox[]): Map<string, number> => {
  let map = bottomMaps.get(boxes);
  if (!map) {
    map = new Map(boxes.map((box) => [box.key, boxBottom(box)]));
    bottomMaps.set(boxes, map);
  }
  return map;
};

// One slot per record (its filter at the last H) and the last filtered result of each
// kind; an unfiltered record (or plan) never takes a last-result slot, so a cut that
// shows everything doesn't evict the one in use.
const recordCache = new WeakMap<object, { h: number; result: object }>();
const lastOfKind: { [K in CutRecord]?: Plan[K] } = {};

const sameEntries = (a: object, b: object): boolean => {
  const keys = Object.keys(a);
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  return keys.length === Object.keys(b).length && keys.every((k) => x[k] === y[k]);
};

const filterRecord = <K extends CutRecord>(
  kind: K,
  record: Plan[K],
  h: number,
  keep: (value: Plan[K][string]) => boolean
): Plan[K] => {
  const cached = recordCache.get(record);
  if (cached?.h === h) return cached.result as Plan[K];
  const entries = Object.entries(record) as [string, Plan[K][string]][];
  const kept = entries.filter(([, value]) => keep(value));
  let result = kept.length === entries.length ? record : (Object.fromEntries(kept) as Plan[K]);
  if (result !== record) {
    const last = lastOfKind[kind];
    if (last && sameEntries(last, result)) result = last;
    lastOfKind[kind] = result;
  }
  recordCache.set(record, { h, result });
  return result;
};

const planCache = new WeakMap<Plan, { h: number; view: Plan }>();
let lastView: Plan | null = null;

/**
 * The plan as the cut at `h` shows it: raw pieces and props whose boxes start below it,
 * dimensions below it; `plan` when that is everything. `boxes` must be
 * `pieceBoxes(plan, lib)` (the store's cached ones).
 */
export const cutPlan = (plan: Plan, boxes: readonly PieceBox[], h: number | null): Plan => {
  if (h === null) return plan;
  const cached = planCache.get(plan);
  if (cached?.h === h) return cached.view;
  const byKey = bottomsByKey(boxes);
  const keptBy = (prefix: string) => (o: { id: string }) => {
    const bottom = byKey.get(`${prefix}:${o.id}`);
    return bottom === undefined || shownAt(bottom, h);
  };
  let view: Plan = {
    ...plan,
    props: filterRecord('props', plan.props, h, keptBy('prop')),
    dimensions: filterRecord('dimensions', plan.dimensions, h, (d) => shownAt(d.elevation, h)),
    rawPieces: filterRecord('rawPieces', plan.rawPieces, h, keptBy('raw')),
  };
  if (
    view.props === plan.props &&
    view.dimensions === plan.dimensions &&
    view.rawPieces === plan.rawPieces
  ) {
    view = plan;
  } else {
    if (lastView && sameEntries(lastView, view)) view = lastView;
    lastView = view;
  }
  planCache.set(plan, { h, view });
  return view;
};

// --- items ---------------------------------------------------------------------------

/** The bottom of an item's box (a dimension: its elevation); null when it is gone. */
export const itemBottom = (plan: Plan, item: SelectionItem, lib: BoxLib): number | null => {
  switch (item.kind) {
    case 'raw': {
      const piece = plan.rawPieces[item.id];
      return piece ? boxBottom(rawBox(piece, lib)) : null;
    }
    case 'prop': {
      const prop = plan.props[item.id];
      return prop ? boxBottom(propBox(prop, lib)) : null;
    }
    case 'dimension':
      return plan.dimensions[item.id]?.elevation ?? null;
  }
};

/**
 * The cut that shows every item of `items`: `h` when it already does, else the value on
 * the `step` grid just above the highest hidden bottom (All above the elevation range).
 */
export const cutShowing = (
  h: number | null,
  plan: Plan,
  items: Selection,
  step: number,
  lib: BoxLib
): number | null => {
  if (h === null) return null;
  let highest = -Infinity;
  for (const item of items) {
    const bottom = itemBottom(plan, item, lib);
    if (bottom !== null && !shownAt(bottom, h)) highest = Math.max(highest, bottom);
  }
  if (highest === -Infinity) return h;
  const next = roundElevation((Math.floor((highest + CUT_EPS) / step) + 1) * step);
  return next > MAX_ELEVATION ? null : next;
};

/** Commands raising (or lowering) `items` by `dy` metres. */
export const raiseCommands = (plan: Plan, items: Selection, dy: number): PlanCommand[] =>
  dy === 0 ? [] : items.flatMap((item) => ITEM_KINDS[item.kind].raise(plan, item.id, dy));

// --- storey stops ----------------------------------------------------------------------

export interface StoreyStop {
  /** The cut that hides this storey's floor: its tiles' lowest box bottom. */
  height: number;
  /** Its highest walking surface (the tiles' top snap points). */
  top: number;
  /** What a cut moving from this stop to the next reveals (props and pieces). */
  count: number;
}

/** A floor tile's walking surface: its top snap points, else its box top. */
const walkingTop = (box: PieceBox, lib: Pick<Library, 'catalog'>): number => {
  const snaps = (box.prefab && lib.catalog.pieces.get(box.prefab)?.snapPoints) || [];
  return snaps.length > 0
    ? box.pivot.y + Math.max(...snaps.map((p) => p[1]))
    : box.center.y + box.size.y / 2;
};

const isTile = (box: PieceBox): boolean =>
  box.kind === 'raw' &&
  box.prefab !== null &&
  FLOOR_TILE_PREFABS.has(box.prefab) &&
  !box.tiltX &&
  !box.rollZ;

/** The stops' heights and tops, lowest first, before counting. */
const stopBands = (
  boxes: readonly PieceBox[],
  lib: Pick<Library, 'catalog'>
): Omit<StoreyStop, 'count'>[] => {
  const tiles = boxes
    .filter(isTile)
    .map((box) => ({ top: walkingTop(box, lib), bottom: boxBottom(box) }))
    .sort((a, b) => a.top - b.top);
  // Single linkage: tiles drift by a few centimetres, so clusters, not bins.
  const clusters: (typeof tiles)[] = [];
  let lastTop = -Infinity;
  for (const tile of tiles) {
    const current = clusters.at(-1);
    if (current && tile.top - lastTop <= STOP_GAP) current.push(tile);
    else clusters.push([tile]);
    lastTop = tile.top;
  }
  const stops = clusters
    .filter((c) => c.length >= MIN_STOP_TILES)
    .map((c) => ({
      height: roundElevation(Math.min(...c.map((t) => t.bottom))),
      top: roundElevation(Math.max(...c.map((t) => t.top))),
    }))
    .filter((s) => s.height >= MIN_ELEVATION && s.height <= MAX_ELEVATION)
    .sort((a, b) => a.height - b.height);
  const merged: typeof stops = [];
  for (const stop of stops) {
    const last = merged.at(-1);
    if (last && stop.height - last.height <= CUT_EPS) last.top = Math.min(last.top, stop.top);
    else merged.push(stop);
  }
  return merged;
};

const stopCache = new WeakMap<readonly PieceBox[], readonly StoreyStop[]>();

/**
 * The plan's storey stops, lowest first: clusters of at least `MIN_STOP_TILES` untilted
 * floor tiles whose walking tops lie within `STOP_GAP` of the next. `boxes` are
 * `pieceBoxes`' (cached per array).
 */
export const storeyStops = (
  boxes: readonly PieceBox[],
  lib: Pick<Library, 'catalog'>
): readonly StoreyStop[] => {
  const cached = stopCache.get(boxes);
  if (cached) return cached;
  const bands = stopBands(boxes, lib);
  const counts = bands.map(() => 0);
  for (const box of boxes) {
    const bottom = boxBottom(box);
    const i = bands.findLastIndex((band) => bottom >= band.height - CUT_EPS);
    if (i >= 0) counts[i] = (counts[i] ?? 0) + 1;
  }
  const stops = bands.map((band, i) => ({ ...band, count: counts[i] ?? 0 }));
  stopCache.set(boxes, stops);
  return stops;
};

/** The first stop above `h`; null with none (the caller sets All) or at All. */
export const nextStop = (stops: readonly StoreyStop[], h: number | null): number | null =>
  h === null ? null : (stops.find((s) => s.height > h + CUT_EPS)?.height ?? null);

/** The last stop below `h` (from All, the highest); null with none (no change). */
export const prevStop = (stops: readonly StoreyStop[], h: number | null): number | null =>
  h === null
    ? (stops.at(-1)?.height ?? null)
    : (stops.filter((s) => s.height < h - CUT_EPS).at(-1)?.height ?? null);

/**
 * The cut one step up or down, onto the step's grid (2.3 steps up to 3 with a 1 m
 * step). `top` is the highest box bottom (null without boxes): from All, down goes to
 * the grid value just under it, so the topmost piece hides; going up past it, or past
 * the elevation range, is All.
 */
export const steppedCut = (
  h: number | null,
  dir: CutDirection,
  step: number,
  top: number | null
): number | null => {
  let next: number;
  if (h === null) {
    if (dir > 0) return null;
    next = top === null ? 0 : Math.floor((top + CUT_EPS) / step) * step;
  } else {
    const at = h / step;
    const onGrid = Math.abs(at - Math.round(at)) < 1e-6 ? Math.round(at) : null;
    next = (onGrid !== null ? onGrid + dir : dir > 0 ? Math.ceil(at) : Math.floor(at)) * step;
    if (dir > 0 && (next > (top ?? -Infinity) + CUT_EPS || next > MAX_ELEVATION)) return null;
  }
  return roundElevation(clampElevation(next));
};

/**
 * Where new things go in the interim (pass 2): the walking surface of the highest stop
 * the cut shows (its floor below H); 0 at All or below every stop.
 */
export const workPlaneOf = (stops: readonly StoreyStop[], h: number | null): number =>
  h === null ? 0 : (stops.filter((s) => s.height < h - CUT_EPS).at(-1)?.top ?? 0);
