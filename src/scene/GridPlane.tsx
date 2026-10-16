import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useState } from 'react';

import { useViewport, useViewportSize } from '../store/hooks';
import { visibleWorldRect } from '../viewport/viewportMath';

import { createGridMaterial } from './grid/gridMaterial';
import { gridLevelAlphas } from './grid/gridLevels';

const GRID_COLOR = '#a9bccc';
/** The plane covers the visible rect with margin, so resizes never show its edge. */
const COVERAGE = 1.5;

/** A screen-filling plane on y = 0 that draws the multi-level grid. */
export const GridPlane = () => {
  const viewport = useViewport();
  const size = useViewportSize();
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const [grid] = useState(createGridMaterial);

  // StrictMode's simulated remount runs this cleanup and then keeps using the same
  // material; that's fine, three.js re-creates GPU resources for a disposed material.
  useEffect(() => () => grid.dispose(), [grid]);

  useLayoutEffect(() => {
    grid.update({ levelAlpha: gridLevelAlphas(viewport.zoom), dpr, color: GRID_COLOR });
    invalidate();
  }, [grid, viewport.zoom, dpr, invalidate]);

  const rect = visibleWorldRect(viewport, size);
  const width = Math.max(rect.max.x - rect.min.x, 1) * COVERAGE;
  const depth = Math.max(rect.max.z - rect.min.z, 1) * COVERAGE;

  return (
    <mesh
      position={[viewport.center.x, 0, viewport.center.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[width, depth, 1]}
      renderOrder={-1}
      material={grid.material}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
};
