/**
 * Raw pieces as 3D boxes and 2D outlines, about their pivot as the game places them.
 * Turned by yaw, tilted by pitch and rolled by roll (the game's Euler angles, mirrored
 * into planner space: three.js 'YXZ' of (−pitch, −yaw, roll); yaw is stored clockwise,
 * so `rotationY` is −yaw). Roof pieces take their roof shape, diagonal beams a beam,
 * anything else its collider box; doors and gates their thin panel. Floor tiles' boxes
 * are lifted 1 mm; their pivot (the model, snap points) stays. Pure.
 */
import { DOOR_PREFABS, FLOOR_TILE_PREFABS } from '../catalog/pieceClasses';

import { convexHull, polygonArea } from './geometry/convex';
import { normalizeDeg, rotate } from './geometry/propGeometry';
import { round6 } from './geometry/round';
import { boxCorners, fromLocal, type OrientedBox } from './geometry/orient';
import type { PieceBox } from './pieceBoxes';
import { pieceAnchor } from './piecePivot';
import { rawDef, rawRect, rawSpan } from './rawPieces';
import { rawBeam, rawRoofDef, type RawShapeLib } from './rawShapes';
import { roofBody } from './roofBoxes';
import type { RawPiece, Vec2, Vec3 } from './types';

const DEG = Math.PI / 180;

/**
 * How far floor tiles' boxes are lifted (metres): 1 mm, so a floor level with the wall
 * top under it doesn't flicker against it (M11 finding 13).
 */
export const FLOOR_LIFT = 0.001;

/** Door and gate panels are drawn this thin at most, so the gap still reads as one. */
export const PANEL_THICKNESS = 0.12;

const pivotOf = (piece: RawPiece): Vec3 => ({ ...piece.position });

/**
 * A raw piece's turn (game Euler degrees, yaw clockwise) as the planner's frame: three.js
 * 'YXZ' radians of (−pitch, −yaw, roll), as `OrientedBox` and `modelTurn` take it.
 */
export const rawTurn = ({ yaw, pitch, roll }: RawPiece['rotation']) => ({
  rotationY: -yaw * DEG,
  tiltX: -pitch * DEG,
  rollZ: roll * DEG,
});

/** The raw rotation of a model turn (`PieceBox.modelTurn`: x tilt, y turn, z roll). */
export const rotationOfTurn = (turn: Vec3): RawPiece['rotation'] => ({
  yaw: normalizeDeg(-turn.y / DEG),
  pitch: round6(-turn.x / DEG),
  roll: round6(turn.z / DEG),
});

const frameOf = (piece: RawPiece) => rawTurn(piece.rotation);

/** A point of the prefab's frame in the world. */
const placed = (piece: RawPiece, local: Vec3): Vec3 =>
  fromLocal(local, { center: pivotOf(piece), size: local, ...frameOf(piece) });

const untilted = (piece: RawPiece) => piece.rotation.pitch === 0 && piece.rotation.roll === 0;

/** The box without its owner's fields (key, item, hit, colours). */
type Body = Pick<PieceBox, 'center' | 'size' | 'rotationY' | 'tiltX' | 'rollZ' | 'shape' | 'pivot'>;

const bodyOf = (piece: RawPiece, lib: RawShapeLib): Body => {
  const def = rawDef(lib, piece);
  const frame = frameOf(piece);
  const roof = untilted(piece) ? rawRoofDef(lib, piece.prefab) : undefined;
  if (roof && def) {
    const center = placed(piece, pieceAnchor(def, roof.size));
    const { shape, size, slope } = roof;
    return roofBody(
      { prefab: piece.prefab, shape, center, size, yaw: frame.rotationY, slope },
      lib
    );
  }
  const beam = rawBeam(def);
  if (beam) {
    return {
      center: placed(piece, beam.mid),
      size: { x: beam.length, y: beam.thickness, z: beam.thickness },
      ...frame,
      rollZ: frame.rollZ + beam.angle,
      pivot: pivotOf(piece),
    };
  }
  const rect = rawRect(def);
  const span = rawSpan(def);
  const local = {
    x: (rect.minX + rect.maxX) / 2,
    y: (span.minY + span.maxY) / 2,
    z: (rect.minZ + rect.maxZ) / 2,
  };
  // A door or gate is its panel, so the gap it closes still reads as one.
  const depth = rect.maxZ - rect.minZ;
  return {
    center: placed(piece, local),
    size: {
      x: rect.maxX - rect.minX,
      y: span.maxY - span.minY,
      z: DOOR_PREFABS.has(piece.prefab) ? Math.min(PANEL_THICKNESS, depth) : depth,
    },
    ...frame,
    pivot: pivotOf(piece),
  };
};

const withoutZeros = (body: Body): Body => {
  const { tiltX, rollZ, ...rest } = body;
  return { ...rest, ...(tiltX ? { tiltX } : {}), ...(rollZ ? { rollZ } : {}) };
};

const outlines = new WeakMap<RawPiece, { lib: RawShapeLib; outline: Vec2[] }>();

/** The piece's top-down outline: the hull of its box's corners (cached per piece). */
export const rawOutline = (piece: RawPiece, lib: RawShapeLib): Vec2[] => {
  const cached = outlines.get(piece);
  if (cached?.lib === lib) return cached.outline;
  const box: OrientedBox = bodyOf(piece, lib);
  const outline = convexHull(boxCorners(box).map((c) => ({ x: c.x, z: c.z })));
  outlines.set(piece, { lib, outline });
  return outline;
};

export const rawOutlineArea = (piece: RawPiece, lib: RawShapeLib): number =>
  polygonArea(rawOutline(piece, lib));

/** Whether the piece is drawn as a roof shape (and outlined, not filled, in 2D). */
export const isRawRoof = (piece: RawPiece, lib: RawShapeLib): boolean =>
  untilted(piece) && rawRoofDef(lib, piece.prefab) !== undefined;

/**
 * Whether the piece covers a roof (a roof family's straight, ridge or corner piece, at
 * any tilt): hidden with the Roofs toggle. Gable walls, the Roof Cross among them, stay.
 */
export const isRawRoofCover = (piece: RawPiece, lib: RawShapeLib): boolean => {
  const role = rawRoofDef(lib, piece.prefab)?.role;
  return role !== undefined && role !== 'gableTri' && role !== 'gablePeak';
};

/** A raw piece's box; its model goes at the pivot, turned the game's way. */
export const rawBox = (piece: RawPiece, lib: RawShapeLib): PieceBox => {
  const item = { kind: 'raw', id: piece.id } as const;
  const hit = { ...item, area: rawOutlineArea(piece, lib) };
  const frame = frameOf(piece);
  const body = withoutZeros(bodyOf(piece, lib));
  const lift = FLOOR_TILE_PREFABS.has(piece.prefab) ? FLOOR_LIFT : 0;
  return {
    key: `raw:${piece.id}`,
    item,
    hit,
    kind: 'raw',
    material: rawDef(lib, piece)?.material ?? null,
    group: null,
    ...body,
    center: { ...body.center, y: body.center.y + lift },
    prefab: piece.prefab,
    ...(untilted(piece)
      ? {}
      : { modelTurn: { x: frame.tiltX, y: frame.rotationY, z: frame.rollZ } }),
    ...(isRawRoofCover(piece, lib) ? { roofCover: true as const } : {}),
  };
};

/** The piece turned by `deltaDeg` (clockwise on screen) about its box's centre. */
export const rotateRaw = (
  piece: RawPiece,
  deltaDeg: number,
  lib: RawShapeLib
): Pick<RawPiece, 'position' | 'rotation'> => {
  const { center } = rawBox(piece, lib);
  const offset = rotate(
    { x: piece.position.x - center.x, z: piece.position.z - center.z },
    deltaDeg
  );
  return {
    position: { ...piece.position, x: round6(center.x + offset.x), z: round6(center.z + offset.z) },
    rotation: { ...piece.rotation, yaw: normalizeDeg(piece.rotation.yaw + deltaDeg) },
  };
};
