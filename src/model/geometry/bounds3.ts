/** Axis-aligned boxes in 3D (the 3D view's plan bounds). */
import type { Vec3 } from '../types';

export interface Bounds3 {
  min: Vec3;
  max: Vec3;
}

export const boundsCentre = ({ min, max }: Bounds3): Vec3 => ({
  x: (min.x + max.x) / 2,
  y: (min.y + max.y) / 2,
  z: (min.z + max.z) / 2,
});
