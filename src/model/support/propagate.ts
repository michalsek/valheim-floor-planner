/**
 * Structural support, after the game's `WearNTear.UpdateSupport` (research/README.md
 * §4, §8). A body on the ground gets its material's maximum. Any other takes the best of:
 *
 * - each neighbour's support `s` less its loss over the distance between their centres
 *   of mass (+0.1 m per joint): `s · (1 − loss · (d + 0.1))`, where the loss is the
 *   body's horizontal loss, or, for a support point below its centre, a blend towards
 *   the vertical loss by how steeply the point lies below (straight down: all vertical);
 * - for two support points below it more than 100° apart on the plan (a floor between
 *   two walls), the mean of their values with vertical loss only.
 *
 * The result is capped at the body's own maximum (wood on stone still caps at 100). A
 * body at or below its minimum breaks, so it holds nothing up: it publishes 0.
 *
 * Solved with a max-first worklist from the grounded bodies; values only ever rise, so
 * it settles on the least fixed point, and a loop floating in the air stays at 0.
 */
import type { MaterialSupport } from '../../catalog/pieceDefs';
import type { Vec3 } from '../types';

import type { Contact } from './contacts';

/**
 * How far above the ground a body's bottom may be and still rest on it: the game grows
 * each collider's box by 0.15 m a side and any overlap with the terrain grounds the
 * piece (`WearNTear.SetupColliders`, research §8).
 */
export const GROUND_REACH = 0.15;
/** Added to every centre-to-centre distance: the game's per-joint penalty. */
const JOINT = 0.1;
/** Support points within this of the centre's height (or lower) count as below. */
const BELOW_TOLERANCE = 0.05;
/** Two supports below at least this far apart on the plan hold a body between them. */
const PAIR_ANGLE = (100 * Math.PI) / 180;
const PAIR_COS = Math.cos(PAIR_ANGLE);
/** A rise smaller than this isn't passed on. */
const RELAX = 1e-3;
/** Pops per body before the solver gives up (it never should). */
const MAX_POPS_PER_BODY = 50;

export interface SupportBody {
  /** Centre of mass. */
  com: Vec3;
  /** The height of its lowest point. */
  bottom: number;
  /**
   * The highest ground under its footprint (0 on flat ground). At or below
   * `ground + GROUND_REACH` it rests on the ground; a buried body does too.
   */
  ground?: number;
  /** Null: it takes no part (no material in the game data). */
  material: MaterialSupport | null;
  /** Whether other bodies can rest on it: walls, floors, poles, stairs; not doors or furniture. */
  gives: boolean;
  /**
   * Held up whatever is under it, and not checked: it gives its material's maximum, like
   * a grounded body. Its state only says whether it touches the ground ('grounded') or
   * not ('none'). Plans no longer use it (raw pieces are checked since M17).
   */
  fixed?: boolean;
}

/** Whether a body's bottom reaches the ground under it. */
export const onGround = (body: Pick<SupportBody, 'bottom' | 'ground'>): boolean =>
  body.bottom <= (body.ground ?? 0) + GROUND_REACH;

export type SupportState = 'grounded' | 'supported' | 'collapsing' | 'none';

export interface SupportResult {
  /** Each body's support (what a collapsing one would have, before it breaks). */
  value: Float32Array;
  state: SupportState[];
}

/**
 * What a neighbour passes on, fixed by geometry: its support times `single`, and (when
 * it is below) times `pair` towards a pair with another one below, `dir` apart.
 */
interface Neighbour {
  on: number;
  single: number;
  /** Below the body's centre: the factor with vertical loss only, and its plan direction. */
  below: { pair: number; dir: Vec3 } | null;
}

/** A body's neighbours, and which two of them below it can hold it up between them. */
interface Supports {
  neighbours: Neighbour[];
  /** Indices into `neighbours`, for pairs more than `PAIR_ANGLE` apart on the plan. */
  pairs: [number, number][];
}

const pairsOf = (neighbours: readonly Neighbour[]): [number, number][] => {
  const pairs: [number, number][] = [];
  neighbours.forEach((a, i) => {
    for (let j = i + 1; j < neighbours.length; j++) {
      const b = neighbours[j]!;
      if (!a.below || !b.below) continue;
      if (farApart(a.below.dir, b.below.dir)) pairs.push([i, j]);
    }
  });
  return pairs;
};

/** A max-heap of body indices by value. */
const createHeap = () => {
  const items: { value: number; index: number }[] = [];
  const swap = (i: number, j: number) => {
    [items[i], items[j]] = [items[j]!, items[i]!];
  };
  const push = (value: number, index: number) => {
    items.push({ value, index });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent]!.value >= items[i]!.value) break;
      swap(i, parent);
      i = parent;
    }
  };
  const pop = () => {
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l]!.value > items[m]!.value) m = l;
        if (r < items.length && items[r]!.value > items[m]!.value) m = r;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    return top;
  };
  return { push, pop };
};

const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Whether two directions are at least `PAIR_ANGLE` apart on the plan (never when either is vertical). */
const farApart = (a: Vec3, b: Vec3): boolean => {
  const la = Math.hypot(a.x, a.z);
  const lb = Math.hypot(b.x, b.z);
  return la > 1e-9 && lb > 1e-9 && (a.x * b.x + a.z * b.z) / (la * lb) <= PAIR_COS;
};

/** How much of a neighbour's support reaches `body` through the point `point` of it. */
const neighbourOf = (
  body: SupportBody,
  material: MaterialSupport,
  giver: SupportBody,
  on: number,
  point: Vec3
): Neighbour => {
  const { horizontalLoss: h, verticalLoss: v } = material;
  const reach = distance(body.com, giver.com) + JOINT;
  const dir = { x: point.x - body.com.x, y: point.y - body.com.y, z: point.z - body.com.z };
  const length = Math.hypot(dir.x, dir.y, dir.z);
  // A centre inside the neighbour (no direction) rests on it straight down.
  const steep = length < 1e-9 ? 1 : -dir.y / length;
  if (point.y >= body.com.y + BELOW_TOLERANCE || steep <= 0) {
    return { on, single: 1 - h * reach, below: null };
  }
  const t = Math.acos(1 - steep) / (Math.PI / 2);
  const loss = h + (v - h) * t;
  return { on, single: 1 - loss * reach, below: { pair: 1 - v * reach, dir } };
};

/** A body's support from its neighbours' published values. */
const supportFrom = (
  material: MaterialSupport,
  { neighbours, pairs }: Supports,
  published: Float64Array
): number => {
  let best = 0;
  for (const { on, single } of neighbours) {
    const s = published[on]!;
    if (s > 0) best = Math.max(best, s * single);
  }
  for (const [i, j] of pairs) {
    const a = neighbours[i]!;
    const b = neighbours[j]!;
    const s = published[a.on]!;
    const t = published[b.on]!;
    if (s > 0 && t > 0) best = Math.max(best, (s * a.below!.pair + t * b.below!.pair) / 2);
  }
  return Math.min(material.maxSupport, best);
};

/** A body's state from its support, as `propagateSupport` gives it (not for fixed bodies). */
const stateOf = (material: MaterialSupport, value: number, grounded: boolean): SupportState => {
  if (grounded) return 'grounded';
  return value > material.minSupport ? 'supported' : 'collapsing';
};

/** A neighbour a body may rest on, with what it publishes (0 when it breaks). */
export interface Giver {
  body: SupportBody;
  published: number;
  /** The point of its shape closest to the body's centre of mass. */
  point: Vec3;
}

/**
 * One body's support from its neighbours' published values: one relaxation step of
 * `propagateSupport`, by the same rule. A body on the ground gets its maximum.
 */
export const supportOfBody = (
  body: SupportBody,
  givers: readonly Giver[]
): { value: number; state: SupportState } => {
  const { material } = body;
  if (!material) return { value: 0, state: 'none' };
  if (onGround(body)) return { value: material.maxSupport, state: 'grounded' };
  const usable = givers.filter((g) => g.body.gives && g.body.material);
  const neighbours = usable.map((g, i) => neighbourOf(body, material, g.body, i, g.point));
  const published = Float64Array.from(usable, (g) => g.published);
  const value = supportFrom(material, { neighbours, pairs: pairsOf(neighbours) }, published);
  return { value, state: stateOf(material, value, false) };
};

export const propagateSupport = (
  bodies: readonly SupportBody[],
  contacts: readonly Contact[]
): SupportResult => {
  const n = bodies.length;
  const neighbours: Neighbour[][] = bodies.map(() => []);
  const dependents: number[][] = bodies.map(() => []);
  for (const { body, on, point } of contacts) {
    const giver = bodies[on]!;
    const material = bodies[body]!.material;
    if (!giver.gives || !giver.material || !material) continue;
    neighbours[body]!.push(neighbourOf(bodies[body]!, material, giver, on, point));
    dependents[on]!.push(body);
  }
  const supports: Supports[] = neighbours.map((list) => ({
    neighbours: list,
    pairs: pairsOf(list),
  }));

  const grounded = bodies.map((b) => b.material !== null && (b.fixed === true || onGround(b)));
  const value = new Float64Array(n);
  const published = new Float64Array(n);
  const heap = createHeap();
  bodies.forEach((body, i) => {
    if (!grounded[i] || !body.material) return;
    value[i] = published[i] = body.material.maxSupport;
    heap.push(published[i], i);
  });

  for (let pops = 0; pops < MAX_POPS_PER_BODY * n; pops++) {
    const top = heap.pop();
    if (!top) break;
    if (top.value !== published[top.index]) continue;
    for (const b of dependents[top.index]!) {
      const material = bodies[b]!.material;
      if (grounded[b] || !material) continue;
      const next = supportFrom(material, supports[b]!, published);
      if (next <= value[b]! + RELAX) continue;
      value[b] = next;
      const holds = next > material.minSupport ? next : 0;
      if (holds > published[b]!) {
        published[b] = holds;
        heap.push(holds, b);
      }
    }
  }

  const state = bodies.map((body, i): SupportState => {
    if (!body.material) return 'none';
    if (body.fixed) return onGround(body) ? 'grounded' : 'none';
    return stateOf(body.material, value[i]!, grounded[i]!);
  });
  return { value: Float32Array.from(value), state };
};
