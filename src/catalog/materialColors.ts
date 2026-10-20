/**
 * Plan-view colours per piece material (`PieceDef.material`), from a palette. The
 * palette is theme data (`--mat-*` in `global.css`); this module only
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
