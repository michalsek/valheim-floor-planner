import { CameraRig } from './CameraRig';
import { FloorMeshes } from './FloorMeshes';
import { GridPlane } from './GridPlane';
import { WallMeshes } from './WallMeshes';

/** The top-down plan: the orthographic camera, the grid, and floor and wall slabs. */
export const Plan2d = () => (
  <>
    <CameraRig />
    <GridPlane />
    <FloorMeshes />
    <WallMeshes />
  </>
);
