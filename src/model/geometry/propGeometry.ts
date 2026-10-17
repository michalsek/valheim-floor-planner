/**
 * Prop footprints on the plane: a prefab-local rectangle, rotated clockwise on screen
 * by `rotation` degrees about the pivot (local x along `(cos, sin)`, as in
 * `footprintCorners`), then moved to the pivot.
 */
import type { LocalRect, PropSnap } from '../../catalog/propDefs';
import type { Prop, Vec2 } from '../types';

import type { BoxMode, WorldBox } from './box';
import { snapValue } from './snap';

const DEG = Math.PI / 180;
/** Rotations and positions are rounded to this, so repeated turns don't drift. */
const ROUND = 1e6;

const round = (n: number): number => Math.round(n * ROUND) / ROUND + 0;

/** `d` in [0, 360), rounded. */
export const normalizeDeg = (d: number): number => {
  const r = round(((d % 360) + 360) % 360);
  return r === 360 ? 0 : r;
};

const axes = (deg: number): { u: Vec2; v: Vec2 } => {
  const a = deg * DEG;
  const u = { x: Math.cos(a), z: Math.sin(a) };
  return { u, v: { x: -u.z, z: u.x } };
};

/** A local offset turned by `deg` (no translation). */
export const rotate = (l: Vec2, deg: number): Vec2 => {
  const { u, v } = axes(deg);
  return { x: u.x * l.x + v.x * l.z, z: u.z * l.x + v.z * l.z };
};

const localCentre = (rect: LocalRect): Vec2 => ({
  x: (rect.minX + rect.maxX) / 2,
  z: (rect.minZ + rect.maxZ) / 2,
});

const plus = (p: Vec2, d: Vec2): Vec2 => ({ x: p.x + d.x, z: p.z + d.z });
const minus = (p: Vec2, d: Vec2): Vec2 => ({ x: p.x - d.x, z: p.z - d.z });
const roundPoint = (p: Vec2): Vec2 => ({ x: round(p.x), z: round(p.z) });

/** The footprint's corners, clockwise on screen from the local (min x, min z) one. */
export const propCorners = (pos: Vec2, deg: number, rect: LocalRect): Vec2[] =>
  [
    { x: rect.minX, z: rect.minZ },
    { x: rect.maxX, z: rect.minZ },
    { x: rect.maxX, z: rect.maxZ },
    { x: rect.minX, z: rect.maxZ },
  ].map((l) => plus(pos, rotate(l, deg)));

export const propCentre = (pos: Vec2, deg: number, rect: LocalRect): Vec2 =>
  plus(pos, rotate(localCentre(rect), deg));

/** Whether `deg` is a multiple of 90°, where the footprint is axis-aligned. */
const isRightAngle = (deg: number): boolean => Math.abs(deg / 90 - Math.round(deg / 90)) < 1e-9;

/**
 * The pivot that puts the footprint's centre near `raw`. With a step, a prop that snaps
 * by its snap points (`snap`) puts its anchor on the nearest grid point; others, at right
 * angles, put the footprint's minimum corner there (so its edges sit on the grid), at
 * other angles its centre. Without a step (Alt) the centre is `raw`.
 */
export const placementPosition = (
  raw: Vec2,
  angle: number,
  rect: LocalRect,
  step: number | null,
  snap: PropSnap | null = null
): Vec2 => {
  const deg = normalizeDeg(angle);
  if (step !== null && snap) {
    const anchor = plus(raw, rotate(minus(snap.anchor, localCentre(rect)), deg));
    const onGrid = { x: snapValue(anchor.x, step), z: snapValue(anchor.z, step) };
    return roundPoint(minus(onGrid, rotate(snap.anchor, deg)));
  }
  let centre = raw;
  if (step !== null && isRightAngle(deg)) {
    const turned = Math.round(deg / 90) % 2 === 1;
    const half = {
      x: (turned ? rect.maxZ - rect.minZ : rect.maxX - rect.minX) / 2,
      z: (turned ? rect.maxX - rect.minX : rect.maxZ - rect.minZ) / 2,
    };
    const min = minus(raw, half);
    centre = plus({ x: snapValue(min.x, step), z: snapValue(min.z, step) }, half);
  } else if (step !== null) {
    centre = { x: snapValue(raw.x, step), z: snapValue(raw.z, step) };
  }
  return roundPoint(minus(centre, rotate(localCentre(rect), deg)));
};

/**
 * The prop turned by `deltaDeg` about a local point, its footprint's centre by default
 * (so the pivot moves); a pole turns about its axis (`PropSnap.centre`).
 */
export const rotateAboutCentre = (
  prop: Pick<Prop, 'position' | 'rotation'>,
  rect: LocalRect,
  deltaDeg: number,
  about: Vec2 = localCentre(rect)
): Pick<Prop, 'position' | 'rotation'> => {
  const centre = plus(prop.position, rotate(about, prop.rotation));
  const rotation = normalizeDeg(prop.rotation + deltaDeg);
  return { position: roundPoint(minus(centre, rotate(about, rotation))), rotation };
};

/** Where a snap-point prop's anchor is in the world; null for props without one. */
export const snapAnchorAt = (
  prop: Pick<Prop, 'position' | 'rotation'>,
  snap: PropSnap | null | undefined
): Vec2 | null => (snap ? plus(prop.position, rotate(snap.anchor, prop.rotation)) : null);

/** Whether `p` is on the footprint, or within `tol` of it. */
export const pointInProp = (
  p: Vec2,
  pos: Vec2,
  deg: number,
  rect: LocalRect,
  tol: number
): boolean => {
  const { u, v } = axes(deg);
  const rel = minus(p, pos);
  const lx = rel.x * u.x + rel.z * u.z;
  const lz = rel.x * v.x + rel.z * v.z;
  return (
    lx >= rect.minX - tol && lx <= rect.maxX + tol && lz >= rect.minZ - tol && lz <= rect.maxZ + tol
  );
};

const project = (points: readonly Vec2[], axis: Vec2): [number, number] => {
  const values = points.map((p) => p.x * axis.x + p.z * axis.z);
  return [Math.min(...values), Math.max(...values)];
};

/**
 * Box selection of a footprint (`corners` from `propCorners`): 'contain' when every
 * corner is in the box, 'touch' when they overlap at all (separating axis test).
 */
export const propBoxTest = (corners: readonly Vec2[], box: WorldBox, mode: BoxMode): boolean => {
  const inBox = (p: Vec2) =>
    p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z;
  if (mode === 'contain') return corners.every(inBox);
  const boxCorners = [
    box.min,
    { x: box.max.x, z: box.min.z },
    box.max,
    { x: box.min.x, z: box.max.z },
  ];
  const [a, b, c] = corners;
  if (!a || !b || !c) return false;
  const edgeAxes = [minus(b, a), minus(c, b)].map((e) => ({ x: -e.z, z: e.x }));
  return [{ x: 1, z: 0 }, { x: 0, z: 1 }, ...edgeAxes].every((axis) => {
    const [p0, p1] = project(corners, axis);
    const [q0, q1] = project(boxCorners, axis);
    return p1 >= q0 && q1 >= p0;
  });
};
