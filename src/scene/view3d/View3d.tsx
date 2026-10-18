import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo } from 'react';

import { useDisplayPlan } from '../../store/planHooks';
import { realLookAtom } from '../../store/modelView';
import { workDatumAtom } from '../../store/session';
import { useShownSiteTerrain } from '../../store/siteTerrain';
import { ToolPreview3d } from '../../tools/ToolPreview';

import { Dimensions3d } from './Dimensions3d';
import { DropLine3d } from './DropLine3d';
import { Ground } from './Ground';
import { releaseModels } from './assets/useModels';
import { LevelPlate } from './LevelPlate';
import { Lights } from './Lights';
import { OrbitRig } from './OrbitRig';
import { BoxPieces, ModelPieces } from './PlanPieces';
import { siteReach, withGround } from './siteBounds';
import { SnapCursor3d } from './SnapCursor3d';
import { Terrain3d } from './Terrain3d';
import { useLevelShading } from './useLevelShading';
import { useViewCamera } from './useViewCamera';

/**
 * The 3D view of the plan: a perspective camera with orbit controls, lights and ground
 * shadows, the flat ground or a site's terrain (`Terrain3d`), every piece and prop as a box at its real size and its own elevation, or as
 * its real game model (in material or support colours, shaded by level and cut away
 * above the current one: `useLevelShading`), the level plate at the current level,
 * pinned dimensions at their own levels, and the snap cursor, its drop line and the
 * active tool's previews on the work plane. Picking always uses the boxes. Pointer
 * input goes through `ToolHost`, as in 2D.
 */
export const View3d = () => {
  const camera = useViewCamera();
  const plan = useDisplayPlan();
  const datum = useAtomValue(workDatumAtom);
  const realLook = useAtomValue(realLookAtom);
  const gl = useThree((s) => s.gl);
  // Models outlive the view (leaving 3D keeps them); back to boxes frees them.
  useEffect(() => {
    if (!realLook) releaseModels(gl);
  }, [realLook, gl]);

  const { boxes, retainBoxes, bounds: planBounds, colorOf, tintOf } = useLevelShading(plan);
  const site = useShownSiteTerrain();
  // The camera fit and the shadows also hold the ground under the plan.
  const bounds = useMemo(() => withGround(planBounds, site), [planBounds, site]);

  return (
    <>
      <OrbitRig camera={camera} bounds={bounds} reach={siteReach(site)} />
      <Lights bounds={bounds} />
      {site ? <Terrain3d ground={site} /> : <Ground />}
      <LevelPlate bounds={bounds} />
      {realLook ? (
        <ModelPieces boxes={boxes} retainBoxes={retainBoxes} colorOf={colorOf} tintOf={tintOf} />
      ) : (
        <BoxPieces boxes={boxes} retainBoxes={retainBoxes} colorOf={colorOf} />
      )}
      <Dimensions3d />
      {/* Drawn on the work plane: the previews are built at y = 0 and lifted here. */}
      <group position-y={datum}>
        <ToolPreview3d />
        <SnapCursor3d />
        <DropLine3d />
      </group>
    </>
  );
};
