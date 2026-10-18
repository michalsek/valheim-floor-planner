import { CameraRig } from './CameraRig';
import { FloorMeshes } from './FloorMeshes';
import { GhostMeshes } from './GhostMeshes';
import { GridPlane } from './GridPlane';
import { Terrain2d } from './Terrain2d';
import { WallMeshes } from './WallMeshes';

/**
 * The top-down plan of the current level: the orthographic camera, a site's ground
 * (relief and contours), the grid, the level below faintly under it, and floor and wall
 * slabs.
 */
export const Plan2d = () => (
  <>
    <CameraRig />
    <Terrain2d />
    <GridPlane />
    <GhostMeshes />
    <FloorMeshes />
    <WallMeshes />
  </>
);
