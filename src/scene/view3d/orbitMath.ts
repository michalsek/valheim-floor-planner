/**
 * Camera placement maths for the 3D view: framing a box or a width, the default view
 * direction, and depth planes that follow the orbit distance. Pure.
 */
import { boundsCentre, type Bounds3 } from '../../model/geometry/bounds3';
import type { Vec3 } from '../../model/types';

export interface CameraPlacement {
  position: Vec3;
  target: Vec3;
}

const DEG = Math.PI / 180;

/** A unit vector from the target towards the camera: azimuth from +z towards +x, elevation up. */
export const directionFrom = (azimuthDeg: number, elevationDeg: number): Vec3 => {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return { x: Math.sin(az) * Math.cos(el), y: Math.sin(el), z: Math.cos(az) * Math.cos(el) };
};

/** Looking from the screen-bottom side of the plan (+z), a little from the right, 40° down. */
export const DEFAULT_DIR: Vec3 = directionFrom(25, 40);

/**
 * The lowest the camera goes without a site's terrain (metres): only a safety limit, as
 * views from under the plate and the ground are allowed.
 */
export const DEFAULT_CAMERA_FLOOR = -50;

/** Room left around a framed box. */
const FIT_MARGIN = 1.1;
/** The smallest radius framed, so a single piece isn't filled edge to edge. */
const MIN_RADIUS = 2;

/** The point `distance` from `target` along `dir`. */
export const along = (target: Vec3, dir: Vec3, distance: number): Vec3 => ({
  x: target.x + dir.x * distance,
  y: target.y + dir.y * distance,
  z: target.z + dir.z * distance,
});

/** Half the horizontal field of view, from the vertical one and the aspect ratio. */
const halfFovX = (halfFovY: number, aspect: number): number =>
  Math.atan(Math.tan(halfFovY) * aspect);

/** The radius of the sphere around a box (at least `MIN_RADIUS`). */
export const boundsRadius = ({ min, max }: Bounds3): number =>
  Math.max(Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z) / 2, MIN_RADIUS);

/**
 * A camera looking along −`dir` at the box's centre (never below the datum, y = 0, so
 * a floor-only plan isn't framed from underground), with the box's sphere in view.
 */
export const frameBounds = (
  bounds: Bounds3,
  fovDeg: number,
  aspect: number,
  dir: Vec3
): CameraPlacement => {
  const centre = boundsCentre(bounds);
  const target = { ...centre, y: Math.max(centre.y, 0) };
  const halfY = (fovDeg * DEG) / 2;
  const half = Math.min(halfY, halfFovX(halfY, aspect));
  const distance = (boundsRadius(bounds) * FIT_MARGIN) / Math.sin(half);
  return { position: along(target, dir, distance), target };
};

/** A camera looking along −`dir` at `target`, showing `width` metres across at the target. */
export const frameWidth = (
  target: Vec3,
  width: number,
  fovDeg: number,
  aspect: number,
  dir: Vec3
): CameraPlacement => {
  const distance = width / 2 / Math.tan(halfFovX((fovDeg * DEG) / 2, aspect));
  return { position: along(target, dir, distance), target };
};

/**
 * Depth planes for a camera `distance` from its target, with the scene within `radius`
 * of it: a near plane that scales with the distance keeps depth precision for the 2 cm
 * between floor tops and the grid.
 */
export const clipPlanes = (distance: number, radius: number): { near: number; far: number } => ({
  near: distance * 0.01,
  far: distance * 20 + 4 * radius,
});
