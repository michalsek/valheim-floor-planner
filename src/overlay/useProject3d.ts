import { useAtomValue } from 'jotai';
import { createContext, useCallback, useContext } from 'react';

import type { Vec2 } from '../model/types';
import { projection3dAtom } from '../store/session';
import { project3d } from '../viewport/projection3d';
import type { ScreenPoint } from '../viewport/viewportMath';

/** The height the 3D overlay's plan points are at: each user sets its own; default 0. */
export const OverlayPlaneContext = createContext(0);

/**
 * Maps plan points on the overlay's plane (lifted by `dy` metres) to overlay CSS px for
 * the current 3D camera; null for points behind it, or before the camera is set up.
 */
export const useProject3d = (): ((p: Vec2, dy?: number) => ScreenPoint | null) => {
  const projection = useAtomValue(projection3dAtom);
  const y = useContext(OverlayPlaneContext);
  return useCallback(
    (p: Vec2, dy = 0) => (projection ? project3d({ x: p.x, y: y + dy, z: p.z }, projection) : null),
    [projection, y]
  );
};
