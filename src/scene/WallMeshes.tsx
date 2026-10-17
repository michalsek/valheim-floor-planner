import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';

import { materialColor } from '../catalog/materialColors';
import type { PlanSupport } from '../model/support/planSupport';
import { groundCourse, type PlacedPiece } from '../model/types';
import { useLevelDerived } from '../store/planHooks';
import { supportViewAtom } from '../store/session';
import { useSupport } from '../store/supportSync';
import type { ThemeTokens } from '../theme/themeTokens';

import type { SlabStyler } from './slabResources';
import { bandKey, bandOf, bandOfKey, columnBand, supportBandColor } from './supportColors';
import { useSlabResources } from './useSlabResources';

/** Gap left between neighbouring pieces, so seams show (metres). */
const SEAM = 0.06;
/** Slab height above the grid plane; walls stay opaque and above y = 0. */
const SLAB = 0.1;

const wallStyler =
  (tokens: ThemeTokens): SlabStyler =>
  (key) => {
    const band = bandOfKey(key);
    const color =
      (band !== null && supportBandColor(tokens, band)) || materialColor(tokens.palette, key);
    return { color, opacity: 1 };
  };

/** Wall pieces by run segment: the courses of each column are among them. */
const bySegment = (walls: readonly PlacedPiece[]): Map<string, PlacedPiece[]> => {
  const groups = new Map<string, PlacedPiece[]>();
  for (const piece of walls) {
    const key = `${piece.sourceId}:${piece.segment}`;
    const group = groups.get(key);
    if (group) group.push(piece);
    else groups.set(key, [piece]);
  }
  return groups;
};

/** The courses above the ground-course piece `g`: in its segment, within its length. */
const columnOf = (g: PlacedPiece, segment: readonly PlacedPiece[]): PlacedPiece[] =>
  segment.filter(
    (piece) =>
      piece !== g &&
      Math.hypot(piece.center.x - g.center.x, piece.center.z - g.center.z) < g.footprint.length / 2
  );

/**
 * Each ground-course piece's style key (`material` without support): its column's band
 * (`columnBand`).
 */
const supportKeys = (walls: readonly PlacedPiece[], support: PlanSupport): Map<string, string> => {
  const keys = new Map<string, string>();
  const segments = bySegment(walls);
  for (const g of groundCourse(walls)) {
    const courses = columnOf(g, segments.get(`${g.sourceId}:${g.segment}`) ?? []);
    const band = columnBand(
      bandOf(support, g.key),
      courses.map((p) => bandOf(support, p.key))
    );
    if (band !== 'none') keys.set(g.key, bandKey(band));
  }
  return keys;
};

/**
 * The current level's ground-course wall pieces, as flat slabs (the bill counts every
 * course), in material colours or, in the support view, their column's band.
 * Openings leave their gap empty; floors have their own meshes.
 */
export const WallMeshes = () => {
  const { pieces } = useLevelDerived();
  const { support } = useSupport();
  const supportView = useAtomValue(supportViewAtom);
  const invalidate = useThree((s) => s.invalidate);
  const resources = useSlabResources(wallStyler);
  const walls = useMemo(() => pieces.filter((p) => p.kind === 'wall'), [pieces]);
  const keys = useMemo(
    () => (supportView && support ? supportKeys(walls, support) : null),
    [walls, support, supportView]
  );

  useEffect(() => {
    invalidate();
  }, [keys, invalidate]);

  return (
    <group>
      {groundCourse(walls).map((piece) => (
        <mesh
          key={piece.key}
          geometry={resources.geometry}
          material={resources.materialFor(keys?.get(piece.key) ?? piece.material)}
          position={[piece.center.x, SLAB / 2, piece.center.z]}
          rotation-y={-piece.rotation}
          scale={[
            Math.max(piece.footprint.length - SEAM, SEAM),
            SLAB,
            Math.max(piece.footprint.thickness - SEAM, SEAM),
          ]}
        />
      ))}
    </group>
  );
};
