import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { BoxGeometry, MeshBasicNodeMaterial } from 'three/webgpu';

import { materialColor } from '../catalog/materialColors';
import { groundCourse } from '../model/types';
import { useDisplayDerived } from '../store/planHooks';

/** Gap left between neighbouring pieces, so seams show (metres). */
const SEAM = 0.06;
/** Slab height above the grid plane; walls stay opaque and above y = 0. */
const SLAB = 0.1;

/** Shared geometry and one material per piece material, created on demand. */
const createResources = () => {
  const geometry = new BoxGeometry(1, 1, 1);
  const materials = new Map<string, MeshBasicNodeMaterial>();
  const materialFor = (material: string) => {
    let m = materials.get(material);
    if (!m) {
      m = new MeshBasicNodeMaterial({ color: materialColor(material) });
      materials.set(material, m);
    }
    return m;
  };
  const dispose = () => {
    geometry.dispose();
    materials.forEach((m) => m.dispose());
  };
  return { geometry, materialFor, dispose };
};

/** The plan's ground-course wall pieces, as flat slabs (the bill counts every course). */
export const WallMeshes = () => {
  const { pieces } = useDisplayDerived();
  const invalidate = useThree((s) => s.invalidate);
  const [resources] = useState(createResources);

  // As with the grid, StrictMode reuses disposed resources; three.js re-creates them.
  useEffect(() => () => resources.dispose(), [resources]);
  useEffect(() => {
    invalidate();
  }, [pieces, invalidate]);

  return (
    <group>
      {groundCourse(pieces).map((piece) => (
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
