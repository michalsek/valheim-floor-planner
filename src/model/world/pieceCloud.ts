/**
 * A world's built pieces as the world reader hands them over (flat arrays, one entry per
 * piece), and the rotation rules for reading them. Pure.
 */

export interface PieceCloud {
  /** Prefab names, indexed by `prefabIndex`. */
  prefabs: readonly string[];
  prefabIndex: ArrayLike<number>;
  /** x, y, z per piece: the prefab's pivot in the world (metres, raw Unity axes). */
  position: ArrayLike<number>;
  /** Pitch, yaw, roll per piece, as saved (Euler degrees). */
  rotation: ArrayLike<number>;
}

/** The Hammer's rotation step (degrees). */
export const ROTATION_STEP = 22.5;

/** How far below a step a saved angle may be: the save truncates to 0.5°. */
const TRUNCATION = 0.5;

const wrap = (deg: number): number => (((deg % 360) + 360) % 360) + 0;

/**
 * A saved angle as the player placed it. The save truncates to 0.5° steps after a float
 * round trip, so 22.5° (as 22.49998°) often comes back as 22.0°: the true angle is in
 * `[stored, stored + 0.5)`, and a Hammer step at most 0.5° above the saved value is taken
 * (research §7, "real").
 * Angles with no step in reach (modded placements) are kept as saved.
 */
export const snapAngle = (stored: number): number => {
  const step = Math.round((stored + TRUNCATION / 2) / ROTATION_STEP) * ROTATION_STEP;
  return wrap(step >= stored - 0.01 && step <= stored + TRUNCATION + 1e-6 ? step : stored);
};

export interface CloudPiece {
  prefab: string;
  /** The pivot in the world. */
  x: number;
  y: number;
  z: number;
  /** Snapped Euler degrees (`snapAngle`), in [0, 360). */
  pitch: number;
  yaw: number;
  roll: number;
}

export const cloudSize = (cloud: Pick<PieceCloud, 'prefabIndex'>): number =>
  cloud.prefabIndex.length;

/** Piece `i`, with its angles snapped. */
export const cloudPiece = (cloud: PieceCloud, i: number): CloudPiece => {
  const at = (values: ArrayLike<number>, k: number) => values[i * 3 + k]!;
  return {
    prefab: cloud.prefabs[cloud.prefabIndex[i]!]!,
    x: at(cloud.position, 0),
    y: at(cloud.position, 1),
    z: at(cloud.position, 2),
    pitch: snapAngle(at(cloud.rotation, 0)),
    yaw: snapAngle(at(cloud.rotation, 1)),
    roll: snapAngle(at(cloud.rotation, 2)),
  };
};

/**
 * The yaw most pieces share modulo 90° (a build's grid direction), in [0, 90); ties go
 * to the smaller angle. 0 for no pieces.
 */
export const dominantYaw = (yaws: Iterable<number>): number => {
  const counts = new Map<number, number>();
  for (const yaw of yaws) {
    const key = wrap(Math.round(yaw * 2) / 2) % 90;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && key < best)) [best, bestCount] = [key, count];
  }
  return best;
};
