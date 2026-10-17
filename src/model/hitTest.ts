/**
 * What is under a point, and what lies in a box, for selection.
 * `hitTest` tries tiers in order (vertex handle, dimension, opening, small prop, wall,
 * roof lines, large prop, floor) and the nearest (or smallest) object within the first tier that
 * has one wins. Large props (ships, kilns) come after walls, so walls inside them stay
 * clickable.
 */
import { propRect, type PropDef } from '../catalog/propDefs';
import type { WallFamily } from '../catalog/wallFamilies';

import {
  boxArea,
  lineInBox,
  pointInBox,
  type BoxMode,
  type Polyline,
  type WorldBox,
} from './geometry/box';
import { dimensionLine } from './geometry/dimension';
import { distanceToSegment } from './geometry/measure';
import { dot, runSegments, sideNormal } from './geometry/polyline';
import { pointInProp } from './geometry/propGeometry';
import { ITEM_KINDS, type KindLib } from './itemKinds';
import type { ResolvedOpening } from './openings';
import { propArea, propsInDrawOrder } from './props';
import { roofCreaseLines, roofGeometry } from './roofs/roofGeometry';
import { allItems, isSelected, type Selection, type SelectionItem } from './selection';
import type {
  Dimension,
  DimId,
  FloorId,
  OpeningId,
  Plan,
  PropId,
  RoofId,
  Vec2,
  WallId,
  WallRun,
} from './types';
import { wallExtents, type WallExtents } from './wallGraph';

export type Hit =
  | { kind: 'vertex'; wallId: WallId; index: number }
  | { kind: 'dimension'; id: DimId; distance: number }
  | { kind: 'opening'; id: OpeningId; distance: number }
  | { kind: 'wall'; id: WallId; segment: number; distance: number }
  | { kind: 'floor'; id: FloorId; area: number }
  | { kind: 'prop'; id: PropId; area: number }
  | { kind: 'roof'; id: RoofId; distance: number };

export interface HitOptions {
  families: ReadonlyMap<string, WallFamily>;
  propDefs: ReadonlyMap<string, PropDef>;
  /** The plan's openings, as derived. */
  openings: readonly ResolvedOpening[];
  /** The wall whose vertices are drag handles (the single selected wall), if any. */
  handlesFor: WallId | null;
  /** Handle radius in metres. */
  handleTol: number;
  /** Of overlapping props of equal area, a selected one wins. */
  selection: Selection;
}

/** The selectable object a hit is on; a vertex handle belongs to its wall. */
export const hitItem = (hit: Hit): SelectionItem =>
  hit.kind === 'vertex' ? { kind: 'wall', id: hit.wallId } : { kind: hit.kind, id: hit.id };

/**
 * Hits a run's footprint: across, from `left + tol` on one side of the drawn line to
 * `right + tol` on the other; along, up to `tol` past each end. So a block wall's
 * strip side is hittable and its empty side isn't. The distance is to the middle of
 * the footprint, for picking the nearest of several walls.
 */
const hitWall = (
  run: Pick<WallRun, 'points' | 'closed'>,
  extents: WallExtents,
  p: Vec2,
  tol: number
): { segment: number; distance: number } | null => {
  let best: { segment: number; distance: number } | null = null;
  for (const [segment, seg] of runSegments(run).entries()) {
    const rel = { x: p.x - seg.a.x, z: p.z - seg.a.z };
    const along = dot(rel, seg.dir);
    const across = dot(rel, sideNormal(seg.dir, 'right'));
    const inside =
      along >= -tol &&
      along <= seg.length + tol &&
      across >= -extents.left - tol &&
      across <= extents.right + tol;
    if (!inside) continue;
    const beyond = Math.max(0, -along, along - seg.length);
    const distance = Math.hypot(beyond, across - (extents.right - extents.left) / 2);
    if (!best || distance < best.distance) best = { segment, distance };
  }
  return best;
};

/** The dimension whose drawn line is nearest to `p`, within `tol` metres. */
export const hitDimension = (
  dims: Record<DimId, Dimension>,
  p: Vec2,
  tol: number
): { id: DimId; distance: number } | null => {
  let best: { id: DimId; distance: number } | null = null;
  for (const dim of Object.values(dims)) {
    const line = dimensionLine(dim);
    const distance = distanceToSegment(p, line.a, line.b);
    if (distance <= tol && (!best || distance < best.distance)) best = { id: dim.id, distance };
  }
  return best;
};

type Tier = (plan: Plan, p: Vec2, tol: number, opts: HitOptions) => Hit | null;

const vertexTier: Tier = (plan, p, _tol, { handlesFor, handleTol }) => {
  const run = handlesFor === null ? undefined : plan.walls[handlesFor];
  if (!run) return null;
  let best: Hit | null = null;
  let bestDistance = handleTol;
  for (const [index, q] of run.points.entries()) {
    const distance = Math.hypot(p.x - q.x, p.z - q.z);
    if (distance <= bestDistance) {
      best = { kind: 'vertex', wallId: run.id, index };
      bestDistance = distance;
    }
  }
  return best;
};

const dimensionTier: Tier = (plan, p, tol) => {
  const hit = hitDimension(plan.dimensions, p, tol);
  return hit && { kind: 'dimension', ...hit };
};

// An unknown family has no thickness; hit its drawn line only.
const extentsOf = (run: WallRun, families: HitOptions['families']): WallExtents => {
  const family = families.get(run.familyId);
  return family ? wallExtents(run.side, family) : { left: 0, right: 0 };
};

/** The wall (and segment) under `p`: the nearest footprint within `tol`. */
export const wallAt = (
  plan: Plan,
  p: Vec2,
  tol: number,
  families: HitOptions['families']
): Extract<Hit, { kind: 'wall' }> | null => {
  let best: Extract<Hit, { kind: 'wall' }> | null = null;
  for (const run of Object.values(plan.walls)) {
    const hit = hitWall(run, extentsOf(run, families), p, tol);
    if (hit && (!best || hit.distance < best.distance)) best = { kind: 'wall', id: run.id, ...hit };
  }
  return best;
};

/** Without a size (off its wall, unknown prefab) an opening is hit this close to its anchor. */
const LOOSE_OPENING_RADIUS = 0.5;

/**
 * An opening is hit over its width and its wall's footprint; one that resolves onto
 * no segment, near its anchor.
 */
const hitOpening = (
  plan: Plan,
  o: ResolvedOpening,
  p: Vec2,
  tol: number,
  families: HitOptions['families']
): number | null => {
  const rel = { x: p.x - o.center.x, z: p.z - o.center.z };
  const run = plan.walls[o.wallId];
  if (!o.def || o.segment === null || !run) {
    const distance = Math.hypot(rel.x, rel.z);
    return distance <= LOOSE_OPENING_RADIUS + tol ? distance : null;
  }
  const extents = extentsOf(run, families);
  const along = dot(rel, o.dir);
  const across = dot(rel, sideNormal(o.dir, 'right'));
  const inside =
    Math.abs(along) <= o.def.width / 2 + tol &&
    across >= -extents.left - tol &&
    across <= extents.right + tol;
  return inside ? Math.abs(along) : null;
};

const openingTier: Tier = (plan, p, tol, { openings, families }) => {
  let best: Hit | null = null;
  let bestDistance = Infinity;
  for (const o of openings) {
    const distance = hitOpening(plan, o, p, tol, families);
    if (distance !== null && distance < bestDistance) {
      best = { kind: 'opening', id: o.id, distance };
      bestDistance = distance;
    }
  }
  return best;
};

const wallTier: Tier = (plan, p, tol, { families }) => wallAt(plan, p, tol, families);

/** The smallest floor under `p`, so a floor laid over another can still be picked. */
const floorTier: Tier = (plan, p) => {
  let best: Hit | null = null;
  let bestArea = Infinity;
  for (const floor of Object.values(plan.floors)) {
    const area = boxArea(floor);
    if (pointInBox(p, floor) && area < bestArea) {
      best = { kind: 'floor', id: floor.id, area };
      bestArea = area;
    }
  }
  return best;
};

/** A roof's lines: its eave ring and its ridges, hips and valleys (clicks inside reach floors). */
const roofTier: Tier = (plan, p, tol) => {
  let best: Hit | null = null;
  let bestDistance = tol;
  for (const roof of Object.values(plan.roofs)) {
    const geometry = roofGeometry(roof);
    const ring = geometry.frame.ring;
    const lines = [
      ...ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length]! })),
      ...roofCreaseLines(geometry),
    ];
    for (const { a, b } of lines) {
      const distance = distanceToSegment(p, a, b);
      if (distance <= bestDistance) {
        best = { kind: 'roof', id: roof.id, distance };
        bestDistance = distance;
      }
    }
  }
  return best;
};

/** Props of at most this footprint area (m²) are hit before walls; larger ones after. */
const SMALL_PROP_AREA = 16;

/**
 * The prop under `p` among those `inTier` takes: the smallest; of equal areas, a
 * selected one, then the one drawn on top.
 */
const propTier =
  (inTier: (area: number) => boolean): Tier =>
  (plan, p, tol, { propDefs, selection }) => {
    let best: { hit: Hit; area: number; selected: boolean } | null = null;
    for (const prop of propsInDrawOrder(plan, propDefs).reverse()) {
      const area = propArea(propDefs, prop.prefab);
      const rect = propRect(propDefs, prop.prefab);
      if (!inTier(area) || !pointInProp(p, prop.position, prop.rotation, rect, tol)) continue;
      const selected = isSelected(selection, { kind: 'prop', id: prop.id });
      const better =
        !best || area < best.area || (area === best.area && selected && !best.selected);
      if (better) best = { hit: { kind: 'prop', id: prop.id, area }, area, selected };
    }
    return best?.hit ?? null;
  };

const TIERS: readonly Tier[] = [
  vertexTier,
  dimensionTier,
  openingTier,
  propTier((area) => area <= SMALL_PROP_AREA),
  wallTier,
  roofTier,
  propTier((area) => area > SMALL_PROP_AREA),
  floorTier,
];

/** The topmost thing under `p` (within `tol` metres), or null. */
export const hitTest = (plan: Plan, p: Vec2, tol: number, opts: HitOptions): Hit | null => {
  for (const tier of TIERS) {
    const hit = tier(plan, p, tol, opts);
    if (hit) return hit;
  }
  return null;
};

/** Items whose drawn lines (or areas) lie inside (or touch) the box, in plan order. */
export const itemsInBox = (
  plan: Plan,
  box: WorldBox,
  mode: BoxMode,
  lib: KindLib
): SelectionItem[] =>
  allItems(plan).filter((item) => {
    const kind = ITEM_KINDS[item.kind];
    if (kind.inBox) return kind.inBox(plan, item.id, box, mode, lib);
    const lines = kind.lines(plan, item.id, lib);
    const test = (line: Polyline) => lineInBox(line, box, mode);
    return lines.length > 0 && (mode === 'contain' ? lines.every(test) : lines.some(test));
  });
