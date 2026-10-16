import { useCallback } from 'react';

import type { Vec2 } from '../model/types';
import { useViewport, useViewportSize } from '../store/hooks';
import { worldToScreen, type ScreenPoint } from '../viewport/viewportMath';

/** Maps world points to overlay (CSS px) coordinates for the current viewport. */
export const useWorldToScreen = (): ((p: Vec2) => ScreenPoint) => {
  const viewport = useViewport();
  const size = useViewportSize();
  return useCallback((p: Vec2) => worldToScreen(viewport, size, p), [viewport, size]);
};
