/**
 * Plan (de)serialisation. `parsePlan` validates untrusted input (storage, files) and
 * throws on a bad shape. Collections added by later milestones default to `{}`, and a
 * missing name to "Untitled".
 */
import { samePoint } from './geometry/polyline';
import {
  DEFAULT_PLAN_NAME,
  type Dimension,
  type Floor,
  type Opening,
  type Plan,
  type Vec2,
  type WallRun,
  type WallSide,
} from './types';

export const serializePlan = (plan: Plan): string => JSON.stringify(plan);

export class PlanParseError extends Error {
  constructor(path: string, expected: string) {
    super(`Invalid plan at ${path}: expected ${expected}`);
    this.name = 'PlanParseError';
  }
}

/** Hand-edited files beyond these would make the splitter crawl. */
export const MAX_WALL_HEIGHT_M = 64;
export const MAX_POINTS_PER_RUN = 10_000;
/** Floors beyond this would make the tiler crawl. */
export const MAX_FLOOR_SIDE_M = 512;

function fail(path: string, expected: string): never {
  throw new PlanParseError(path, expected);
}

const asRecord = (value: unknown, path: string): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail(path, 'an object');

const asFinite = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fail(path, 'a finite number');

const asString = (value: unknown, path: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fail(path, 'a non-empty string');

const asPoint = (value: unknown, path: string): Vec2 => {
  const p = asRecord(value, path);
  return { x: asFinite(p.x, `${path}.x`), z: asFinite(p.z, `${path}.z`) };
};

const asSide = (value: unknown, path: string): WallSide =>
  value === 'left' || value === 'right' ? value : fail(path, `'left' or 'right'`);

const parseWall = (value: unknown, key: string, path: string): WallRun => {
  const w = asRecord(value, path);
  const id = asString(w.id, `${path}.id`);
  if (id !== key) fail(`${path}.id`, `the key "${key}"`);
  const { points, closed } = w;
  if (!Array.isArray(points) || points.length > MAX_POINTS_PER_RUN) {
    fail(`${path}.points`, `an array of at most ${MAX_POINTS_PER_RUN} points`);
  }
  if (typeof closed !== 'boolean') fail(`${path}.closed`, 'a boolean');
  const height = asFinite(w.height, `${path}.height`);
  if (height <= 0 || height > MAX_WALL_HEIGHT_M) {
    fail(`${path}.height`, `a height above 0 and at most ${MAX_WALL_HEIGHT_M} m`);
  }
  return {
    id,
    familyId: asString(w.familyId, `${path}.familyId`),
    points: points.map((p: unknown, i) => asPoint(p, `${path}.points[${i}]`)),
    closed,
    side: asSide(w.side, `${path}.side`),
    height,
  };
};

const parseDimension = (value: unknown, key: string, path: string): Dimension => {
  const d = asRecord(value, path);
  const id = asString(d.id, `${path}.id`);
  if (id !== key) fail(`${path}.id`, `the key "${key}"`);
  const a = asPoint(d.a, `${path}.a`);
  const b = asPoint(d.b, `${path}.b`);
  if (samePoint(a, b)) fail(`${path}.b`, 'a point other than a');
  return { id, a, b, offset: asFinite(d.offset, `${path}.offset`) };
};

const parseFloor = (value: unknown, key: string, path: string): Floor => {
  const f = asRecord(value, path);
  const id = asString(f.id, `${path}.id`);
  if (id !== key) fail(`${path}.id`, `the key "${key}"`);
  const min = asPoint(f.min, `${path}.min`);
  const max = asPoint(f.max, `${path}.max`);
  if (!(max.x > min.x && max.z > min.z)) fail(`${path}.max`, 'a point beyond min on both axes');
  if (max.x - min.x > MAX_FLOOR_SIDE_M || max.z - min.z > MAX_FLOOR_SIDE_M) {
    fail(`${path}.max`, `sides of at most ${MAX_FLOOR_SIDE_M} m`);
  }
  return { id, familyId: asString(f.familyId, `${path}.familyId`), min, max };
};

const parseOpening =
  (walls: Plan['walls']) =>
  (value: unknown, key: string, path: string): Opening => {
    const o = asRecord(value, path);
    const id = asString(o.id, `${path}.id`);
    if (id !== key) fail(`${path}.id`, `the key "${key}"`);
    const wallId = asString(o.wallId, `${path}.wallId`);
    if (!Object.hasOwn(walls, wallId)) fail(`${path}.wallId`, 'the id of a wall in the plan');
    return {
      id,
      wallId,
      prefab: asString(o.prefab, `${path}.prefab`),
      at: asPoint(o.at, `${path}.at`),
    };
  };

/** Parses each entry of an optional keyed collection (missing → `{}`). */
const parseCollection = <T>(
  value: unknown,
  path: string,
  parse: (item: unknown, key: string, path: string) => T
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(asRecord(value ?? {}, path)).map(([key, item]) => [
      key,
      parse(item, key, `${path}.${key}`),
    ])
  );

/** Lenient: files from before plans had names (or with a blank one) load as "Untitled". */
const parseName = (value: unknown): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : DEFAULT_PLAN_NAME;

export const parsePlan = (raw: unknown): Plan => {
  const root = asRecord(raw, '$');
  if (root.version !== 1) fail('$.version', '1');
  const walls = parseCollection(root.walls, '$.walls', parseWall);
  return {
    version: 1,
    name: parseName(root.name),
    walls,
    dimensions: parseCollection(root.dimensions, '$.dimensions', parseDimension),
    floors: parseCollection(root.floors, '$.floors', parseFloor),
    openings: parseCollection(root.openings, '$.openings', parseOpening(walls)),
  };
};
