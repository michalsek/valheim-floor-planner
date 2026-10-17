/**
 * Boxes turned about +y, then tilted about their own x axis, then rolled about their
 * own z (three.js Euler order 'YXZ'), as pieces' boxes are: a roof slab tilts down its
 * slope, a diagonal beam rolls up its rise. Pure.
 */
import type { Vec3 } from '../types';

import { SHAPE_VERTICES, type PieceShape } from './shapes';

export interface OrientedBox {
  center: Vec3;
  size: Vec3;
  /** Radians, three.js sense (counter-clockwise seen from above). */
  rotationY: number;
  /** Radians about the box's own x axis, after the turn (+: its +z end goes down). */
  tiltX?: number | undefined;
  /** Radians about the box's own z axis, after the tilt (+: its +x end goes up). */
  rollZ?: number | undefined;
  /** What the box holds (default a solid box). */
  shape?: PieceShape | undefined;
}

/** The box's own x, y and z axes in the world (unit vectors). */
export const boxAxes = ({
  rotationY,
  tiltX = 0,
  rollZ = 0,
}: Pick<OrientedBox, 'rotationY' | 'tiltX' | 'rollZ'>): [Vec3, Vec3, Vec3] => {
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  const ct = Math.cos(tiltX);
  const st = Math.sin(tiltX);
  const x = { x: c, y: 0, z: -s };
  const y = { x: s * st, y: ct, z: c * st };
  const z = { x: s * ct, y: -st, z: c * ct };
  if (rollZ === 0) return [x, y, z];
  const cr = Math.cos(rollZ);
  const sr = Math.sin(rollZ);
  const mix = (a: Vec3, ka: number, b: Vec3, kb: number): Vec3 => ({
    x: a.x * ka + b.x * kb,
    y: a.y * ka + b.y * kb,
    z: a.z * ka + b.z * kb,
  });
  return [mix(x, cr, y, sr), mix(x, -sr, y, cr), z];
};

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** A direction in the box's own frame. */
export const toLocalDir = (v: Vec3, box: OrientedBox): Vec3 => {
  const [ax, ay, az] = boxAxes(box);
  return { x: dot(v, ax), y: dot(v, ay), z: dot(v, az) };
};

/** A point in the box's own frame (metres from its centre). */
export const toLocal = (p: Vec3, box: OrientedBox): Vec3 =>
  toLocalDir({ x: p.x - box.center.x, y: p.y - box.center.y, z: p.z - box.center.z }, box);

/** A point of the box's own frame in the world. */
export const fromLocal = (l: Vec3, box: OrientedBox): Vec3 => {
  const [ax, ay, az] = boxAxes(box);
  return {
    x: box.center.x + l.x * ax.x + l.y * ay.x + l.z * az.x,
    y: box.center.y + l.x * ax.y + l.y * ay.y + l.z * az.y,
    z: box.center.z + l.x * ax.z + l.y * ay.z + l.z * az.z,
  };
};

/** The corners of what the box holds (a box's eight, a shape's own) in the world. */
export const boxCorners = (box: OrientedBox): Vec3[] =>
  SHAPE_VERTICES[box.shape ?? 'box'].map(([x, y, z]) =>
    fromLocal({ x: x * box.size.x, y: y * box.size.y, z: z * box.size.z }, box)
  );
