/**
 * World ↔ screen maths for the 3D view's perspective camera, from a plain snapshot of
 * it (`OrbitRig` publishes one on every camera change). Pure, and free of three.js.
 *
 * Rays are built from the camera's basis and `tan(fov / 2)` rather than by unprojecting
 * NDC: WebGPU's depth range is [0, 1] and WebGL2's [−1, 1], so unprojecting would be
 * wrong on one of the backends.
 */
import {
  dotVec3,
  normalizeVec3,
  pointOnRay,
  scaleVec3,
  subVec3,
  addVec3,
  type Ray3,
} from '../model/geometry/ray';
import type { Vec2, Vec3 } from '../model/types';

import type { ScreenPoint, Size } from './viewportMath';

export interface Projection3d {
  eye: Vec3;
  /** Unit camera axes in world space. */
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  /** Tangent of half the vertical field of view. */
  tanHalfFov: number;
  /** Width over height. */
  aspect: number;
  /** The canvas, in CSS px. */
  size: Size;
  /** From the eye to the orbit target. */
  orbitDistance: number;
}

/**
 * The work plane is ignored further than this many orbit distances away: near the
 * horizon a pixel spans metres, so points there are useless (and a drag swept up to it
 * would build something huge).
 */
const MAX_PLANE_DISTANCES = 6;

/** The ray from the eye through a canvas point. */
export const screenRay = (p: ScreenPoint, v: Projection3d): Ray3 => {
  const nx = (2 * p.x) / Math.max(v.size.width, 1) - 1;
  const ny = 1 - (2 * p.y) / Math.max(v.size.height, 1);
  const dir = addVec3(
    v.forward,
    addVec3(scaleVec3(v.right, nx * v.tanHalfFov * v.aspect), scaleVec3(v.up, ny * v.tanHalfFov))
  );
  return { origin: v.eye, dir: normalizeVec3(dir) };
};

/** Where the ray crosses the horizontal plane at height `y` (ahead of it only). */
const rayPlaneY = (r: Ray3, y: number): { point: Vec3; t: number } | null => {
  if (Math.abs(r.dir.y) < 1e-12) return null;
  const t = (y - r.origin.y) / r.dir.y;
  return t > 0 ? { point: pointOnRay(r, t), t } : null;
};

/** How far in front of the eye `p` is, along the view direction. */
const depthOf = (p: Vec3, v: Projection3d): number => dotVec3(subVec3(p, v.eye), v.forward);

/** The canvas point `p` is drawn at, or null when it is behind the camera. */
export const project3d = (p: Vec3, v: Projection3d): ScreenPoint | null => {
  const d = subVec3(p, v.eye);
  const depth = dotVec3(d, v.forward);
  if (depth <= 1e-6) return null;
  const nx = dotVec3(d, v.right) / (depth * v.tanHalfFov * v.aspect);
  const ny = dotVec3(d, v.up) / (depth * v.tanHalfFov);
  return { x: ((nx + 1) / 2) * v.size.width, y: ((1 - ny) / 2) * v.size.height };
};

/** CSS px per metre for something at `p`, facing the camera. */
export const pxPerMetreAt = (p: Vec3, v: Projection3d): number =>
  v.size.height / 2 / (Math.max(depthOf(p, v), 1e-6) * v.tanHalfFov);

/** The orbit target (what the camera looks at, `orbitDistance` ahead). */
export const orbitTargetOf = (v: Projection3d): Vec3 =>
  addVec3(v.eye, scaleVec3(v.forward, v.orbitDistance));

/**
 * The point on the work plane (height `y`) under a canvas point, or null for a ray
 * that doesn't reach it within `MAX_PLANE_DISTANCES` orbit distances (at or above the
 * horizon, or grazing it).
 */
export const workPlanePoint = (p: ScreenPoint, v: Projection3d, y: number): Vec2 | null => {
  const hit = rayPlaneY(screenRay(p, v), y);
  if (!hit || hit.t > MAX_PLANE_DISTANCES * v.orbitDistance) return null;
  return { x: hit.point.x, z: hit.point.z };
};
