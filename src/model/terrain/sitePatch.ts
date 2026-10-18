/**
 * Which part of the world's vertex grid a site's terrain covers: the build's world box
 * plus `SITE_MARGIN` on every side, each side clamped to `MIN_SIDE`–`MAX_SIDE` metres
 * (centred on the build when capped), on integer world coordinates (the game's own
 * 1 m vertices, so nothing is resampled).
 */
import type { Vec2 } from '../types';

import { planToWorld, type SiteFrame } from './siteTerrain';

/** Ground kept around the build (metres). */
export const SITE_MARGIN = 64;
/** A patch side's least and greatest length on import (metres; vertices are one more). */
export const MIN_SIDE = 128;
export const MAX_SIDE = 384;
/**
 * The greatest a side may grow to when the site is extended from the view
 * (`siteExtend.ts`), and so the most a stored patch may have: 4.7 MB of heights in
 * memory and in the IndexedDB autosave, ~2.6 M characters packed in a file; the 3D
 * surface is about 100 MB of tile meshes (Findings, "Site terrain storage").
 */
export const MAX_SITE_SIDE = 1536;

/** A patch: vertex (0, 0) at world (x0, z0), `cols` × `rows` vertices 1 m apart. */
export interface PatchRect {
  x0: number;
  z0: number;
  cols: number;
  rows: number;
}

/** One axis: [lo, hi] grown by the margin, clamped in length, on whole metres. */
const span = (lo: number, hi: number): { start: number; count: number } => {
  const from = Math.floor(lo - SITE_MARGIN);
  const to = Math.ceil(hi + SITE_MARGIN);
  const side = Math.min(MAX_SIDE, Math.max(MIN_SIDE, to - from));
  const start = side === to - from ? from : Math.round((lo + hi) / 2 - side / 2);
  return { start, count: side + 1 };
};

/** The patch for a build whose plan bounds are `bounds`, in the import's frame. */
export const patchRect = (bounds: { min: Vec2; max: Vec2 }, frame: SiteFrame): PatchRect => {
  const { min, max } = bounds;
  const corners = [min, { x: max.x, z: min.z }, max, { x: min.x, z: max.z }].map((p) =>
    planToWorld(frame, p)
  );
  const xs = corners.map((p) => p.x);
  const zs = corners.map((p) => p.z);
  const x = span(Math.min(...xs), Math.max(...xs));
  const z = span(Math.min(...zs), Math.max(...zs));
  return { x0: x.start, z0: z.start, cols: x.count, rows: z.count };
};
