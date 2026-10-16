/**
 * The theme values that don't reach the page through CSS: the grid shader uniforms and
 * the slab mesh colours. Parsed from the CSS custom properties in `global.css` through
 * a getter, so this module stays pure and testable; `store/theme.ts` feeds it
 * `getComputedStyle`.
 */
import {
  matToken,
  PALETTE_MATERIALS,
  type MaterialPalette,
  type PaletteMaterial,
} from '../catalog/materialColors';

export interface ThemeTokens {
  /** Grid line colour, `#rrggbb`. */
  gridLine: string;
  /** Multiplies every grid level's opacity (light themes need quieter lines). */
  gridAlphaScale: number;
  /** Floor slab opacity (0–1). */
  floorOpacity: number;
  palette: MaterialPalette;
}

/** Used for missing or unparsable tokens; a missing material takes the fallback. */
const FALLBACK = '#b06ab3';

const uniformMaterials = (color: string): Record<PaletteMaterial, string> =>
  Object.fromEntries(PALETTE_MATERIALS.map((m) => [m, color])) as Record<PaletteMaterial, string>;

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  gridLine: '#b4c2d0',
  gridAlphaScale: 0.8,
  floorOpacity: 0.6,
  palette: {
    materials: uniformMaterials(FALLBACK),
    fallback: FALLBACK,
    floorBase: '#3d424a',
    floorShare: 0.4,
  },
};

/** `#rgb` or `#rrggbb` (any case) as lowercase `#rrggbb`, or null. */
const parseHex = (value: string): string | null => {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join('')}`;
  return null;
};

/** A plain number, or null; `max` caps fractions. */
const parseNumber = (value: string, max = Infinity): number | null => {
  const v = value.trim();
  const n = v === '' ? Number.NaN : Number(v);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

/**
 * Reads the scene tokens through `get` (a custom property name to its value, `''`
 * when unset). Values are trimmed; a missing or invalid one keeps its default.
 */
export const readThemeTokens = (get: (name: string) => string): ThemeTokens => {
  const def = DEFAULT_THEME_TOKENS;
  const color = (name: string, fallback: string) => parseHex(get(name)) ?? fallback;
  const number = (name: string, fallback: number, max?: number) =>
    parseNumber(get(name), max) ?? fallback;
  const fallback = color(matToken('fallback'), def.palette.fallback);
  const materials = Object.fromEntries(
    PALETTE_MATERIALS.map((m) => [m, color(matToken(m), fallback)])
  ) as Record<PaletteMaterial, string>;
  return {
    gridLine: color('--grid-line', def.gridLine),
    gridAlphaScale: number('--grid-alpha-scale', def.gridAlphaScale),
    floorOpacity: number('--floor-opacity', def.floorOpacity, 1),
    palette: {
      materials,
      fallback,
      floorBase: color('--floor-base', def.palette.floorBase),
      floorShare: number('--floor-material-share', def.palette.floorShare, 1),
    },
  };
};
