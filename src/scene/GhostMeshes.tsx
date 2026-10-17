import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

import { floorColor, materialColor } from '../catalog/materialColors';
import { groundCourse } from '../model/types';
import { getDerived, useGhostPlan } from '../store/planHooks';
import type { ThemeTokens } from '../theme/themeTokens';

import type { SlabStyler } from './slabResources';
import { useSlabResources } from './useSlabResources';

/** Ghosts are faint, and below the current level's slabs, which draw over them. */
const GHOST_OPACITY = 0.5;
const GHOST_Y = -0.2;
const SLAB = 0.02;

/** Style keys are `wall:<material>` or `floor:<material>`. */
const ghostStyler =
  ({ palette }: ThemeTokens): SlabStyler =>
  (key) => {
    const [kind, material = ''] = key.split(':');
    const color =
      kind === 'floor' ? floorColor(palette, material, false) : materialColor(palette, material);
    return { color, opacity: GHOST_OPACITY };
  };

/**
 * The level below the current one, faintly under it (2D): its floors and walls, and
 * lower walls that reach up near this level. Their items are in `LevelGhosts`.
 */
export const GhostMeshes = () => {
  const { pieces } = getDerived(useGhostPlan());
  const invalidate = useThree((s) => s.invalidate);
  const resources = useSlabResources(ghostStyler);

  useEffect(() => {
    invalidate();
  }, [pieces, invalidate]);

  return (
    <group position-y={GHOST_Y}>
      {groundCourse(pieces.filter((p) => p.kind !== 'opening')).map((piece) => (
        <mesh
          key={piece.key}
          geometry={resources.geometry}
          material={resources.materialFor(`${piece.kind}:${piece.material}`)}
          position-x={piece.center.x}
          position-z={piece.center.z}
          rotation-y={-piece.rotation}
          scale={[piece.footprint.length, SLAB, piece.footprint.thickness]}
        />
      ))}
    </group>
  );
};
