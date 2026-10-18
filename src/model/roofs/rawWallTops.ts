/**
 * Raw pieces a roof can rest on: level boxes (not roof covers) with their top at the
 * roof's wall top, what Explode leaves of the walls under a drawn roof. Pure.
 */
import { toLocal } from '../geometry/orient';
import type { PieceBox } from '../pieceBoxes';
import { rawBox } from '../rawBoxes';
import type { RawShapeLib } from '../rawShapes';
import type { Plan, Vec2 } from '../types';

/** How far a raw piece's top may sit off the wall top and still carry the roof (metres). */
const TOP_TOLERANCE = 0.05;

/** The level boxes of `rawPieces` (a level's) whose top is at `top`. */
export const rawWallTops = (
  rawPieces: Plan['rawPieces'],
  top: number,
  lib: RawShapeLib
): PieceBox[] =>
  Object.values(rawPieces).flatMap((piece) => {
    const box = rawBox(piece, lib);
    const level = !box.tiltX && !box.rollZ && !box.shape && !box.roofCover;
    const reaches = Math.abs(box.center.y + box.size.y / 2 - top) <= TOP_TOLERANCE;
    return level && reaches ? [box] : [];
  });

/** Whether `p` lies on the box's plan footprint, grown by `margin`. */
export const onFootprint = (box: PieceBox, p: Vec2, margin: number): boolean => {
  const local = toLocal({ x: p.x, y: box.center.y, z: p.z }, box);
  return (
    Math.abs(local.x) <= box.size.x / 2 + margin && Math.abs(local.z) <= box.size.z / 2 + margin
  );
};

/** The box's centre line on the plan, along its longer side. */
export const footprintLine = (box: PieceBox): [Vec2, Vec2] => {
  const alongX = box.size.x >= box.size.z;
  const half = (alongX ? box.size.x : box.size.z) / 2;
  const c = Math.cos(box.rotationY);
  const s = Math.sin(box.rotationY);
  // The box's own x and z on the plan (three.js turn about +y).
  const dir = alongX ? { x: c, z: -s } : { x: s, z: c };
  const { x, z } = box.center;
  return [
    { x: x - dir.x * half, z: z - dir.z * half },
    { x: x + dir.x * half, z: z + dir.z * half },
  ];
};
