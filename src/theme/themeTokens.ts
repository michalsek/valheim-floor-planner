/**
 * The theme values that don't reach the page through CSS: the grid shader uniforms, the
 * slab mesh colours and the 3D view's colours (its tool lines and ghosts too). Parsed
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

/** The support view's colours: grounded, the strong → weak ramp, and collapsing. */
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
  /** Floor slab opacity (0–1). */
  floorOpacity: number;
  palette: MaterialPalette;
  /** Selected and hovered items (the 3D view mixes it into their colour). */
  selection: string;
  /** Prop colours by group (3D boxes; the overlay reads the same `--prop-*` tokens). */
  propGroups: PropGroupColors;
  /** Darkness of the 3D view's ground shadows (0–1). */
  shadowAlpha: number;
  /** The canvas background: pieces off the current level fade towards it in 3D. */
  canvas: string;
  support: SupportColors;
  /** The 3D view's tool drawing: lines, the cursor, valid and invalid ghosts. */
  ink: ToolInk;
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
  floorOpacity: 0.6,
  palette: {
    materials: uniformMaterials(FALLBACK),
    fallback: FALLBACK,
    floorBase: '#3d424a',
    floorShare: 0.4,
  },
  selection: '#ff5ad2',
  propGroups: Object.fromEntries(PROP_KEYS.map((g) => [g, '#9aa3ad'])) as PropGroupColors,
  shadowAlpha: 0.4,
  canvas: '#2a2c30',
  support: {
    grounded: '#5d9bd8',
    high: '#6cc46a',
    mid: '#e6c74a',
    low: '#e0613f',
    broken: '#e04fd8',
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
    floorOpacity: number('--floor-opacity', def.floorOpacity, 1),
    palette: {
      materials,
      fallback,
      floorBase: color('--floor-base', def.palette.floorBase),
      floorShare: number('--floor-material-share', def.palette.floorShare, 1),
    },
    selection: color('--selection', def.selection),
    propGroups: Object.fromEntries(
      PROP_KEYS.map((g) => [g, color(`--prop-${g}`, def.propGroups[g])])
    ) as PropGroupColors,
    shadowAlpha: number('--shadow-alpha', def.shadowAlpha, 1),
    canvas: color('--canvas', def.canvas),
    support: {
      grounded: color('--support-grounded', def.support.grounded),
      high: color('--support-high', def.support.high),
      mid: color('--support-mid', def.support.mid),
      low: color('--support-low', def.support.low),
      broken: color('--support-broken', def.support.broken),
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
