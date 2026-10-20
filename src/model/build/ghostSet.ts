/**
 * What the Build tool carries (M17 §3.3): one piece, or several raw pieces held
 * together, laid out about an anchor (the first piece's pivot). A pose places the anchor
 * and turns the whole set about it. Pure.
 */
import { normalizeDeg, rotate } from '../geometry/propGeometry';
import { round6 } from '../geometry/round';
import type { PieceBox } from '../pieceBoxes';
import { rawBox } from '../rawBoxes';
import type { RawShapeLib } from '../rawShapes';
import type { RawPiece, RawPieceId, Vec3 } from '../types';

import { boxSnapPoints } from './snapPoints';

export interface GhostPiece {
  prefab: string;
  /** Its pivot from the anchor's, in the set's frame (y up). */
  offset: Vec3;
  /** Degrees on top of the pose's yaw (clockwise on screen, as `RawPiece`). */
  yaw: number;
  pitch: number;
  roll: number;
}

export interface GhostSet {
  pieces: readonly GhostPiece[];
}

/** Where a set goes: its anchor's pivot (absolute height) and its turn (degrees, clockwise). */
export interface Pose {
  pivot: Vec3;
  yaw: number;
}

/** A piece of a posed set: its absolute pivot and its turn. */
export interface PlacedGhost {
  prefab: string;
  pivot: Vec3;
  rotation: RawPiece['rotation'];
}

/** A ghost snap point: which piece, which of its points (prefab order), and where. */
export interface GhostSnap {
  piece: number;
  index: number;
  point: Vec3;
}

const ORIGIN = { x: 0, y: 0, z: 0 };

/** One piece of a prefab, its pivot on the anchor. */
export const singlePiece = (prefab: string): GhostSet => ({
  pieces: [{ prefab, offset: ORIGIN, yaw: 0, pitch: 0, roll: 0 }],
});

/** A raw piece's absolute pivot. */
export const rawPivot = (piece: RawPiece): Vec3 => ({ ...piece.position });

/** The pose that puts a set made from `anchor` (`setFromRaw`) back where it was. */
export const rawPose = (anchor: RawPiece): Pose => ({
  pivot: rawPivot(anchor),
  yaw: anchor.rotation.yaw,
});

/**
 * Raw pieces as a set about the piece `anchorId` (first in the set); the others keep
 * their order. `rawPose(anchor)` puts them back where they are.
 */
export const setFromRaw = (pieces: readonly RawPiece[], anchorId: RawPieceId): GhostSet => {
  const anchor = pieces.find((p) => p.id === anchorId);
  if (!anchor) throw new Error(`setFromRaw: no piece ${anchorId}`);
  const pose = rawPose(anchor);
  const ordered = [anchor, ...pieces.filter((p) => p !== anchor)];
  return {
    pieces: ordered.map((piece) => {
      const pivot = rawPivot(piece);
      const flat = rotate({ x: pivot.x - pose.pivot.x, z: pivot.z - pose.pivot.z }, -pose.yaw);
      return {
        prefab: piece.prefab,
        offset: { x: flat.x, y: pivot.y - pose.pivot.y, z: flat.z },
        yaw: normalizeDeg(piece.rotation.yaw - pose.yaw),
        pitch: piece.rotation.pitch,
        roll: piece.rotation.roll,
      };
    }),
  };
};

/** The set's pieces at `pose`: pivots rounded to 1e-6 m and yaws normalised (as `rotateRaw`). */
export const placeSet = (set: GhostSet, pose: Pose): PlacedGhost[] =>
  set.pieces.map((piece) => {
    const flat = rotate({ x: piece.offset.x, z: piece.offset.z }, pose.yaw);
    return {
      prefab: piece.prefab,
      pivot: {
        x: round6(pose.pivot.x + flat.x),
        y: round6(pose.pivot.y + piece.offset.y),
        z: round6(pose.pivot.z + flat.z),
      },
      rotation: { yaw: normalizeDeg(pose.yaw + piece.yaw), pitch: piece.pitch, roll: piece.roll },
    };
  });

/** The set at `pose` as raw pieces (no id yet), at their absolute pivots. */
export const setPieces = (set: GhostSet, pose: Pose): Omit<RawPiece, 'id'>[] =>
  placeSet(set, pose).map(({ prefab, pivot, rotation }) => ({ prefab, position: pivot, rotation }));

/** A placed piece as a raw piece (for its box). */
const asRaw = ({ prefab, pivot, rotation }: PlacedGhost, i: number): RawPiece => ({
  id: `ghost${i}`,
  prefab,
  position: pivot,
  rotation,
});

/** The set's boxes at `pose` (keys `raw:ghost<i>`, in set order). */
export const setBoxes = (set: GhostSet, pose: Pose, lib: RawShapeLib): PieceBox[] =>
  placeSet(set, pose).map((placed, i) => rawBox(asRaw(placed, i), lib));

/** The set's snap points at `pose`: piece by piece, each in its prefab's order. */
export const setSnaps = (set: GhostSet, pose: Pose, lib: RawShapeLib): GhostSnap[] =>
  setBoxes(set, pose, lib).flatMap((box, piece) =>
    boxSnapPoints(box, lib).map((point, index) => ({ piece, index, point }))
  );
