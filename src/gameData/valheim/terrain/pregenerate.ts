/**
 * `WorldGenerator.Pregenerate`: lakes, rivers between them and streams, rendered into the
 * generator's river points. Our port of `worldGen.py`, as the game's sequential loops (the
 * Python batches only emulate them): one float32 slip in the stream pass would reshuffle
 * every later stream (docs/plans/M16.md §6, §8.6).
 *
 * The result keeps the **definitions** plus the random state at the start of each render
 * pass, so `restoreRivers` can re-render them (or only the cells a patch needs) later.
 */
import { C005, C04 } from './biomeHeights';
import { type PatchRect, zoneOf } from './heightmap';
import { length } from './mathHelpers';
import {
  cellKey,
  dist32,
  newRiver,
  RenderMode,
  renderRivers,
  type RiverDef,
  RiverPoints,
} from './rivers';
import { f, type RandomState, UnityRandom } from './unityNatives';
import type { WorldGenerator } from './worldGenerator';

export interface Lake {
  x: number;
  z: number;
}

export interface Pregenerated {
  lakes: Lake[];
  rivers: RiverDef[];
  streams: RiverDef[];
  /** The Deep North stream pass, or null when it was skipped. */
  deepStreams: RiverDef[] | null;
  /** The random state at the start of each render pass. */
  states: { rivers: RandomState; streams: RandomState; deepStreams: RandomState | null };
}

const LAKE_GRID = 128;
const LAKE_MERGE = 800;
const RIVER_STEP = 128;
const STREAM_ATTEMPTS = 3000;
const STREAM_TRIES = 100;
const TWO_PI = f(6.2831854820251465);
const C12 = f(1.2);
const C05 = f(0.5);

/** Every 128 m grid point within 10 km below 0.05, merged (`find_lakes`). */
export const findLakes = (gen: WorldGenerator): Lake[] => {
  const pts: Lake[] = [];
  for (let z = -10000; z <= 10000; z += LAKE_GRID) {
    for (let x = -10000; x <= 10000; x += LAKE_GRID) {
      if (length(x, z) <= 10000 && gen.baseHeight(x, z) < C005) pts.push({ x, z });
    }
  }
  return mergePoints(pts, LAKE_MERGE);
};

/**
 * Greedy merge: take the head, average it with the first nearest other point within `rad`
 * (swap-removing that one) until none is left in range.
 */
export const mergePoints = (input: readonly Lake[], rad: number): Lake[] => {
  const pts = [...input];
  const out: Lake[] = [];
  while (pts.length > 0) {
    let p = pts.shift()!;
    for (;;) {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]!;
        if (q.x === p.x && q.z === p.z) continue;
        const dx = f(q.x - p.x);
        const dz = f(q.z - p.z);
        const d = f(Math.sqrt(f(dx * dx + dz * dz)));
        if (d < rad && d < bestD) {
          best = i;
          bestD = d;
        }
      }
      if (best < 0) break;
      const q = pts[best]!;
      p = { x: f(f(p.x + q.x) * C05), z: f(f(p.z + q.z) * C05) };
      pts[best] = pts[pts.length - 1]!;
      pts.pop();
    }
    out.push(p);
  }
  return out;
};

/** Whether a straight river stays at or below `limit` and isn't all water. */
export const riverAllowed = (
  gen: WorldGenerator,
  p0: Lake,
  p1: Lake,
  step: number,
  limit: number
): boolean => {
  const dist = dist32(p0.x, p0.z, p1.x, p1.z);
  let dx = f(p1.x - p0.x);
  let dz = f(p1.z - p0.z);
  const mag = f(Math.sqrt(f(f(dx * dx) + f(dz * dz))));
  dx = f(dx / mag);
  dz = f(dz / mag);
  const end = f(dist - step);
  let land = false;
  for (let t = f(step); t <= end; t = f(t + f(step))) {
    const h = gen.baseHeight(f(p0.x + f(dx * t)), f(p0.z + f(dz * t)));
    if (h > limit) return false;
    if (h > C005) land = true;
  }
  return land;
};

const same = (a: Lake, x: number, z: number) => a.x === x && a.z === z;

const hasRiver = (rivers: readonly RiverDef[], p: Lake, q?: Lake): boolean =>
  rivers.some((r) =>
    q === undefined
      ? same(p, r.p0x, r.p0z) || same(p, r.p1x, r.p1z)
      : (same(p, r.p0x, r.p0z) && same(q, r.p1x, r.p1z)) ||
        (same(q, r.p0x, r.p0z) && same(p, r.p1x, r.p1z))
  );

const randomRiverEnd = (
  gen: WorldGenerator,
  rnd: UnityRandom,
  rivers: readonly RiverDef[],
  lakes: readonly Lake[],
  p: Lake,
  maxDist: number
): number => {
  const candidates: number[] = [];
  lakes.forEach((q, i) => {
    if (same(q, p.x, p.z) || !(dist32(p.x, p.z, q.x, q.z) < maxDist)) return;
    if (hasRiver(rivers, p, q)) return;
    if (riverAllowed(gen, p, q, RIVER_STEP, C04)) candidates.push(i);
  });
  if (candidates.length === 0) return -1;
  return candidates[rnd.rangeInt(0, candidates.length)]!;
};

/** Rivers between lakes (`place_rivers`, before rendering). */
export const placeRivers = (gen: WorldGenerator, rnd: UnityRandom, lakes: readonly Lake[]) => {
  rnd.initState(gen.riverSeed);
  const rivers: RiverDef[] = [];
  const open = [...lakes];
  while (open.length > 1) {
    const p = open[0]!;
    let i = randomRiverEnd(gen, rnd, rivers, lakes, p, 2000);
    if (i === -1 && !hasRiver(rivers, p)) i = randomRiverEnd(gen, rnd, rivers, lakes, p, 5000);
    if (i === -1) {
      open.shift();
      continue;
    }
    const widthMax = rnd.rangeFloat(60, 100);
    const widthMin = rnd.rangeFloat(60, widthMax);
    const q = lakes[i]!;
    rivers.push(newRiver(p.x, p.z, q.x, q.z, widthMax, widthMin));
  }
  return rivers;
};

/** Up to 100 random tries; the first point whose height is strictly inside (lo, hi). */
const firstPoint = (
  tries: (k: number) => [number, number],
  height: (x: number, z: number) => number,
  lo: number,
  hi: number
): [number, number] | null => {
  for (let k = 0; k < STREAM_TRIES; k++) {
    const [x, z] = tries(k);
    const h = height(x, z);
    if (h > lo && h < hi) return [x, z];
  }
  return null;
};

/** 3000 stream attempts (`place_streams`, before rendering). */
export const placeStreams = (gen: WorldGenerator, rnd: UnityRandom, deep: boolean) => {
  rnd.initState(gen.streamSeed);
  const flag = !deep;
  const height = (x: number, z: number) => gen.pregenHeight(x, z, flag);
  const streams: RiverDef[] = [];
  for (let attempt = 0; attempt < STREAM_ATTEMPTS; attempt++) {
    const start = firstPoint(
      () => [rnd.rangeFloat(-10000, 10000), rnd.rangeFloat(-10000, 10000)],
      height,
      26,
      31
    );
    if (!start) continue;
    const [sx, sz] = start;
    let radius = f(200);
    const end = firstPoint(
      () => {
        radius = f(radius - C12);
        const a = rnd.rangeFloat(0, TWO_PI);
        return [f(sx + f(Math.sin(a)) * radius), f(sz + f(Math.cos(a)) * radius)];
      },
      height,
      36,
      44
    );
    if (!end) continue;
    const [ex, ez] = end;
    const mh = height(f(f(sx + ex) * C05), f(f(sz + ez) * C05));
    if (mh < 26 || mh > 44) continue;
    streams.push(newRiver(sx, sz, ex, ez, 20, 20));
  }
  return streams;
};

const isDeepNorth = (gen: WorldGenerator) => (x: number, z: number) => gen.isDeepNorth(x, z);

/** The Deep North stream pass on top of rendered rivers and streams; renders it too. */
const deepNorthPass = (gen: WorldGenerator, rnd: UnityRandom) => {
  const deepStreams = placeStreams(gen, rnd, true);
  const state = rnd.state;
  renderRivers(rnd, deepStreams, RenderMode.DeepNorthStreams, isDeepNorth(gen), gen.rivers);
  return { deepStreams, state };
};

/**
 * Pregenerates the world's rivers into `gen.rivers` (replacing them). The Deep North stream
 * pass (another ~3000 attempts) runs only with `deepNorth`.
 */
export const pregenerate = (gen: WorldGenerator, opts: { deepNorth: boolean }): Pregenerated => {
  gen.rivers = new RiverPoints();
  const rnd = new UnityRandom(0);
  const lakes = findLakes(gen);
  const rivers = placeRivers(gen, rnd, lakes);
  const riverState = rnd.state;
  renderRivers(rnd, rivers, RenderMode.Rivers, isDeepNorth(gen), gen.rivers);
  const streams = placeStreams(gen, rnd, false);
  const streamState = rnd.state;
  renderRivers(rnd, streams, RenderMode.Streams, isDeepNorth(gen), gen.rivers);
  const deep = opts.deepNorth ? deepNorthPass(gen, rnd) : null;
  return {
    lakes,
    rivers,
    streams,
    deepStreams: deep?.deepStreams ?? null,
    states: { rivers: riverState, streams: streamState, deepStreams: deep?.state ?? null },
  };
};

/**
 * Re-renders pregenerated rivers into `gen.rivers` (replacing them). With `cells` (keys from
 * `cellKey`), only those cells are kept; each holds exactly what a full render puts there.
 */
export const restoreRivers = (
  gen: WorldGenerator,
  pre: Pregenerated,
  cells?: ReadonlySet<number>
): void => {
  gen.rivers = new RiverPoints();
  const rnd = new UnityRandom(0);
  const pass = (defs: readonly RiverDef[], mode: RenderMode, state: RandomState) => {
    rnd.state = state;
    renderRivers(rnd, defs, mode, isDeepNorth(gen), gen.rivers, cells);
  };
  pass(pre.rivers, RenderMode.Rivers, pre.states.rivers);
  pass(pre.streams, RenderMode.Streams, pre.states.streams);
  if (pre.deepStreams && pre.states.deepStreams) {
    pass(pre.deepStreams, RenderMode.DeepNorthStreams, pre.states.deepStreams);
  }
};

/** The river cells a patch's vertices read (a vertex's cell is its zone). */
export const patchRiverCells = (rect: PatchRect): Set<number> => {
  const cells = new Set<number>();
  for (let cz = zoneOf(rect.z0); cz <= zoneOf(rect.z0 + rect.rows - 1); cz++) {
    for (let cx = zoneOf(rect.x0); cx <= zoneOf(rect.x0 + rect.cols - 1); cx++) {
      cells.add(cellKey(cx, cz));
    }
  }
  return cells;
};

/** Adds the skipped Deep North pass to a cached pregeneration (a full re-render first). */
export const withDeepNorth = (gen: WorldGenerator, pre: Pregenerated): Pregenerated => {
  if (pre.deepStreams) return pre;
  restoreRivers(gen, pre);
  const { deepStreams, state } = deepNorthPass(gen, new UnityRandom(0));
  return { ...pre, deepStreams, states: { ...pre.states, deepStreams: state } };
};
