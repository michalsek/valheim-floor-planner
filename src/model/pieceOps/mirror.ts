/**
 * Mirror X / Mirror Z for raw pieces, about the middle of the selection's snap points
 * (so pieces on the build lattice stay on it). A game piece can't
 * be mirrored, so each is placed as its mirror image as far as its symmetry allows: its
 * centre is reflected, and it is turned so the local axis across which it is symmetric
 * keeps its line (walls, beams and floors keep x; stairs, symmetric only across x, keep
 * z, so they climb the mirrored way). Pure.
 */
import type { PieceDef } from '../../catalog/pieceDefs';
import type { PlanCommand } from '../commands';
import { fromLocal } from '../geometry/orient';
import { normalizeDeg } from '../geometry/propGeometry';
import { boxSnapPoints } from '../build/snapPoints';
import { round6 } from '../geometry/round';
import { boxesBounds, type PieceBox } from '../pieceBoxes';
import { rawBox, rawTurn } from '../rawBoxes';
import { rawDef, rawRect, rawSpan } from '../rawPieces';
import type { RawShapeLib } from '../rawShapes';
import type { SelectionItem } from '../selection';
import type { Plan, RawPiece, Vec3 } from '../types';

/** The plan axis whose coordinates flip: 'x' mirrors left and right, 'z' up and down. */
export type MirrorAxis = 'x' | 'z';

/** How far a snap point may miss its mirror image and still count as symmetric (metres). */
const SYMMETRY_TOLERANCE = 0.01;

const middle = (values: readonly number[]) => (Math.min(...values) + Math.max(...values)) / 2;

/**
 * The point of the prefab's frame a mirror reflects: the middle of its snap points
 * (they lie on the build lattice; a collider may sit a centimetre off it), else of its
 * collider.
 */
export const mirrorCentre = (def: PieceDef | undefined): Vec3 => {
  const snaps = def?.snapPoints ?? [];
  if (snaps.length > 0) {
    return {
      x: middle(snaps.map((p) => p[0])),
      y: middle(snaps.map((p) => p[1])),
      z: middle(snaps.map((p) => p[2])),
    };
  }
  const rect = rawRect(def);
  const span = rawSpan(def);
  return {
    x: (rect.minX + rect.maxX) / 2,
    y: (span.minY + span.maxY) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
  };
};

/** Whether the prefab's snap points map onto themselves when its local `axis` flips about the centre. */
export const symmetricAcross = (def: PieceDef | undefined, axis: 'x' | 'z'): boolean => {
  const snaps = def?.snapPoints ?? [];
  const i = axis === 'x' ? 0 : 2;
  const c = mirrorCentre(def)[axis];
  return snaps.every((p) =>
    snaps.some(
      (q) =>
        Math.hypot(
          q[0] - (i === 0 ? 2 * c - p[0] : p[0]),
          q[1] - p[1],
          q[2] - (i === 2 ? 2 * c - p[2] : p[2])
        ) <= SYMMETRY_TOLERANCE
    )
  );
};

/**
 * The piece's turn once mirrored (see the header): with the reflection M and its turn R,
 * M·R·F, F a flip of the local axis it is symmetric across, as game Euler angles.
 */
const mirroredRotation = (
  { yaw, pitch, roll }: RawPiece['rotation'],
  axis: MirrorAxis,
  keepX: boolean
): RawPiece['rotation'] => {
  // Keeping x flips local z: a half turn more when x flips, none when z does.
  const halfTurn = keepX === (axis === 'x');
  return {
    yaw: normalizeDeg((halfTurn ? 180 : 0) - yaw),
    pitch: keepX ? -pitch + 0 : pitch,
    roll: keepX ? roll : -roll + 0,
  };
};

/** A point of the piece's frame (about its pivot) in the world. */
const placed = (rotation: RawPiece['rotation'], pivot: Vec3, local: Vec3): Vec3 =>
  fromLocal(local, { center: pivot, size: local, ...rawTurn(rotation) });

/**
 * The mirror line along `axis`: the middle of the boxes' snap points (on the build
 * lattice, so a reflection maps it onto itself), or of the boxes without any.
 */
const mirrorLine = (boxes: readonly PieceBox[], axis: MirrorAxis, lib: RawShapeLib): number => {
  const snaps = boxes.flatMap((box) => boxSnapPoints(box, lib)).map((p) => p[axis]);
  if (snaps.length > 0) return middle(snaps);
  const bounds = boxesBounds(boxes)!;
  return (bounds.min[axis] + bounds.max[axis]) / 2;
};

/**
 * Commands mirroring the selected raw pieces across the selection's centre line
 * (others are ignored); `inexact` counts pieces symmetric across neither local axis,
 * which keep x and can't be mirrored exactly.
 */
export const mirrorCommands = (
  plan: Plan,
  items: readonly SelectionItem[],
  axis: MirrorAxis,
  lib: RawShapeLib
): { cmds: PlanCommand[]; inexact: number } => {
  const pieces = items.flatMap((item) => {
    const piece = item.kind === 'raw' ? plan.rawPieces[item.id] : undefined;
    return piece ? [piece] : [];
  });
  if (pieces.length === 0) return { cmds: [], inexact: 0 };
  const line = mirrorLine(
    pieces.map((piece) => rawBox(piece, lib)),
    axis,
    lib
  );
  let inexact = 0;
  const cmds = pieces.map((piece): PlanCommand => {
    const def = rawDef(lib, piece);
    const keepX = symmetricAcross(def, 'z') || !symmetricAcross(def, 'x');
    if (keepX && !symmetricAcross(def, 'z')) inexact++;
    const local = mirrorCentre(def);
    const pivot = { ...piece.position, y: piece.position.y + piece.elevation };
    const centre = placed(piece.rotation, pivot, local);
    const reflected = { ...centre, [axis]: 2 * line - centre[axis] };
    const rotation = mirroredRotation(piece.rotation, axis, keepX);
    const offset = placed(rotation, { x: 0, y: 0, z: 0 }, local);
    const position = {
      x: round6(reflected.x - offset.x),
      y: round6(reflected.y - offset.y - piece.elevation),
      z: round6(reflected.z - offset.z),
    };
    return { type: 'raw.patch', id: piece.id, changes: { position, rotation } };
  });
  return { cmds, inexact };
};
