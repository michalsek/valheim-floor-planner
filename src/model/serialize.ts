/**
 * Plan (de)serialisation. `parsePlan` validates untrusted input (storage, files) and
 * throws on a bad shape. Collections added by later milestones default to `{}`, a
 * missing underlay and import frame to null, and a missing name to "Untitled". Version 1
 * files (before levels) load with every elevation at 0, version 2 ones (before roofs)
 * without roofs, version 3 ones (before world imports) without raw pieces, version 4
 * import frames without terrain; plans are always written as version 5, so an older
 * app refuses them instead of dropping what it doesn't know.
 */
import { elevationProblem, MAX_ELEVATION, MIN_ELEVATION } from './elevation';
import { samePoint } from './geometry/polyline';
import { normalizeDeg } from './geometry/propGeometry';
import { MAX_PROPS, propProblem } from './props';
import { MAX_RAW_PIECES, rawPieceProblem } from './rawPieces';
import {
  DEFAULT_PLAN_NAME,
  type Dimension,
  type Floor,
  type ImportFrame,
  type Opening,
  type Plan,
  type Prop,
  type RawPiece,
  type Roof,
  type RoofKind,
  type SiteTerrain,
  type Underlay,
  type Vec2,
  type Vec3,
  type WallRun,
  type WallSide,
} from './types';
import { roofProblem } from './roofs/roofCheck';
import { siteTerrainProblem } from './terrain/siteCheck';
import { underlayProblem } from './underlay';

/** The plan as JSON; `extras` adds top-level fields (a file's embedded image). */
export const serializePlan = (plan: Plan, extras: Record<string, unknown> = {}): string =>
  JSON.stringify({ ...plan, ...extras });

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

const asPoint3 = (value: unknown, path: string): Vec3 => {
  const p = asRecord(value, path);
  return {
    x: asFinite(p.x, `${path}.x`),
    y: asFinite(p.y, `${path}.y`),
    z: asFinite(p.z, `${path}.z`),
  };
};

const asSide = (value: unknown, path: string): WallSide =>
  value === 'left' || value === 'right' ? value : fail(path, `'left' or 'right'`);

/** How an object's elevation is read: required (version 2) or always 0 (version 1). */
type ElevationReader = (value: unknown, path: string) => number;

const readElevation: ElevationReader = (value, path) => {
  const elevation = asFinite(value, path);
  return elevationProblem(elevation)
    ? fail(path, `an elevation from ${MIN_ELEVATION} to ${MAX_ELEVATION} m`)
    : elevation;
};

const groundElevation: ElevationReader = () => 0;

type Parser<T> = (value: unknown, key: string, path: string) => T;

const parseWall =
  (elevationOf: ElevationReader): Parser<WallRun> =>
  (value, key, path) => {
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
      elevation: elevationOf(w.elevation, `${path}.elevation`),
    };
  };

const parseDimension =
  (elevationOf: ElevationReader): Parser<Dimension> =>
  (value, key, path) => {
    const d = asRecord(value, path);
    const id = asString(d.id, `${path}.id`);
    if (id !== key) fail(`${path}.id`, `the key "${key}"`);
    const a = asPoint(d.a, `${path}.a`);
    const b = asPoint(d.b, `${path}.b`);
    if (samePoint(a, b)) fail(`${path}.b`, 'a point other than a');
    return {
      id,
      a,
      b,
      offset: asFinite(d.offset, `${path}.offset`),
      elevation: elevationOf(d.elevation, `${path}.elevation`),
    };
  };

const parseFloor =
  (elevationOf: ElevationReader): Parser<Floor> =>
  (value, key, path) => {
    const f = asRecord(value, path);
    const id = asString(f.id, `${path}.id`);
    if (id !== key) fail(`${path}.id`, `the key "${key}"`);
    const min = asPoint(f.min, `${path}.min`);
    const max = asPoint(f.max, `${path}.max`);
    if (!(max.x > min.x && max.z > min.z)) fail(`${path}.max`, 'a point beyond min on both axes');
    if (max.x - min.x > MAX_FLOOR_SIDE_M || max.z - min.z > MAX_FLOOR_SIDE_M) {
      fail(`${path}.max`, `sides of at most ${MAX_FLOOR_SIDE_M} m`);
    }
    return {
      id,
      familyId: asString(f.familyId, `${path}.familyId`),
      min,
      max,
      elevation: elevationOf(f.elevation, `${path}.elevation`),
    };
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

/** Unknown prefabs load (the plan warns about them). Ranges are `propProblem`'s. */
const parseProp =
  (elevationOf: ElevationReader): Parser<Prop> =>
  (value, key, path) => {
    const p = asRecord(value, path);
    const id = asString(p.id, `${path}.id`);
    if (id !== key) fail(`${path}.id`, `the key "${key}"`);
    const prop = {
      id,
      prefab: asString(p.prefab, `${path}.prefab`),
      position: asPoint(p.position, `${path}.position`),
      rotation: normalizeDeg(asFinite(p.rotation, `${path}.rotation`)),
      upgrades: p.upgrades === undefined ? 0 : asFinite(p.upgrades, `${path}.upgrades`),
      elevation: elevationOf(p.elevation, `${path}.elevation`),
    };
    const problem = propProblem(prop);
    return problem ? fail(path, `an item where ${problem}`) : prop;
  };

/** Shapes are checked here, values by `roofProblem`; an unknown family loads (and warns). */
const parseRoof: Parser<Roof> = (value, key, path) => {
  const r = asRecord(value, path);
  const id = asString(r.id, `${path}.id`);
  if (id !== key) fail(`${path}.id`, `the key "${key}"`);
  if (!Array.isArray(r.outline)) fail(`${path}.outline`, 'an array of points');
  const overhang = asRecord(r.overhang, `${path}.overhang`);
  const roof = {
    id,
    elevation: readElevation(r.elevation, `${path}.elevation`),
    base: asFinite(r.base, `${path}.base`),
    outline: r.outline.map((p: unknown, i) => asPoint(p, `${path}.outline[${i}]`)),
    familyId: asString(r.familyId, `${path}.familyId`),
    pitch: asFinite(r.pitch, `${path}.pitch`) as Roof['pitch'],
    kind: asString(r.kind, `${path}.kind`) as RoofKind,
    ridgeAxis: asString(r.ridgeAxis, `${path}.ridgeAxis`) as Roof['ridgeAxis'],
    lowSide: asString(r.lowSide, `${path}.lowSide`) as Roof['lowSide'],
    overhang: {
      eave: asFinite(overhang.eave, `${path}.overhang.eave`) as Roof['overhang']['eave'],
      gable: asFinite(overhang.gable, `${path}.overhang.gable`) as Roof['overhang']['gable'],
    },
    gableWalls: asString(r.gableWalls, `${path}.gableWalls`) as Roof['gableWalls'],
  };
  const problem = roofProblem(roof);
  return problem ? fail(path, `a roof where ${problem}`) : roof;
};

/** Unknown prefabs load (the plan warns about them). Ranges are `rawPieceProblem`'s. */
const parseRawPiece: Parser<RawPiece> = (value, key, path) => {
  const p = asRecord(value, path);
  const id = asString(p.id, `${path}.id`);
  if (id !== key) fail(`${path}.id`, `the key "${key}"`);
  const rotation = asRecord(p.rotation, `${path}.rotation`);
  const piece = {
    id,
    prefab: asString(p.prefab, `${path}.prefab`),
    position: asPoint3(p.position, `${path}.position`),
    rotation: {
      yaw: normalizeDeg(asFinite(rotation.yaw, `${path}.rotation.yaw`)),
      pitch: asFinite(rotation.pitch, `${path}.rotation.pitch`),
      roll: asFinite(rotation.roll, `${path}.rotation.roll`),
    },
    elevation: readElevation(p.elevation, `${path}.elevation`),
  };
  const problem = rawPieceProblem(piece);
  return problem ? fail(path, `a piece where ${problem}`) : piece;
};

const parseRawPieces = (value: unknown): Plan['rawPieces'] => {
  const pieces = parseCollection(value, '$.rawPieces', parseRawPiece);
  if (Object.keys(pieces).length > MAX_RAW_PIECES) {
    fail('$.rawPieces', `at most ${MAX_RAW_PIECES} pieces`);
  }
  return pieces;
};

const asArray = (value: unknown, path: string): unknown[] =>
  Array.isArray(value) ? value : fail(path, 'an array');

/** Shapes are checked here, values by `siteTerrainProblem`. */
const parseSiteTerrain = (value: unknown, path: string): SiteTerrain | null => {
  if (value === undefined || value === null) return null;
  const t = asRecord(value, path);
  const b = asRecord(t.biomes, `${path}.biomes`);
  const n = asRecord(t.notices, `${path}.notices`);
  const check = asRecord(n.check, `${path}.notices.check`);
  if (typeof t.heights !== 'string') fail(`${path}.heights`, 'a string');
  const num = (v: unknown, at: string) => asFinite(v, `${path}.${at}`);
  const terrain: SiteTerrain = {
    x0: num(t.x0, 'x0'),
    z0: num(t.z0, 'z0'),
    cols: num(t.cols, 'cols'),
    rows: num(t.rows, 'rows'),
    heights: t.heights,
    biomes: {
      zx0: num(b.zx0, 'biomes.zx0'),
      zz0: num(b.zz0, 'biomes.zz0'),
      cols: num(b.cols, 'biomes.cols'),
      rows: num(b.rows, 'biomes.rows'),
      codes: asArray(b.codes, `${path}.biomes.codes`).map((c, i) => num(c, `biomes.codes[${i}]`)),
    },
    worldGenVersion: num(t.worldGenVersion, 'worldGenVersion'),
    revision: num(t.revision, 'revision'),
    notices: {
      locations: asArray(n.locations, `${path}.notices.locations`).map((p, i) =>
        asPoint(p, `${path}.notices.locations[${i}]`)
      ),
      legacyEdits: num(n.legacyEdits, 'notices.legacyEdits'),
      // Added in the M16 fix round: v5 plans saved before it have none.
      unreadEdits: n.unreadEdits === undefined ? 0 : num(n.unreadEdits, 'notices.unreadEdits'),
      check: {
        n: num(check.n, 'notices.check.n'),
        maxError: num(check.maxError, 'notices.check.maxError'),
      },
    },
  };
  const problem = siteTerrainProblem(terrain);
  return problem ? fail(path, problem) : terrain;
};

const parseImportFrame = (
  value: unknown,
  path: string,
  withTerrain: boolean
): ImportFrame | null => {
  if (value === undefined || value === null) return null;
  const f = asRecord(value, path);
  return {
    worldName: asString(f.worldName, `${path}.worldName`),
    origin: asPoint3(f.origin, `${path}.origin`),
    yaw: normalizeDeg(asFinite(f.yaw, `${path}.yaw`)),
    terrain: withTerrain ? parseSiteTerrain(f.terrain, `${path}.terrain`) : null,
  };
};

/** Shapes are checked here, ranges by `underlayProblem`. */
const parseUnderlay = (value: unknown, path: string): Underlay | null => {
  if (value === undefined || value === null) return null;
  const u = asRecord(value, path);
  const size = asRecord(u.pixelSize, `${path}.pixelSize`);
  if (typeof u.locked !== 'boolean') fail(`${path}.locked`, 'a boolean');
  const underlay = {
    imageId: asString(u.imageId, `${path}.imageId`),
    name: typeof u.name === 'string' ? u.name : '',
    pixelSize: {
      w: asFinite(size.w, `${path}.pixelSize.w`),
      h: asFinite(size.h, `${path}.pixelSize.h`),
    },
    origin: asPoint(u.origin, `${path}.origin`),
    metresPerPixel: asFinite(u.metresPerPixel, `${path}.metresPerPixel`),
    opacity: asFinite(u.opacity, `${path}.opacity`),
    locked: u.locked,
  };
  const problem = underlayProblem(underlay);
  return problem ? fail(path, `an underlay where ${problem}`) : underlay;
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

const parseProps = (value: unknown, elevationOf: ElevationReader): Plan['props'] => {
  const props = parseCollection(value, '$.props', parseProp(elevationOf));
  if (Object.keys(props).length > MAX_PROPS) fail('$.props', `at most ${MAX_PROPS} items`);
  return props;
};

/** Lenient: files from before plans had names (or with a blank one) load as "Untitled". */
const parseName = (value: unknown): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : DEFAULT_PLAN_NAME;

export const parsePlan = (raw: unknown): Plan => {
  const root = asRecord(raw, '$');
  const { version } = root;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5) {
    fail('$.version', '1 to 5');
  }
  const elevationOf = version === 1 ? groundElevation : readElevation;
  const walls = parseCollection(root.walls, '$.walls', parseWall(elevationOf));
  return {
    version: 5,
    name: parseName(root.name),
    walls,
    dimensions: parseCollection(root.dimensions, '$.dimensions', parseDimension(elevationOf)),
    floors: parseCollection(root.floors, '$.floors', parseFloor(elevationOf)),
    openings: parseCollection(root.openings, '$.openings', parseOpening(walls)),
    props: parseProps(root.props, elevationOf),
    roofs: version >= 3 ? parseCollection(root.roofs, '$.roofs', parseRoof) : {},
    rawPieces: version >= 4 ? parseRawPieces(root.rawPieces) : {},
    underlay: parseUnderlay(root.underlay, '$.underlay'),
    importFrame:
      version >= 4 ? parseImportFrame(root.importFrame, '$.importFrame', version === 5) : null,
  };
};
