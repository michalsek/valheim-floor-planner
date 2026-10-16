/** Plan-view fill colour per piece material (`PieceDef.material`). */
const MATERIAL_COLORS: Record<string, string> = {
  wood: '#b07a45',
  hardwood: '#7d5232',
  timberwood: '#8f6a4a',
  ashstone: '#6f7781',
  stone: '#9a9a92',
  marble: '#4a4650',
  iron: '#7a8590',
};

const FALLBACK_COLOR = '#b06ab3';

export const materialColor = (material: string | null | undefined): string =>
  (material && MATERIAL_COLORS[material]) || FALLBACK_COLOR;

/**
 * What floor tints are mixed towards: a little lighter than the canvas, so dark
 * materials (black marble) still show on it.
 */
const FLOOR_BASE = '#3a424d';
/** Share of the material colour in a floor tint. */
const FLOOR_MATERIAL_SHARE = 0.4;
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

/**
 * A floor tile's colour: the material tinted towards the floor base, so floors never
 * read as one block with the (opaque, full-colour) walls on them. `odd` tiles of the
 * checkerboard are a little darker.
 */
export const floorColor = (material: string, odd: boolean): string => {
  const base = toRgb(FLOOR_BASE);
  const shade = odd ? 1 - FLOOR_CHECKER : 1 + FLOOR_CHECKER;
  const mixed = toRgb(materialColor(material)).map(
    (c, i) => (c * FLOOR_MATERIAL_SHARE + (base[i] ?? 0) * (1 - FLOOR_MATERIAL_SHARE)) * shade
  );
  return toHex([mixed[0] ?? 0, mixed[1] ?? 0, mixed[2] ?? 0]);
};
