/**
 * The building-piece catalogue, from raw game data in the shape of
 * `research/valheim-pieces.json` (the install parser's output, or that fixture in
 * tests). The data is treated as `unknown` and its shape validated.
 *
 * Axes are Unity local space in metres: x = length, y = height, z = thickness.
 */
import { asArray, asNullable, asNumber, asNumbers, asRecord, asString, fail } from './parse';

export type V3 = readonly [x: number, y: number, z: number];

export interface Resource {
  item: string;
  amount: number;
}

export interface PieceDef {
  prefab: string;
  name: string;
  /** Polish name; falls back to the English one when the game has none. */
  namePl: string;
  /** Hammer category, or 'unknown' when the extract has a non-string (unmapped) value. */
  category: string;
  station: string | null;
  material: string | null;
  health: number | null;
  comfort: number;
  resources: Resource[];
  snapPoints: V3[];
  colliderBounds: readonly [min: V3, max: V3] | null;
  colliderSize: V3 | null;
}

export interface MaterialSupport {
  maxSupport: number;
  minSupport: number;
  verticalLoss: number;
  horizontalLoss: number;
}

export interface StationBuildRange {
  baseRadius: number;
  perUpgrade: number;
}

export interface Catalog {
  pieces: ReadonlyMap<string, PieceDef>;
  materialSupport: Record<string, MaterialSupport>;
  /** Keyed by station prefab. */
  stationBuildRange: Record<string, StationBuildRange>;
  wardRadius: number;
}

export const parseCatalog = (raw: unknown): Catalog => {
  const root = asRecord(raw, '$');
  const meta = asRecord(root.meta, '$.meta');

  const pieces = new Map<string, PieceDef>();
  asArray(root.pieces, '$.pieces').forEach((item, i) => {
    const piece = parsePiece(item, `$.pieces[${i}]`);
    if (pieces.has(piece.prefab)) fail(`$.pieces[${i}].prefab`, `a unique prefab`);
    pieces.set(piece.prefab, piece);
  });

  return {
    pieces,
    materialSupport: mapValues(meta.materialSupport, '$.meta.materialSupport', parseSupport),
    stationBuildRange: mapValues(
      meta.stationBuildRange,
      '$.meta.stationBuildRange',
      parseBuildRange
    ),
    wardRadius: asNumber(meta.wardRadius_m, '$.meta.wardRadius_m'),
  };
};

/** Size of the piece's snap-point cloud along `axis` (0 when it has no snap points). */
export const snapExtent = (piece: PieceDef, axis: 'x' | 'y' | 'z'): number => {
  if (piece.snapPoints.length === 0) return 0;
  const index = ({ x: 0, y: 1, z: 2 } as const)[axis];
  const values = piece.snapPoints.map((p) => p[index]);
  return Math.max(...values) - Math.min(...values);
};

const parsePiece = (value: unknown, path: string): PieceDef => {
  const p = asRecord(value, path);
  const name = asString(p.name, `${path}.name`);
  return {
    prefab: asString(p.prefab, `${path}.prefab`),
    name,
    // A few pieces have no Polish translation in the extract.
    namePl: asNullable(p.namePl, `${path}.namePl`, asString) ?? name,
    category: typeof p.category === 'string' ? p.category : 'unknown',
    station: asNullable(p.station, `${path}.station`, asString),
    material: asNullable(p.material, `${path}.material`, asString),
    health: asNullable(p.health, `${path}.health`, asNumber),
    comfort: asNumber(p.comfort, `${path}.comfort`),
    resources: asArray(p.resources, `${path}.resources`).map((r, i) =>
      parseResource(r, `${path}.resources[${i}]`)
    ),
    snapPoints: asArray(p.snapPoints, `${path}.snapPoints`).map((s, i) =>
      asNumbers(s, `${path}.snapPoints[${i}]`, 3)
    ),
    colliderBounds: asNullable(p.colliderBounds, `${path}.colliderBounds`, parseBounds),
    colliderSize: asNullable(p.colliderSize, `${path}.colliderSize`, asV3),
  };
};

const parseResource = (value: unknown, path: string): Resource => {
  const [item, amount] = asArray(value, path);
  return { item: asString(item, `${path}[0]`), amount: asNumber(amount, `${path}[1]`) };
};

const parseBounds = (value: unknown, path: string): readonly [V3, V3] => {
  const [min, max] = asArray(value, path);
  return [asV3(min, `${path}[0]`), asV3(max, `${path}[1]`)];
};

const asV3 = (value: unknown, path: string): V3 => asNumbers(value, path, 3);

const parseSupport = (value: unknown, path: string): MaterialSupport => {
  const [maxSupport, minSupport, verticalLoss, horizontalLoss] = asNumbers(value, path, 4);
  return { maxSupport, minSupport, verticalLoss, horizontalLoss };
};

const parseBuildRange = (value: unknown, path: string): StationBuildRange => {
  const [baseRadius, perUpgrade] = asNumbers(value, path, 2);
  return { baseRadius, perUpgrade };
};

const mapValues = <T>(
  value: unknown,
  path: string,
  parse: (v: unknown, p: string) => T
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(asRecord(value, path)).map(([key, v]) => [key, parse(v, `${path}.${key}`)])
  );
