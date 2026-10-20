/**
 * The theme values that don't reach the page through CSS: the grid shader uniforms, the
 * material colours and the 3D view's colours (its tool lines and ghosts too). Parsed
 * from the CSS custom properties in `global.css` through a getter, so this module stays
 * pure and testable; `store/theme.ts` feeds it `getComputedStyle`.
 */
import {
  matToken,
  PALETTE_MATERIALS,
  type MaterialPalette,
  type PaletteMaterial,
} from '../catalog/materialColors';
import { PROP_GROUPS, type PropGroup } from '../catalog/propDefs';

export type PropGroupColors = Readonly<Record<PropGroup | 'fallback', string>>;

/** The support view's colours: at maximum (`grounded`), the strong → weak ramp, and collapsing. */
export interface SupportColors {
  grounded: string;
  high: string;
  mid: string;
  low: string;
  broken: string;
}

export interface ThemeTokens {
  /** Grid line colour, `#rrggbb`. */
  gridLine: string;
  /** Multiplies every grid level's opacity (light themes need quieter lines). */
  gridAlphaScale: number;
  palette: MaterialPalette;
  /** Selected and hovered items (the 3D view mixes it into their colour). */
  selection: string;
  /** Prop colours by group (3D boxes; the overlay reads the same `--prop-*` tokens). */
  propGroups: PropGroupColors;
  /** Darkness of the 3D view's ground shadows (0–1). */
  shadowAlpha: number;
  support: SupportColors;
  terrain: TerrainColors;
  /** The 3D view's tool drawing: lines, the cursor, valid and invalid ghosts. */
  ink: ToolInk;
}

/** A site's ground (M16): the 2D hillshade's two ends, contour lines and water (2D and 3D). */
export interface TerrainColors {
  /** Ground facing away from the light. */
  shade: string;
  /** Ground facing the light. */
  light: string;
  contour: string;
  water: string;
}

/** Overlay colours the 3D view draws with (the same tokens as the 2D overlay's CSS). */
export interface ToolInk {
  /** The overlay's text colour: white-ish in dark themes, near-black in light ones. */
  neutral: string;
  accent: string;
  /** The raw (unsnapped) cursor, and the ward ring. */
  info: string;
  pinned: string;
  success: string;
  danger: string;
}

/** Used for missing or unparsable tokens; a missing material takes the fallback. */
const FALLBACK = '#b06ab3';

const uniformMaterials = (color: string): Record<PaletteMaterial, string> =>
  Object.fromEntries(PALETTE_MATERIALS.map((m) => [m, color])) as Record<PaletteMaterial, string>;

const PROP_KEYS = [...PROP_GROUPS, 'fallback'] as const;

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  gridLine: '#b4c2d0',
  gridAlphaScale: 0.8,
  palette: {
    materials: uniformMaterials(FALLBACK),
    fallback: FALLBACK,
  },
  selection: '#ff5ad2',
  propGroups: Object.fromEntries(PROP_KEYS.map((g) => [g, '#9aa3ad'])) as PropGroupColors,
  shadowAlpha: 0.4,
  support: {
    grounded: '#5d9bd8',
    high: '#6cc46a',
    mid: '#e6c74a',
    low: '#e0613f',
    broken: '#e04fd8',
  },
  terrain: {
    shade: '#1a1b1e',
    light: '#4b4f55',
    contour: '#a89470',
    water: '#3d6f9a',
  },
  ink: {
    neutral: '#f3f5f8',
    accent: '#e8a84e',
    info: '#7cc4ff',
    pinned: '#9fb4ff',
    success: '#8fd18b',
    danger: '#ff8475',
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
    palette: {
      materials,
      fallback,
    },
    selection: color('--selection', def.selection),
    propGroups: Object.fromEntries(
      PROP_KEYS.map((g) => [g, color(`--prop-${g}`, def.propGroups[g])])
    ) as PropGroupColors,
    shadowAlpha: number('--shadow-alpha', def.shadowAlpha, 1),
    support: {
      grounded: color('--support-grounded', def.support.grounded),
      high: color('--support-high', def.support.high),
      mid: color('--support-mid', def.support.mid),
      low: color('--support-low', def.support.low),
      broken: color('--support-broken', def.support.broken),
    },
    terrain: {
      shade: color('--terrain-shade', def.terrain.shade),
      light: color('--terrain-light', def.terrain.light),
      contour: color('--contour', def.terrain.contour),
      water: color('--water', def.terrain.water),
    },
    ink: {
      neutral: color('--ink', def.ink.neutral),
      accent: color('--accent', def.ink.accent),
      info: color('--info', def.ink.info),
      pinned: color('--pinned', def.ink.pinned),
      success: color('--success', def.ink.success),
      danger: color('--danger', def.ink.danger),
    },
  };
};
