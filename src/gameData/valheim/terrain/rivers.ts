/**
 * Rendered rivers and streams: the points along each path, binned into 64 m cells, and the
 * carving weight they give a position. Our port of `worldGen.py` (`_render`, `_add_point`,
 * `river_weight`); float32 rounding sits exactly where the Python rounds.
 */
import { f, type UnityRandom } from './unityNatives';

/** A river or stream as `Pregenerate` defines it (every field is a float32 value). */
export interface RiverDef {
  p0x: number;
  p0z: number;
  p1x: number;
  p1z: number;
  widthMax: number;
  widthMin: number;
  curveWidth: number;
  curveWavelength: number;
}

/** Which paths a render pass draws: rivers all; streams outside / inside the Deep North. */
export const RenderMode = { Rivers: 0, Streams: 1, DeepNorthStreams: 2 } as const;
export type RenderMode = (typeof RenderMode)[keyof typeof RenderMode];

const CELL = 64;
const KEY_SPAN = 4096;

/** The 64 m river cell of a world coordinate (cells are centred on zone centres). */
export const riverCell = (v: number): number => Math.floor(f((v + 32) / CELL));

/** One number per cell (cells within ±2048 of the origin, ±131 km). */
export const cellKey = (cx: number, cz: number): number =>
  (cx + KEY_SPAN / 2) * KEY_SPAN + (cz + KEY_SPAN / 2);

/** River points by cell: flat `[x, z, width, …]` lists, in render order. */
export class RiverPoints {
  readonly cells = new Map<number, number[]>();

  get size(): number {
    let n = 0;
    for (const list of this.cells.values()) n += list.length / 3;
    return n;
  }

  at(cx: number, cz: number): readonly number[] | undefined {
    return this.cells.get(cellKey(cx, cz));
  }

  /** Adds a rendered point to every cell its width reaches (`_add_point`). */
  addPoint(px: number, pz: number, w: number, keep?: ReadonlySet<number>): void {
    const gx = riverCell(px);
    const gz = riverCell(pz);
    const n = Math.ceil(f(w / CELL));
    const lim = f(w + 32);
    for (let cz = gz - n; cz <= gz + n; cz++) {
      if (!(Math.abs(f(pz - cz * CELL)) < lim)) continue;
      for (let cx = gx - n; cx <= gx + n; cx++) {
        if (!(Math.abs(f(px - cx * CELL)) < lim)) continue;
        const key = cellKey(cx, cz);
        if (keep && !keep.has(key)) continue;
        const list = this.cells.get(key);
        if (list) list.push(px, pz, w);
        else this.cells.set(key, [px, pz, w]);
      }
    }
  }
}

export interface RiverWeight {
  /** max(1 − d / width) over the points that reach here; 0 when none. */
  weight: number;
  /** The weight-averaged width of those points. */
  width: number;
}

const NO_RIVER: RiverWeight = { weight: 0, width: 0 };

export const riverWeight = (points: RiverPoints, x: number, z: number): RiverWeight => {
  const list = points.at(riverCell(x), riverCell(z));
  if (!list) return NO_RIVER;
  let weight = 0;
  let sumWidth = 0;
  let sumT = 0;
  for (let i = 0; i < list.length; i += 3) {
    const dx = f(list[i]! - x);
    const dz = f(list[i + 1]! - z);
    const w = list[i + 2]!;
    const d2 = f(dx * dx + dz * dz);
    if (!(d2 < f(w * w))) continue;
    const t = f(1 - f(Math.sqrt(d2)) / w);
    if (t > weight) weight = t;
    sumWidth += w * t;
    sumT += t;
  }
  return { weight, width: sumT > 0 ? f(sumWidth / sumT) : 0 };
};

/** Float32 distance between two points, as `_dist`. */
export const dist32 = (ax: number, az: number, bx: number, bz: number): number => {
  const dx = f(ax - bx);
  const dz = f(az - bz);
  return f(Math.sqrt(f(f(dx * dx) + f(dz * dz))));
};

/** A river or stream from two end points and its widths (`_new_river`). */
export const newRiver = (
  p0x: number,
  p0z: number,
  p1x: number,
  p1z: number,
  widthMax: number,
  widthMin: number
): RiverDef => {
  const d = dist32(p0x, p0z, p1x, p1z);
  return {
    p0x,
    p0z,
    p1x,
    p1z,
    widthMax,
    widthMin,
    curveWidth: f(d / 15),
    curveWavelength: f(d / 20),
  };
};

const MEANDER_A = 0.634119987487793;
const MEANDER_B = 0.3341200053691864;

/**
 * Renders paths into `points` (`_render`): a point every `widthMin / 8` m along the meander,
 * each taking one random width. With `keep`, only those cells are stored, but the random
 * sequence is consumed as for a full render.
 */
export const renderRivers = (
  rnd: UnityRandom,
  defs: readonly RiverDef[],
  mode: RenderMode,
  isDeepNorth: (x: number, z: number) => boolean,
  points: RiverPoints,
  keep?: ReadonlySet<number>
): void => {
  for (const r of defs) {
    if (mode !== RenderMode.Rivers) {
      const deep = isDeepNorth(r.p0x, r.p0z);
      if (deep === (mode === RenderMode.Streams)) continue;
    }
    const step = f(r.widthMin / 8);
    let dx = f(r.p1x - r.p0x);
    let dz = f(r.p1z - r.p0z);
    const mag = f(Math.sqrt(f(f(dx * dx) + f(dz * dz))));
    dx = f(dx / mag);
    dz = f(dz / mag);
    const nx = -dz;
    const nz = dx;
    const dist = dist32(r.p0x, r.p0z, r.p1x, r.p1z);
    for (let t = 0; t <= dist; t = f(t + step)) {
      const s = f(t / r.curveWavelength);
      const off = f(Math.sin(s) * Math.sin(s * MEANDER_A) * Math.sin(s * MEANDER_B) * r.curveWidth);
      const w = rnd.rangeFloat(r.widthMin, r.widthMax);
      const px = f(f(r.p0x + f(dx * t)) + f(nx * off));
      const pz = f(f(r.p0z + f(dz * t)) + f(nz * off));
      points.addPoint(px, pz, w, keep);
    }
  }
};
