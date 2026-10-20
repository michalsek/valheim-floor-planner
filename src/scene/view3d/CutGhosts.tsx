import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { MeshLambertNodeMaterial } from 'three/webgpu';

import type { PieceBox } from '../../model/pieceBoxes';
import { DEFAULT_GHOST_OPACITY, ghostOpacityAtom } from '../../store/ghostOpacity';
import { useThemeTokens } from '../../store/hooks';

import { materialColorer } from './pieceColors';
import { PieceInstances } from './PieceInstances';
import { createPieceMaterial } from './pieceMaterial';

interface GhostMaterials {
  box: MeshLambertNodeMaterial;
  /** The edgeless twin, for the other shapes. */
  shape: MeshLambertNodeMaterial;
}

// Made see-through (an opacity below 1); the opacity follows the slider.
const createMaterials = (): GhostMaterials => ({
  box: createPieceMaterial({ opacity: DEFAULT_GHOST_OPACITY }),
  shape: createPieceMaterial({ opacity: DEFAULT_GHOST_OPACITY, edges: false }),
});

const disposeMaterials = ({ box, shape }: GhostMaterials) => {
  box.dispose();
  shape.dispose();
};

/** The ghosts' opacity (a uniform: no new pipeline). */
const setOpacity = ({ box, shape }: GhostMaterials, opacity: number) => {
  box.opacity = opacity;
  shape.opacity = opacity;
};

interface CutGhostsProps {
  /** What the cut hides, when Ghost is on; else none. */
  ghosts: readonly PieceBox[];
  /** Every shown box: the meshes keep room for them, so the cut remounts nothing. */
  retainBoxes: readonly PieceBox[];
}

/**
 * What the cut hides, as see-through boxes in the plan's colours (in Models too), casting
 * no shadow. Tools never see them. The Ghost opacity slider sets the materials' opacity, a
 * uniform: no new pipeline. Always mounted in 3D, so its (empty) meshes link on entry.
 */
export const CutGhosts = ({ ghosts, retainBoxes }: CutGhostsProps) => {
  const invalidate = useThree((s) => s.invalidate);
  const tokens = useThemeTokens();
  const colorOf = useMemo(() => materialColorer(tokens), [tokens]);
  const opacity = useAtomValue(ghostOpacityAtom);
  const [materials] = useState(createMaterials);
  useEffect(() => () => disposeMaterials(materials), [materials]);

  useLayoutEffect(() => {
    setOpacity(materials, opacity);
    invalidate();
  }, [materials, opacity, invalidate]);

  return (
    <PieceInstances
      boxes={ghosts}
      retain={retainBoxes}
      colorOf={colorOf}
      material={materials.box}
      shapeMaterial={materials.shape}
      castShadow={false}
    />
  );
};
