import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';

import { floorColor } from '../catalog/materialColors';
import type { PlacedPiece } from '../model/types';
import { useDisplayDerived } from '../store/planHooks';

import { createSlabResources } from './slabResources';

/** Slab height: well under the wall slabs, which sit from 0 to 0.1. */
const SLAB = 0.03;
const OPACITY = 0.6;

/** Style keys are `material:0` / `material:1`, for the two checkerboard shades. */
const createResources = () =>
  createSlabResources((key) => {
    const [material = '', odd] = key.split(':');
    return { color: floorColor(material, odd === '1'), opacity: OPACITY };
  });

/** Which checkerboard shade a tile gets, from its place on its own size's grid. */
const isOdd = (tile: PlacedPiece): boolean => {
  const size = tile.footprint.length;
  const i = Math.round((tile.center.x - size / 2) / size);
  const j = Math.round((tile.center.z - size / 2) / size);
  return (i + j) % 2 !== 0;
};

/**
 * Floor tiles as thin see-through slabs under the walls, tinted apart from the wall
 * colours and checkered; `FloorOutlines` draws the seams.
 */
export const FloorMeshes = () => {
  const { pieces } = useDisplayDerived();
  const invalidate = useThree((s) => s.invalidate);
  const [resources] = useState(createResources);
  const tiles = pieces.filter((p) => p.kind === 'floor');

  useEffect(() => () => resources.dispose(), [resources]);
  useEffect(() => {
    invalidate();
  }, [pieces, invalidate]);

  return (
    <group>
      {tiles.map((tile) => (
        <mesh
          key={tile.key}
          geometry={resources.geometry}
          material={resources.materialFor(`${tile.material}:${isOdd(tile) ? 1 : 0}`)}
          position={[tile.center.x, SLAB / 2, tile.center.z]}
          scale={[tile.footprint.length, SLAB, tile.footprint.thickness]}
        />
      ))}
    </group>
  );
};
