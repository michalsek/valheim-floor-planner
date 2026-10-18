/**
 * Raw pieces as 3D boxes and 2D outlines, about their pivot as the game places them.
 * Turned by yaw, tilted by pitch and rolled by roll (the game's Euler angles, mirrored
 * into planner space: three.js 'YXZ' of (−pitch, −yaw, roll); yaw is stored clockwise,
 * so `rotationY` is −yaw). Roof pieces take their roof shape, diagonal beams a beam,
 * anything else its collider box. Pure.
 */
import type { Hit } from './hitTest';
import { convexHull, polygonArea } from './geometry/convex';
import { normalizeDeg, rotate } from './geometry/propGeometry';
import { boxCorners, fromLocal, type OrientedBox } from './geometry/orient';
import type { PieceBox } from './pieceBoxes';
import { pieceAnchor } from './piecePivot';
import { rawDef, rawRect, rawSpan } from './rawPieces';
import { rawBeam, rawRoofDef, type RawShapeLib } from './rawShapes';
import { roofBox } from './roofBoxes';
import type { RawPiece, Vec2, Vec3 } from './types';

const DEG = Math.PI / 180;

const pivotOf = (piece: RawPiece): Vec3 => ({
  x: piece.position.x,
  y: piece.elevation + piece.position.y,
  z: piece.position.z,
});

/** The piece's turn as an oriented frame at its pivot. */
const frameOf = (piece: RawPiece) => ({
  rotationY: -piece.rotation.yaw * DEG,
  tiltX: -piece.rotation.pitch * DEG,
  rollZ: piece.rotation.roll * DEG,
});

/** A point of the prefab's frame in the world. */
const placed = (piece: RawPiece, local: Vec3): Vec3 =>
  fromLocal(local, { center: pivotOf(piece), size: local, ...frameOf(piece) });

const level = (piece: RawPiece) => piece.rotation.pitch === 0 && piece.rotation.roll === 0;

/** The box without its owner's fields (key, item, hit, colours). */
type Body = Pick<
  PieceBox,
  'center' | 'size' | 'rotationY' | 'tiltX' | 'rollZ' | 'shape' | 'pivot' | 'roofCover'
>;

const bodyOf = (piece: RawPiece, lib: RawShapeLib, item: PieceBox['item'], hit: Hit): Body => {
  const def = rawDef(lib, piece);
  const frame = frameOf(piece);
  const roof = level(piece) ? rawRoofDef(lib, piece.prefab) : undefined;
  if (roof && def) {
    const centre = placed(piece, pieceAnchor(def, roof.size));
    const owner = { key: `raw:${piece.id}`, item, hit, kind: 'raw' as const, cover: false };
    const roofPiece = {
      key: owner.key,
      prefab: piece.prefab,
      material: def.material ?? '',
      sourceId: piece.id,
      role: roof.role,
      shape: roof.shape,
      center: centre,
      size: roof.size,
      yaw: frame.rotationY,
      slope: roof.slope,
      cell: null,
    };
    const box = roofBox(roofPiece, piece.elevation, lib, owner);
    const { key: _key, item: _item, hit: _hit, kind: _kind, material: _material, ...rest } = box;
    const { group: _group, odd: _odd, elevation: _elevation, prefab: _prefab, ...body } = rest;
    return body;
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
  return {
    center: placed(piece, local),
    size: { x: rect.maxX - rect.minX, y: span.maxY - span.minY, z: rect.maxZ - rect.minZ },
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
  const item = { kind: 'raw', id: piece.id } as const;
  const body = bodyOf(piece, lib, item, { ...item, area: 0 });
  const box: OrientedBox = body;
  const outline = convexHull(boxCorners(box).map((c) => ({ x: c.x, z: c.z })));
  outlines.set(piece, { lib, outline });
  return outline;
};

export const rawOutlineArea = (piece: RawPiece, lib: RawShapeLib): number =>
  polygonArea(rawOutline(piece, lib));

/** Whether the piece is drawn as a roof shape (and outlined, not filled, in 2D). */
export const isRawRoof = (piece: RawPiece, lib: RawShapeLib): boolean =>
  level(piece) && rawRoofDef(lib, piece.prefab) !== undefined;

/**
 * Whether the piece covers a roof (a roof family's straight, ridge or corner piece, at
 * any tilt): hidden with the Roofs toggle, as a derived roof's cells are. Gable walls,
 * the Roof Cross among them, stay.
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
  return {
    key: `raw:${piece.id}`,
    item,
    hit,
    kind: 'raw',
    material: rawDef(lib, piece)?.material ?? null,
    group: null,
    odd: false,
    elevation: piece.elevation,
    ...withoutZeros(bodyOf(piece, lib, item, hit)),
    prefab: piece.prefab,
    ...(level(piece) ? {} : { modelTurn: { x: frame.tiltX, y: frame.rotationY, z: frame.rollZ } }),
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
  const round = (n: number) => Math.round(n * 1e6) / 1e6 + 0;
  return {
    position: { ...piece.position, x: round(center.x + offset.x), z: round(center.z + offset.z) },
    rotation: { ...piece.rotation, yaw: normalizeDeg(piece.rotation.yaw + deltaDeg) },
  };
};
