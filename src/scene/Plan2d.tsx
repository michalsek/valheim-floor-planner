import { CameraRig } from './CameraRig';
import { GridPlane } from './GridPlane';
import { Terrain2d } from './Terrain2d';

/**
 * The top-down plan below the cut: the orthographic camera, a site's ground
 * (relief and contours) and the grid.
 */
export const Plan2d = () => (
  <>
    <CameraRig />
    <Terrain2d />
    <GridPlane />
  </>
);
