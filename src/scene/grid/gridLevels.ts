/**
 * Grid levels drawn by the grid shader. Each level fades in as its on-screen spacing
 * grows from 8 to 20 CSS px, so dense levels vanish smoothly when zooming out. Levels
 * share lines and are composited, so a 10 m line is drawn by all four levels.
 */
export interface GridLevel {
  /** Line spacing in metres. */
  spacing: number;
  /** Opacity once fully faded in. */
  strength: number;
  /** Line width in CSS px. */
  widthPx: number;
}

export const GRID_LEVELS = [
  { spacing: 0.5, strength: 0.2, widthPx: 1 },
  { spacing: 1, strength: 0.3, widthPx: 1 },
  { spacing: 2, strength: 0.4, widthPx: 1 },
  { spacing: 10, strength: 0.9, widthPx: 2 },
] as const satisfies readonly GridLevel[];

export type GridLevelAlphas = readonly [number, number, number, number];

/** On-screen spacing (CSS px) over which a level fades in. */
export const FADE_START_PX = 8;
export const FADE_END_PX = 20;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const levelAlpha = (level: GridLevel, zoom: number): number =>
  level.strength * smoothstep(FADE_START_PX, FADE_END_PX, level.spacing * zoom);

/** Opacity of each grid level at `zoom` CSS px per metre. */
export const gridLevelAlphas = (zoom: number): GridLevelAlphas => {
  const [l0, l1, l2, l3] = GRID_LEVELS;
  return [levelAlpha(l0, zoom), levelAlpha(l1, zoom), levelAlpha(l2, zoom), levelAlpha(l3, zoom)];
};

/**
 * Each level's strength in 3D, relative to 2D: the 10 m lines are toned down, since at
 * mid distance (where the finer levels have faded) they would otherwise dominate.
 */
const LEVEL_SCALE_3D = [1, 1, 1, 0.6] as const;

/**
 * Each level's full strength in 3D (perspective mode), times `scale`, and times `levels`
 * per level (all of them by default).
 */
export const strength3d = (
  scale: number,
  levels: GridLevelAlphas = [1, 1, 1, 1]
): GridLevelAlphas => {
  const at = (i: 0 | 1 | 2 | 3) =>
    Math.min(1, GRID_LEVELS[i].strength * scale * LEVEL_SCALE_3D[i] * levels[i]);
  return [at(0), at(1), at(2), at(3)];
};
