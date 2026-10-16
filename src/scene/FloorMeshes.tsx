import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import { floorColor } from '../catalog/materialColors';
import { isOddTile } from '../model/splitFloor';
import { useDisplayDerived } from '../store/planHooks';
import type { ThemeTokens } from '../theme/themeTokens';

import type { SlabStyler } from './slabResources';
import { useSlabResources } from './useSlabResources';

/** Slab height: well under the wall slabs, which sit from 0 to 0.1. */
const SLAB = 0.03;

/** Style keys are `material:0` / `material:1`, for the two checkerboard shades. */
const floorStyler =
  ({ palette, floorOpacity }: ThemeTokens): SlabStyler =>
  (key) => {
    const [material = '', odd] = key.split(':');
    return { color: floorColor(palette, material, odd === '1'), opacity: floorOpacity };
  };

/**
 * Floor tiles as thin see-through slabs under the walls, tinted apart from the wall
 * colours and checkered; `FloorOutlines` draws the seams.
 */
export const FloorMeshes = () => {
  const { pieces } = useDisplayDerived();
  const invalidate = useThree((s) => s.invalidate);
  const resources = useSlabResources(floorStyler);
  const tiles = pieces.filter((p) => p.kind === 'floor');

  useEffect(() => {
    invalidate();
  }, [pieces, invalidate]);

  return (
    <group>
      {tiles.map((tile) => (
        <mesh
          key={tile.key}
          geometry={resources.geometry}
          material={resources.materialFor(`${tile.material}:${isOddTile(tile) ? 1 : 0}`)}
          position={[tile.center.x, SLAB / 2, tile.center.z]}
          scale={[tile.footprint.length, SLAB, tile.footprint.thickness]}
        />
      ))}
    </group>
  );
};
