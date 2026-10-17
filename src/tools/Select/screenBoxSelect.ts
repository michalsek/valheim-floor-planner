/**
 * Box selection by screen rectangle, for the 3D view: an item is in the box by where
 * its pieces are drawn, whatever the camera's direction. Pure.
 */
import type { BoxMode } from '../../model/geometry/box';
import type { TurnedBox } from '../../model/geometry/ray';
import { ITEM_KINDS, type KindLib } from '../../model/itemKinds';
import type { PieceBox } from '../../model/pieceBoxes';
import { allItems, type SelectionItem } from '../../model/selection';
import type { Plan, Vec3 } from '../../model/types';
import { project3d, type Projection3d } from '../../viewport/projection3d';
import type { ScreenPoint } from '../../viewport/viewportMath';

export interface ScreenRect {
  min: ScreenPoint;
  max: ScreenPoint;
}

export const screenRectFrom = (a: ScreenPoint, b: ScreenPoint): ScreenRect => ({
  min: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
  max: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
});

/** A turned box's eight corners. */
const corners = ({ center, size, rotationY }: TurnedBox): Vec3[] => {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  const result: Vec3[] = [];
  for (const lx of [-size.x / 2, size.x / 2]) {
    for (const ly of [-size.y / 2, size.y / 2]) {
      for (const lz of [-size.z / 2, size.z / 2]) {
        result.push({
          x: center.x + c * lx + s * lz,
          y: center.y + ly,
          z: center.z - s * lx + c * lz,
        });
      }
    }
  }
  return result;
};

const keyOf = (item: SelectionItem): string => `${item.kind}:${item.id}`;

/** Each item's points in 3D: its boxes' corners, or (with no boxes) its drawn lines on its level. */
const itemPoints = (
  plan: Plan,
  boxes: readonly PieceBox[],
  lib: KindLib
): Map<string, { item: SelectionItem; points: Vec3[] }> => {
  const elevation = (item: SelectionItem) => ITEM_KINDS[item.kind].elevation(plan, item.id) ?? 0;
  const byKey = new Map<string, Vec3[]>();
  for (const box of boxes) {
    const key = keyOf(box.item);
    byKey.set(key, [...(byKey.get(key) ?? []), ...corners(box)]);
  }
  return new Map(
    allItems(plan).map((item) => {
      const fromBoxes = byKey.get(keyOf(item));
      const points =
        fromBoxes ??
        ITEM_KINDS[item.kind]
          .lines(plan, item.id, lib)
          .flatMap((line) => line.points.map((p) => ({ x: p.x, y: elevation(item), z: p.z })));
      return [keyOf(item), { item, points }];
    })
  );
};

const inside = (p: ScreenPoint, r: ScreenRect): boolean =>
  p.x >= r.min.x && p.x <= r.max.x && p.y >= r.min.y && p.y <= r.max.y;

/** Whether an item drawn at `points` is in the rectangle: wholly ('contain') or partly ('touch'). */
const pointsInRect = (
  points: readonly Vec3[],
  v: Projection3d,
  rect: ScreenRect,
  mode: BoxMode
): boolean => {
  const projected = points.map((p) => project3d(p, v));
  const drawn = projected.filter((p): p is ScreenPoint => p !== null);
  if (drawn.length === 0) return false;
  if (mode === 'contain')
    return drawn.length === projected.length && drawn.every((p) => inside(p, rect));
  const bounds = screenRectFrom(
    { x: Math.min(...drawn.map((p) => p.x)), y: Math.min(...drawn.map((p) => p.y)) },
    { x: Math.max(...drawn.map((p) => p.x)), y: Math.max(...drawn.map((p) => p.y)) }
  );
  return (
    bounds.max.x >= rect.min.x &&
    bounds.min.x <= rect.max.x &&
    bounds.max.y >= rect.min.y &&
    bounds.min.y <= rect.max.y
  );
};

/** Items in a screen rectangle (canvas px) seen through `v`, in plan order. */
export const itemsInScreenRect = (
  plan: Plan,
  boxes: readonly PieceBox[],
  v: Projection3d,
  rect: ScreenRect,
  mode: BoxMode,
  lib: KindLib
): SelectionItem[] =>
  [...itemPoints(plan, boxes, lib).values()]
    .filter(({ points }) => pointsInRect(points, v, rect, mode))
    .map(({ item }) => item);
