import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';

import { boxesBounds, type PieceBox } from '../../model/pieceBoxes';
import { useThemeTokens } from '../../store/hooks';
import { isLevelConnector } from '../../catalog/propDefs';
import { sameLevel } from '../../model/elevation';
import { levelIndex } from '../../model/levels';
import { getLibrary } from '../../store/libraryInstance';
import { getPieceBoxes, useDisplayPlan } from '../../store/planHooks';
import { useSupport } from '../../store/supportSync';
import { hoverAtom, selectionAtom } from '../../store/selection';
import { realLookAtom } from '../../store/modelView';
import { roofsVisibleAtom, supportViewAtom, workDatumAtom } from '../../store/session';
import { ToolPreview3d } from '../../tools/ToolPreview';

import { Dimensions3d } from './Dimensions3d';
import { Ground } from './Ground';
import { releaseModels } from './assets/useModels';
import { Lights } from './Lights';
import { OrbitRig } from './OrbitRig';
import {
  materialColorer,
  plainTinter,
  supportColorer,
  supportTinter,
  tintWithHighlight,
  tintWithLevel,
  withHighlight,
  withLevel,
} from './pieceColors';
import { BoxPieces, ModelPieces } from './PlanPieces';
import { SnapCursor3d } from './SnapCursor3d';
import { useViewCamera } from './useViewCamera';

/**
 * The 3D view of the plan: a perspective camera with orbit controls, lights and ground
 * shadows, every piece and prop as a box at its real size and its own elevation, or as
 * its real game model (in material or support colours, faded off the current level,
 * the selection and hover tinted), pinned dimensions at their own levels, and the snap
 * cursor and the active tool's previews on the work plane (the current level). Picking
 * always uses the boxes. Pointer input goes through `ToolHost`, as in 2D.
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
  const realLook = useAtomValue(realLookAtom);
  const gl = useThree((s) => s.gl);
  // Models outlive the view (leaving 3D keeps them); back to boxes frees them.
  useEffect(() => {
    if (!realLook) releaseModels(gl);
  }, [realLook, gl]);

  const roofsVisible = useAtomValue(roofsVisibleAtom);
  const allBoxes = getPieceBoxes(plan);
  const boxes = useMemo(
    () => (roofsVisible ? allBoxes : allBoxes.filter((b) => !b.roofCover)),
    [allBoxes, roofsVisible]
  );
  const bounds = useMemo(() => boxesBounds(boxes), [boxes]);
  const onLevel = useMemo(() => {
    const { levelOf } = levelIndex(plan, getLibrary());
    return (box: PieceBox) => sameLevel(levelOf(box.elevation, isLevelConnector(box.group)), datum);
  }, [plan, datum]);
  const highlight = supportView ? tokens.ink.neutral : tokens.selection;
  const colorOf = useMemo(() => {
    const plain = materialColorer(tokens);
    const base = supportView ? supportColorer(support, tokens, plain) : plain;
    return withHighlight(withLevel(base, onLevel, tokens), selection, hover, highlight);
  }, [tokens, supportView, support, onLevel, selection, hover, highlight]);
  const tintOf = useMemo(() => {
    const base = supportView ? supportTinter(support, tokens) : plainTinter;
    return tintWithHighlight(tintWithLevel(base, onLevel, tokens), selection, hover, highlight);
  }, [tokens, supportView, support, onLevel, selection, hover, highlight]);

  return (
    <>
      <OrbitRig camera={camera} bounds={bounds} />
      <Lights bounds={bounds} />
      <Ground />
      {realLook ? (
        <ModelPieces boxes={boxes} colorOf={colorOf} tintOf={tintOf} />
      ) : (
        <BoxPieces boxes={boxes} colorOf={colorOf} />
      )}
      <Dimensions3d />
      {/* Drawn on the work plane: the previews are built at y = 0 and lifted here. */}
      <group position-y={datum}>
        <ToolPreview3d />
        <SnapCursor3d />
      </group>
    </>
  );
};
