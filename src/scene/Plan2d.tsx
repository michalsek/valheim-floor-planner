import { CameraRig } from './CameraRig';
import { FloorMeshes } from './FloorMeshes';
import { GhostMeshes } from './GhostMeshes';
import { GridPlane } from './GridPlane';
import { WallMeshes } from './WallMeshes';

/**
 * The top-down plan of the current level: the orthographic camera, the grid, the level
 * below faintly under it, and floor and wall slabs.
 */
export const Plan2d = () => (
  <>
    <CameraRig />
    <GridPlane />
    <GhostMeshes />
    <FloorMeshes />
    <WallMeshes />
  </>
);
