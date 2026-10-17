import { useEffect, useMemo, useState } from 'react';

import type { PieceBox } from '../../model/pieceBoxes';
import { useThemeTokens } from '../../store/hooks';

import { materialColorer, type PieceColorer } from './pieceColors';
import { PieceInstances } from './PieceInstances';
import { createPieceMaterial } from './pieceMaterial';

/** Ghosts are faint and write no depth, so what they overlap still shows. */
const GHOST_OPACITY = 0.4;
/** Room the ghost mesh starts with, and how much it grows by when outgrown. */
const MIN_CAPACITY = 64;
const GROWTH = 4;

/**
 * What a tool would build, as see-through boxes (they cast no shadow), in the plan's
 * colours unless `colorOf` says otherwise (both follow the theme). The mesh only grows
 * while mounted, in big steps, so a drag that adds tiles doesn't keep rebuilding it.
 */
export const GhostBoxes = ({
  boxes,
  colorOf,
}: {
  boxes: readonly PieceBox[];
  colorOf?: PieceColorer;
}) => {
  const tokens = useThemeTokens();
  const themed = useMemo(() => materialColorer(tokens), [tokens]);
  const [material] = useState(() => createPieceMaterial({ opacity: GHOST_OPACITY }));
  const [shapeMaterial] = useState(() =>
    createPieceMaterial({ opacity: GHOST_OPACITY, edges: false })
  );
  const [capacity, setCapacity] = useState(MIN_CAPACITY);
  if (boxes.length > capacity) setCapacity(boxes.length * GROWTH);
  useEffect(
    () => () => {
      material.dispose();
      shapeMaterial.dispose();
    },
    [material, shapeMaterial]
  );
  return (
    <PieceInstances
      boxes={boxes}
      colorOf={colorOf ?? themed}
      material={material}
      shapeMaterial={shapeMaterial}
      castShadow={false}
      capacity={capacity}
    />
  );
};
