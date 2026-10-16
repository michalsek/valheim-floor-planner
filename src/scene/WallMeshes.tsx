import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';

import { materialColor } from '../catalog/materialColors';
import { groundCourse } from '../model/types';
import { useDisplayDerived } from '../store/planHooks';

import { createSlabResources } from './slabResources';

/** Gap left between neighbouring pieces, so seams show (metres). */
const SEAM = 0.06;
/** Slab height above the grid plane; walls stay opaque and above y = 0. */
const SLAB = 0.1;

const createResources = () =>
  createSlabResources((material) => ({ color: materialColor(material), opacity: 1 }));

/**
 * The plan's ground-course wall pieces, as flat slabs (the bill counts every course).
 * Openings leave their gap empty; floors have their own meshes.
 */
export const WallMeshes = () => {
  const { pieces } = useDisplayDerived();
  const invalidate = useThree((s) => s.invalidate);
  const [resources] = useState(createResources);

  useEffect(() => () => resources.dispose(), [resources]);
  useEffect(() => {
    invalidate();
  }, [pieces, invalidate]);

  return (
    <group>
      {groundCourse(pieces.filter((p) => p.kind === 'wall')).map((piece) => (
        <mesh
          key={piece.key}
          geometry={resources.geometry}
          material={resources.materialFor(piece.material)}
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
