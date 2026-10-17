import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';

import { boxesBounds, type PieceBox } from '../../model/pieceBoxes';
import { useThemeTokens } from '../../store/hooks';
import { isLevelConnector } from '../../catalog/propDefs';
import { sameLevel } from '../../model/elevation';
import { levelIndex } from '../../model/levels';
import { getLibrary } from '../../store/libraryInstance';
import { getPieceBoxes, useDisplayPlan } from '../../store/planHooks';
import { useSupport } from '../../store/supportSync';
import { hoverAtom, selectionAtom } from '../../store/selection';
import { supportViewAtom, workDatumAtom } from '../../store/session';
import { ToolPreview3d } from '../../tools/ToolPreview';

import { Dimensions3d } from './Dimensions3d';
import { Ground } from './Ground';
import { Lights } from './Lights';
import { OrbitRig } from './OrbitRig';
import { materialColorer, supportColorer, withHighlight, withLevel } from './pieceColors';
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
 * shadows, every piece and prop as a box at its real size and its own elevation (in
 * material or support colours, faded off the current level, the selection and hover
 * tinted), pinned dimensions at their own levels, and the snap cursor and the active
 * tool's previews on the work plane (the current level). Walls, floors and props are
 * one instanced draw; door and gate panels another. Pointer input goes through
 * `ToolHost`, as in 2D.
 */
export const View3d = () => {
  const camera = useViewCamera();
  const plan = useDisplayPlan();
  const datum = useAtomValue(workDatumAtom);
  const tokens = useThemeTokens();
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const supportView = useAtomValue(supportViewAtom);
  const { support } = useSupport();
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
  const colorOf = useMemo(() => {
    const plain = materialColorer(tokens);
    const base = supportView ? supportColorer(support, tokens, plain) : plain;
    const { levelOf } = levelIndex(plan, getLibrary());
    const onLevel = (box: PieceBox) =>
      sameLevel(levelOf(box.elevation, isLevelConnector(box.group)), datum);
    const tint = supportView ? tokens.ink.neutral : tokens.selection;
    return withHighlight(withLevel(base, onLevel, tokens), selection, hover, tint);
  }, [plan, tokens, supportView, support, datum, selection, hover]);

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
      <Dimensions3d />
      {/* Drawn on the work plane: the previews are built at y = 0 and lifted here. */}
      <group position-y={datum}>
        <ToolPreview3d />
        <SnapCursor3d />
      </group>
    </>
  );
};
