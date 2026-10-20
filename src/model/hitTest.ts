/**
 * What is under a point, and what lies in a box, for selection.
 * `hitTest` tries tiers in order (dimension, small prop, raw piece, large prop) and the
 * nearest (or smallest) object within the first tier that has one wins. Large props
 * (ships, kilns) come after raw pieces, so pieces inside a ship stay clickable.
 */
import { propRect, type PropDef } from '../catalog/propDefs';

import { lineInBox, type BoxMode, type Polyline, type WorldBox } from './geometry/box';
import { dimensionLine } from './geometry/dimension';
import { distanceToSegment } from './geometry/measure';
import { pointInProp } from './geometry/propGeometry';
import { ITEM_KINDS, type KindLib } from './itemKinds';
import { propArea, propsInDrawOrder } from './props';
import { pointInConvex } from './geometry/convex';
import { rawOutline, rawOutlineArea } from './rawBoxes';
import type { RawShapeLib } from './rawShapes';
import { allItems, isSelected, type Selection, type SelectionItem } from './selection';
import type { Dimension, DimId, Plan, PropId, RawPieceId, Vec2 } from './types';

export type Hit =
  | { kind: 'dimension'; id: DimId; distance: number }
  | { kind: 'prop'; id: PropId; area: number }
  | { kind: 'raw'; id: RawPieceId; area: number };

export interface HitOptions {
  propDefs: ReadonlyMap<string, PropDef>;
  /** Raw pieces' shapes. */
  rawLib: RawShapeLib;
  /** Of overlapping props of equal area, a selected one wins. */
  selection: Selection;
}

/** The selectable object a hit is on. */
export const hitItem = (hit: Hit): SelectionItem => ({ kind: hit.kind, id: hit.id });

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

const dimensionTier: Tier = (plan, p, tol) => {
  const hit = hitDimension(plan.dimensions, p, tol);
  return hit && { kind: 'dimension', ...hit };
};

/** Props of at most this footprint area (m²) are hit before raw pieces; larger ones after. */
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

/**
 * The raw piece under `p`: the smallest footprint; of equal ones (a stack of wall
 * courses), the highest, which is the one seen from above.
 */
const rawTier: Tier = (plan, p, tol, { rawLib }) => {
  let best: { hit: Hit; area: number; top: number } | null = null;
  for (const piece of Object.values(plan.rawPieces)) {
    if (!pointInConvex(p, rawOutline(piece, rawLib), tol)) continue;
    const area = rawOutlineArea(piece, rawLib);
    const top = piece.elevation + piece.position.y;
    if (!best || area < best.area - 1e-9 || (area < best.area + 1e-9 && top > best.top)) {
      best = { hit: { kind: 'raw', id: piece.id, area }, area, top };
    }
  }
  return best?.hit ?? null;
};

const TIERS: readonly Tier[] = [
  dimensionTier,
  propTier((area) => area <= SMALL_PROP_AREA),
  rawTier,
  propTier((area) => area > SMALL_PROP_AREA),
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
