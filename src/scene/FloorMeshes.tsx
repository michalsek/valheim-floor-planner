import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect } from 'react';

import { floorColor } from '../catalog/materialColors';
import { isOddTile } from '../model/splitFloor';
import type { PlacedPiece } from '../model/types';
import { useLevelDerived } from '../store/planHooks';
import { supportViewAtom } from '../store/session';
import { useSupport } from '../store/supportSync';
import type { ThemeTokens } from '../theme/themeTokens';

import type { SlabStyler } from './slabResources';
import { bandKey, bandOf, bandOfKey, supportBandColor } from './supportColors';
import { useSlabResources } from './useSlabResources';

/** Slab height: well under the wall slabs, which sit from 0 to 0.1. */
const SLAB = 0.03;

/** Style keys are `material:0` / `material:1` (the checkerboard), or `support:<band>`. */
const floorStyler =
  (tokens: ThemeTokens): SlabStyler =>
  (key) => {
    const band = bandOfKey(key);
    const [material = '', odd] = key.split(':');
    const color =
      (band !== null && supportBandColor(tokens, band)) ||
      floorColor(tokens.palette, material, odd === '1');
    return { color, opacity: tokens.floorOpacity };
  };

const materialKey = (tile: PlacedPiece): string => `${tile.material}:${isOddTile(tile) ? 1 : 0}`;

/**
 * The current level's floor tiles as thin see-through slabs under the walls, tinted
 * apart from the wall colours and checkered (or, in the support view, by support band);
 * `FloorOutlines` draws the seams.
 */
export const FloorMeshes = () => {
  const { pieces } = useLevelDerived();
  const { support } = useSupport();
  const supportView = useAtomValue(supportViewAtom);
  const invalidate = useThree((s) => s.invalidate);
  const resources = useSlabResources(floorStyler);
  const tiles = pieces.filter((p) => p.kind === 'floor');

  const keyOf = (tile: PlacedPiece): string => {
    const band = supportView ? bandOf(support, tile.key) : 'none';
    return band === 'none' ? materialKey(tile) : bandKey(band);
  };

  useEffect(() => {
    invalidate();
  }, [pieces, support, supportView, invalidate]);

  return (
    <group>
      {tiles.map((tile) => (
        <mesh
          key={tile.key}
          geometry={resources.geometry}
          material={resources.materialFor(keyOf(tile))}
          position={[tile.center.x, SLAB / 2, tile.center.z]}
          scale={[tile.footprint.length, SLAB, tile.footprint.thickness]}
        />
      ))}
    </group>
  );
};
