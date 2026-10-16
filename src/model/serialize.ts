/**
 * Plan (de)serialisation. `parsePlan` validates untrusted input (storage, files) and
 * throws on a bad shape. Collections added by later milestones default to `{}`.
 */
import type { Plan, Vec2, WallRun, WallSide } from './types';

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

export const parsePlan = (raw: unknown): Plan => {
  const root = asRecord(raw, '$');
  if (root.version !== 1) fail('$.version', '1');
  const walls = asRecord(root.walls ?? {}, '$.walls');
  return {
    version: 1,
    walls: Object.fromEntries(
      Object.entries(walls).map(([key, w]) => [key, parseWall(w, key, `$.walls.${key}`)])
    ),
  };
};
