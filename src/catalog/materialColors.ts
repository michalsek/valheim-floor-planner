/**
 * Plan-view colours per piece material (`PieceDef.material`), from a palette. The
 * palette is theme data (`--mat-*` / `--floor-*` in `global.css`); this module only
 * maps a material through it, so it stays free of the DOM.
 */

/** The materials with their own palette colour; anything else uses the fallback. */
export const PALETTE_MATERIALS = [
  'wood',
  'hardwood',
  'timberwood',
  'ashstone',
  'stone',
  'marble',
  'iron',
] as const;

export type PaletteMaterial = (typeof PALETTE_MATERIALS)[number];

const PALETTE_SET: ReadonlySet<string> = new Set(PALETTE_MATERIALS);

export const isPaletteMaterial = (material: string): material is PaletteMaterial =>
  PALETTE_SET.has(material);

export interface MaterialPalette {
  /** `#rrggbb` per palette material. */
  materials: Readonly<Record<PaletteMaterial, string>>;
  /** For materials without a colour (and pieces without a material). */
  fallback: string;
  /** What floor tints are mixed towards, so dark materials still show on the canvas. */
  floorBase: string;
  /** Share of the material colour in a floor tint (0–1). */
  floorShare: number;
}

/** The custom property holding a material's colour. */
export const matToken = (material: string): string => `--mat-${material}`;

export const materialColor = (
  palette: MaterialPalette,
  material: string | null | undefined
): string =>
  material && isPaletteMaterial(material) ? palette.materials[material] : palette.fallback;

/**
 * A material's colour as a CSS variable, for SVG fills (in `style`: presentation
 * attributes don't resolve `var()`), so the overlay follows the theme without a render.
 */
export const materialVar = (material: string | null | undefined): string =>
  `var(${matToken(material && isPaletteMaterial(material) ? material : 'fallback')})`;

/** Lighter and darker tiles alternate by this much, so tiles can be counted. */
const FLOOR_CHECKER = 0.08;

type Rgb = readonly [number, number, number];

const toRgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: Rgb): string =>
  `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;

/** `a` mixed towards `b` by `t` (0 = a, 1 = b), both `#rrggbb`. */
export const mixHex = (a: string, b: string, t: number): string => {
  const from = toRgb(a);
  const to = toRgb(b);
  const mix = (i: 0 | 1 | 2) => from[i] * (1 - t) + to[i] * t;
  return toHex([mix(0), mix(1), mix(2)]);
};

/**
 * A floor tile's colour: the material tinted towards the floor base, so floors never
 * read as one block with the (opaque, full-colour) walls on them. `odd` tiles of the
 * checkerboard are a little darker.
 */
export const floorColor = (palette: MaterialPalette, material: string, odd: boolean): string => {
  const base = toRgb(palette.floorBase);
  const share = palette.floorShare;
  const shade = odd ? 1 - FLOOR_CHECKER : 1 + FLOOR_CHECKER;
  const mixed = toRgb(materialColor(palette, material)).map(
    (c, i) => (c * share + (base[i] ?? 0) * (1 - share)) * shade
  );
  return toHex([mixed[0] ?? 0, mixed[1] ?? 0, mixed[2] ?? 0]);
};
