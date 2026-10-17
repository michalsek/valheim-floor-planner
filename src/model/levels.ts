/**
 * Levels, derived from the plan rather than stored: a level is a distinct elevation of
 * its walls, floors, props and dimensions (`LEVELLED_KINDS`; openings stand on their
 * wall's). Stairs and ladders connect levels rather than make them: each piece of a
 * flight belongs to the level the flight starts from. Pure.
 *
 * `levelPlan` is the plan as one level sees it. It shares the entity objects, and a
 * filtered record is reused while it keeps the same objects (an edit on another level
 * leaves it alone), so the per-object caches (splits, rooms) keep hitting; with
 * everything on one level it is the plan itself.
 */
import type { Library } from '../catalog/library';
import { isLevelConnector } from '../catalog/propDefs';

import type { PlanCommand } from './commands';
import { roundElevation, sameLevel } from './elevation';
import { ITEM_KINDS, LEVELLED_KINDS, type LevelledRecord } from './itemKinds';
import { propSpan, type PieceBox } from './pieceBoxes';
import { allItems, type Selection, type SelectionItem } from './selection';
import type { Plan, Prop } from './types';

type Lib = Pick<Library, 'propDefs'>;
type Levelled = { elevation: number };

export interface Level {
  elevation: number;
  /** Pieces and props standing on it (as the 3D view counts boxes). */
  count: number;
}

/** A ghost reaches within this of the current level from below (stilts, tall walls). */
const GHOST_REACH = 0.5;

const isConnector = (prop: Prop, lib: Lib): boolean =>
  isLevelConnector(lib.propDefs.get(prop.prefab)?.group);

export interface LevelIndex {
  /** The levels, lowest first. */
  levels: number[];
  /** The level something at `elevation` is on; a stair or ladder piece's is its flight's. */
  levelOf(elevation: number, connector: boolean): number;
}

const indexCache = new WeakMap<Plan, LevelIndex>();

/**
 * The plan's levels: the elevations of everything but stairs and ladders, plus, for
 * stairs below all of those, the lowest of them.
 */
export const levelIndex = (plan: Plan, lib: Lib): LevelIndex => {
  const cached = indexCache.get(plan);
  if (cached) return cached;
  const real = new Set<number>();
  let lowestConnector = Infinity;
  for (const { record } of LEVELLED_KINDS) {
    for (const o of Object.values(plan[record]) as Levelled[]) {
      if (record === 'props' && isConnector(o as Prop, lib)) {
        lowestConnector = Math.min(lowestConnector, o.elevation);
      } else real.add(roundElevation(o.elevation));
    }
  }
  if (lowestConnector < Math.min(...real)) real.add(roundElevation(lowestConnector));
  const levels = [...real].sort((a, b) => a - b);
  const levelOf = (elevation: number, connector: boolean): number => {
    if (!connector) return roundElevation(elevation);
    let level = roundElevation(elevation);
    for (const l of levels) if (l <= elevation + 1e-6) level = l;
    return level;
  };
  const index = { levels, levelOf };
  indexCache.set(plan, index);
  return index;
};

/** The level an item is on (an opening: its wall's; a stair piece: its flight's). */
export const levelOfItem = (plan: Plan, item: SelectionItem, lib: Lib): number | null => {
  const elevation = ITEM_KINDS[item.kind].elevation(plan, item.id);
  if (elevation === null) return null;
  const prop = item.kind === 'prop' ? plan.props[item.id] : undefined;
  return levelIndex(plan, lib).levelOf(elevation, prop !== undefined && isConnector(prop, lib));
};

/** The next level above `elevation`, or null. */
export const levelAbove = (plan: Plan, elevation: number, lib: Lib): number | null =>
  levelIndex(plan, lib).levels.find((l) => l > elevation && !sameLevel(l, elevation)) ?? null;

/** The next level below `elevation`, or null. */
export const levelBelow = (plan: Plan, elevation: number, lib: Lib): number | null =>
  levelIndex(plan, lib)
    .levels.filter((l) => l < elevation && !sameLevel(l, elevation))
    .at(-1) ?? null;

/** Every level, top to bottom, with how many boxes stand on it. */
export const levelsOf = (
  plan: Plan,
  boxes: readonly Pick<PieceBox, 'elevation' | 'group'>[],
  lib: Lib
): Level[] => {
  const index = levelIndex(plan, lib);
  const counts = new Map(index.levels.map((l) => [l, 0]));
  for (const box of boxes) {
    const level = index.levelOf(box.elevation, isLevelConnector(box.group));
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  return [...counts]
    .map(([elevation, count]) => ({ elevation, count }))
    .sort((a, b) => b.elevation - a.elevation);
};

// Each filtered record by source record and filter, and the last result of each filter:
// a new result with the same objects is replaced by that one, so it stays the same.
const filterCache = new WeakMap<object, Map<string, object>>();
const lastResult = new Map<string, Record<string, unknown>>();

const sameEntries = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

/** The entries of `record` that `keep`; `record` itself when all are kept. */
const filterRecord = <T>(
  record: Readonly<Record<string, T>>,
  cacheKey: string,
  keep: (value: T) => boolean
): Record<string, T> => {
  let byKey = filterCache.get(record);
  if (!byKey) filterCache.set(record, (byKey = new Map()));
  const cached = byKey.get(cacheKey) as Record<string, T> | undefined;
  if (cached) return cached;
  const entries = Object.entries(record);
  const kept = entries.filter(([, value]) => keep(value));
  let result = kept.length === entries.length ? record : Object.fromEntries(kept);
  const last = lastResult.get(cacheKey) as Record<string, T> | undefined;
  if (last && result !== record && sameEntries(last, result)) result = last;
  lastResult.set(cacheKey, result);
  byKey.set(cacheKey, result);
  return result;
};

/** Which objects of each levelled record a view keeps. */
type Keep = { readonly [K in LevelledRecord]: (value: Plan[K][string]) => boolean };

/**
 * The plan with only what `keep` keeps (openings with their wall); `plan` when that is
 * all. Props have their own cache key: whether a stair piece is kept depends on the
 * levels, the other records' filters don't.
 */
const filterPlan = (plan: Plan, cacheKey: string, keep: Keep, propsKey = cacheKey): Plan => {
  const key = (record: string) => `${record}|${record === 'props' ? propsKey : cacheKey}`;
  const walls = filterRecord(plan.walls, key('walls'), keep.walls);
  const view: Plan = {
    ...plan,
    walls,
    floors: filterRecord(plan.floors, key('floors'), keep.floors),
    props: filterRecord(plan.props, key('props'), keep.props),
    dimensions: filterRecord(plan.dimensions, key('dimensions'), keep.dimensions),
    openings:
      walls === plan.walls
        ? plan.openings
        : filterRecord(plan.openings, key('openings'), (o) => Object.hasOwn(walls, o.wallId)),
  };
  return LEVELLED_KINDS.every(({ record }) => view[record] === plan[record]) ? plan : view;
};

const viewCache = new WeakMap<Plan, Map<string, Plan>>();

const memoView = (plan: Plan, cacheKey: string, make: () => Plan): Plan => {
  let byKey = viewCache.get(plan);
  if (!byKey) viewCache.set(plan, (byKey = new Map()));
  let view = byKey.get(cacheKey);
  if (!view) byKey.set(cacheKey, (view = make()));
  return view;
};

/**
 * The plan as the level at `elevation` sees it: what stands on it, and the stairs and
 * ladders of flights that start from it.
 */
export const levelPlan = (plan: Plan, elevation: number, lib: Lib): Plan => {
  const index = levelIndex(plan, lib);
  const level = roundElevation(elevation);
  const key = `level:${level}`;
  const propsKey = `${key}:${index.levels.join(',')}`;
  const on = (o: Levelled) => sameLevel(o.elevation, level);
  return memoView(plan, propsKey, () =>
    filterPlan(
      plan,
      key,
      {
        walls: on,
        floors: on,
        dimensions: on,
        props: (p) => sameLevel(index.levelOf(p.elevation, isConnector(p, lib)), level),
      },
      propsKey
    )
  );
};

/**
 * What the level at `elevation` shows faintly from below: everything on the nearest
 * lower level, and anything lower whose top reaches within `GHOST_REACH` of it (a stilt,
 * a tall wall). Dimensions are left out.
 */
export const ghostPlan = (plan: Plan, elevation: number, lib: Lib): Plan => {
  const index = levelIndex(plan, lib);
  const key = `ghost:${roundElevation(elevation)}:${index.levels.join(',')}`;
  return memoView(plan, key, () => {
    const below = levelBelow(plan, elevation, lib);
    const ghost = (level: number, top: number) =>
      below !== null &&
      level <= below + 1e-6 &&
      (sameLevel(level, below) || top >= elevation - GHOST_REACH);
    return filterPlan(plan, key, {
      walls: (w) => ghost(w.elevation, w.elevation + w.height),
      floors: (f) => ghost(f.elevation, f.elevation),
      props: (p) => {
        const span = propSpan(lib.propDefs.get(p.prefab));
        const level = index.levelOf(p.elevation, isConnector(p, lib));
        return ghost(level, p.elevation + span.bottom + span.height);
      },
      dimensions: () => false,
    });
  });
};

/** The heights of the tops of the walls on the level at `elevation`, lowest first. */
export const wallTops = (plan: Plan, elevation: number, lib: Lib): number[] => {
  const tops = Object.values(levelPlan(plan, elevation, lib).walls).map((w) =>
    roundElevation(w.elevation + w.height)
  );
  return [...new Set(tops)].sort((a, b) => a - b);
};

/** Everything on the level at `elevation` (Mod+A), its flights included. */
export const itemsAt = (plan: Plan, elevation: number, lib: Lib): SelectionItem[] =>
  allItems(levelPlan(plan, elevation, lib));

/** Everything at or above `elevation`: what a ripple move takes along. */
export const itemsFrom = (plan: Plan, elevation: number): Selection =>
  allItems(plan).filter((item) => {
    if (!ITEM_KINDS[item.kind].levelled) return false;
    const e = ITEM_KINDS[item.kind].elevation(plan, item.id);
    return e !== null && (e > elevation || sameLevel(e, elevation));
  });

/** Commands raising (or lowering) `items` by `dy` metres; openings ride on their wall. */
export const shiftElevation = (plan: Plan, items: Selection, dy: number): PlanCommand[] =>
  dy === 0 ? [] : items.flatMap((item) => ITEM_KINDS[item.kind].raise(plan, item.id, dy));
