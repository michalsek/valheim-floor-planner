import { useThree } from '@react-three/fiber';
import { atom, useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';

import { useActiveToolId } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { useDisplayPlan } from '../../store/planHooks';
import { realLookAtom } from '../../store/modelView';
import { useShownSiteTerrain } from '../../store/siteTerrain';
import { keptPrefabsAtom } from '../../tools/Build/buildState';
import { getTool } from '../../tools/toolbox';
import { ToolPreview3d } from '../../tools/ToolPreview';

import { CutGhosts } from './CutGhosts';
import { CutOutline3d } from './CutOutline3d';
import { Dimensions3d } from './Dimensions3d';
import { DropLine3d } from './DropLine3d';
import { withKeptPrefabs } from './GhostModel';
import { Ground } from './Ground';
import { releaseModels } from './assets/useModels';
import { Lights } from './Lights';
import { OrbitRig } from './OrbitRig';
import { BoxPieces, ModelPieces } from './PlanPieces';
import { cameraFloor, siteReach, withGround } from './siteBounds';
import { SnapCursor3d } from './SnapCursor3d';
import { Terrain3d } from './Terrain3d';
import { useCutShading } from './useCutShading';
import { useViewCamera } from './useViewCamera';

const NEVER = atom(false);

/**
 * The 3D view of the plan: a perspective camera with orbit controls, lights and ground
 * shadows, the flat ground or a site's terrain (`Terrain3d`), every piece and prop below
 * the cut as a box at its real size and height, or as its real game model (in material
 * or support colours: `useCutShading`), with Ghost on what the cut hides as frosted
 * boxes (`CutGhosts`), the cut's outline at H, pinned dimensions at their own heights,
 * and the snap cursor, its drop line and the active tool's previews on the surfaces
 * under the pointer (all at absolute heights). Picking always uses the drawn boxes,
 * never the ghosts. Pointer input goes through `ToolHost`, as in 2D.
 */
export const View3d = () => {
  const camera = useViewCamera();
  const plan = useDisplayPlan();
  const realLook = useAtomValue(realLookAtom);
  const gl = useThree((s) => s.gl);
  // Models outlive the view (leaving 3D keeps them); back to boxes frees them.
  useEffect(() => {
    if (!realLook) releaseModels(gl);
  }, [realLook, gl]);

  const shading = useCutShading(plan);
  const { boxes, ghosts, retainBoxes, bounds: planBounds, colorOf, tintOf } = shading;
  // The Build ghost's recent prefabs stay loaded with the plan's models.
  const kept = useAtomValue(keptPrefabsAtom);
  const retainModels = useMemo(
    () => withKeptPrefabs(retainBoxes, kept, getLibrary()),
    [retainBoxes, kept]
  );
  const { hidesCursor } = getTool(useActiveToolId());
  const cursorHidden = useAtomValue(hidesCursor ?? NEVER);
  const site = useShownSiteTerrain();
  // The camera fit and the shadows also hold the ground under the plan.
  const bounds = useMemo(() => withGround(planBounds, site), [planBounds, site]);
  const floor = useMemo(() => cameraFloor(site), [site]);

  return (
    <>
      <OrbitRig camera={camera} bounds={bounds} reach={siteReach(site)} floor={floor} />
      <Lights bounds={bounds} />
      {site ? <Terrain3d ground={site} /> : <Ground />}
      {realLook ? (
        <ModelPieces boxes={boxes} retainBoxes={retainModels} colorOf={colorOf} tintOf={tintOf} />
      ) : (
        <BoxPieces boxes={boxes} retainBoxes={retainBoxes} colorOf={colorOf} />
      )}
      <CutGhosts ghosts={ghosts} retainBoxes={retainBoxes} />
      <CutOutline3d bounds={shading.shownBounds} />
      <Dimensions3d />
      <ToolPreview3d />
      {!cursorHidden && <SnapCursor3d />}
      {!cursorHidden && <DropLine3d />}
    </>
  );
};
