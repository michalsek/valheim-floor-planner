import type { Vec2 } from '../model/types';

/** World points as an SVG `points` attribute (x → x, z → y). */
export const toSvgPoints = (points: readonly Vec2[]): string =>
  points.map((p) => `${p.x},${p.z}`).join(' ');
