import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';

import { boxesBounds } from '../../model/pieceBoxes';
import { useThemeTokens } from '../../store/hooks';
import { getPieceBoxes, useDisplayPlan } from '../../store/planHooks';
import { hoverAtom, selectionAtom } from '../../store/selection';
import { workDatumAtom } from '../../store/session';
import { ToolPreview3d } from '../../tools/ToolPreview';

import { Dimensions3d } from './Dimensions3d';
import { Ground } from './Ground';
import { Lights } from './Lights';
import { OrbitRig } from './OrbitRig';
import { materialColorer, withHighlight } from './pieceColors';
import { PieceInstances } from './PieceInstances';
import { createPieceMaterial } from './pieceMaterial';
import { SnapCursor3d } from './SnapCursor3d';
import { useViewCamera } from './useViewCamera';

/** Door and gate panels are see-through, so the gap they stand in still reads. */
const PANEL_OPACITY = 0.35;

const createMaterials = () => ({
  solid: createPieceMaterial({ opacity: 1 }),
  panel: createPieceMaterial({ opacity: PANEL_OPACITY }),
});

/**
 * The 3D view of the plan: a perspective camera with orbit controls, lights and ground
 * shadows, every piece and prop as a box at its real size (the selection and hover
 * tinted), pinned dimensions, the snap cursor and the active tool's previews on the
 * work plane (the work datum). Pieces stand at their own elevation. Walls, floors and
 * props are one instanced draw; door and gate panels another. Pointer input goes through `ToolHost`, as in 2D.
 */
export const View3d = () => {
  const camera = useViewCamera();
  const plan = useDisplayPlan();
  const datum = useAtomValue(workDatumAtom);
  const tokens = useThemeTokens();
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const [materials] = useState(createMaterials);

  useEffect(
    () => () => {
      materials.solid.dispose();
      materials.panel.dispose();
    },
    [materials]
  );

  const boxes = getPieceBoxes(plan);
  const bounds = useMemo(() => boxesBounds(boxes), [boxes]);
  const solid = useMemo(() => boxes.filter((b) => b.kind !== 'opening'), [boxes]);
  const panels = useMemo(() => boxes.filter((b) => b.kind === 'opening'), [boxes]);
  const colorOf = useMemo(
    () => withHighlight(materialColorer(tokens), selection, hover, tokens),
    [tokens, selection, hover]
  );

  return (
    <>
      <OrbitRig camera={camera} bounds={bounds} />
      <Lights bounds={bounds} />
      <Ground />
      <PieceInstances boxes={solid} colorOf={colorOf} material={materials.solid} castShadow />
      <PieceInstances
        boxes={panels}
        colorOf={colorOf}
        material={materials.panel}
        castShadow={false}
      />
      {/* Drawn on the work plane: the previews are built at y = 0 and lifted here. */}
      <group position-y={datum}>
        <Dimensions3d />
        <ToolPreview3d />
        <SnapCursor3d />
      </group>
    </>
  );
};
