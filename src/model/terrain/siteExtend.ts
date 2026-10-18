/**
 * Growing a site's terrain on one side (the expand handles): the patch gains whole rows
 * or columns of the world's vertex grid there, up to `MAX_SITE_SIDE` a side. The frame
 * and datum stay; the patch's own heights are kept value for value, and only the new
 * strip comes from the world. Pure.
 */
import type { SiteNotices, SiteTerrain } from '../types';

import { MAX_SITE_SIDE, type PatchRect } from './sitePatch';

/** A patch side, by the world's compass: west −x, east +x, south −z, north +z. */
export type SiteSide = 'west' | 'east' | 'south' | 'north';

export const SITE_SIDES: readonly SiteSide[] = ['west', 'east', 'south', 'north'];

/** One step of growth (metres): a zone's width, the grain of the game's own terrain. */
export const EXTEND_STEP = 64;

/** A patch grown on one side: the whole new patch, and the strip it gained. */
export interface SiteGrowth {
  side: SiteSide;
  rect: PatchRect;
  strip: PatchRect;
}

type BiomeGrid = SiteTerrain['biomes'];

const alongX = (side: SiteSide) => side === 'west' || side === 'east';

/** How many metres the patch can still grow along `side`'s axis (0 at the cap). */
export const roomToGrow = (rect: PatchRect, side: SiteSide): number =>
  Math.max(0, MAX_SITE_SIDE - ((alongX(side) ? rect.cols : rect.rows) - 1));

/**
 * The patch grown by `metres` on `side`, or as far as the cap allows; null when it is
 * already at the cap.
 */
export const growRect = (rect: PatchRect, side: SiteSide, metres: number): SiteGrowth | null => {
  const m = Math.min(Math.floor(metres), roomToGrow(rect, side));
  if (m <= 0) return null;
  const { x0, z0, cols, rows } = rect;
  switch (side) {
    case 'west':
      return {
        side,
        rect: { x0: x0 - m, z0, cols: cols + m, rows },
        strip: { x0: x0 - m, z0, cols: m, rows },
      };
    case 'east':
      return {
        side,
        rect: { x0, z0, cols: cols + m, rows },
        strip: { x0: x0 + cols, z0, cols: m, rows },
      };
    case 'south':
      return {
        side,
        rect: { x0, z0: z0 - m, cols, rows: rows + m },
        strip: { x0, z0: z0 - m, cols, rows: m },
      };
    case 'north':
      return {
        side,
        rect: { x0, z0, cols, rows: rows + m },
        strip: { x0, z0: z0 + rows, cols, rows: m },
      };
  }
};

/** Copies a patch's rows into a larger patch's, where it lies in it. */
const placeRows = (out: Int16Array, into: PatchRect, heights: Int16Array, from: PatchRect) => {
  const col = from.x0 - into.x0;
  for (let row = 0; row < from.rows; row++) {
    const at = (from.z0 - into.z0 + row) * into.cols + col;
    out.set(heights.subarray(row * from.cols, (row + 1) * from.cols), at);
  }
};

/** The union of two zone-corner grids of one world (they agree where they overlap). */
export const mergeBiomes = (a: BiomeGrid, b: BiomeGrid): BiomeGrid => {
  const zx0 = Math.min(a.zx0, b.zx0);
  const zz0 = Math.min(a.zz0, b.zz0);
  const cols = Math.max(a.zx0 + a.cols, b.zx0 + b.cols) - zx0;
  const rows = Math.max(a.zz0 + a.rows, b.zz0 + b.rows) - zz0;
  const codes = new Array<number>(cols * rows).fill(0);
  for (const grid of [b, a]) {
    for (let j = 0; j < grid.rows; j++) {
      for (let i = 0; i < grid.cols; i++) {
        codes[(grid.zz0 - zz0 + j) * cols + grid.zx0 - zx0 + i] = grid.codes[j * grid.cols + i]!;
      }
    }
  }
  return { zx0, zz0, cols, rows, codes };
};

/** The new strip's ground, as `growSiteTerrain` takes it. */
export interface GrownStrip {
  /** Plan centimetres over `growth.strip`, row-major (as `SiteTerrain.heights`). */
  heights: Int16Array;
  /** The zone-corner biomes over the strip. */
  biomes: BiomeGrid;
}

/**
 * The site's terrain grown by `growth`: its own heights kept value for value, the
 * strip's placed beside them, the biome grids joined, and the notices of the whole new
 * patch.
 */
export const growSiteTerrain = (
  terrain: SiteTerrain,
  growth: SiteGrowth,
  strip: GrownStrip,
  notices: SiteNotices
): SiteTerrain => {
  const { rect } = growth;
  if (terrain.heights.length !== terrain.cols * terrain.rows) {
    throw new Error('The terrain’s heights don’t read.');
  }
  if (strip.heights.length !== growth.strip.cols * growth.strip.rows) {
    throw new Error('The new ground doesn’t fit its strip.');
  }
  const heights = new Int16Array(rect.cols * rect.rows);
  placeRows(heights, rect, strip.heights, growth.strip);
  placeRows(heights, rect, terrain.heights, terrain);
  return {
    ...terrain,
    ...rect,
    heights,
    biomes: mergeBiomes(terrain.biomes, strip.biomes),
    notices,
  };
};
