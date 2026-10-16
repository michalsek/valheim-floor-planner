import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useState } from 'react';

import { useThemeTokens, useViewport, useViewportSize } from '../store/hooks';
import { visibleWorldRect } from '../viewport/viewportMath';

import { createGridMaterial } from './grid/gridMaterial';
import { gridLevelAlphas, type GridLevelAlphas } from './grid/gridLevels';

/** The plane covers the visible rect with margin, so resizes never show its edge. */
const COVERAGE = 1.5;

const scaleAlphas = (alphas: GridLevelAlphas, scale: number): GridLevelAlphas => {
  const [a0, a1, a2, a3] = alphas.map((a) => Math.min(1, a * scale));
  return [a0 ?? 0, a1 ?? 0, a2 ?? 0, a3 ?? 0];
};

/** A screen-filling plane on y = 0 that draws the multi-level grid in theme colours. */
export const GridPlane = () => {
  const viewport = useViewport();
  const size = useViewportSize();
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const [grid] = useState(createGridMaterial);
  const { gridLine, gridAlphaScale } = useThemeTokens();

  // StrictMode's simulated remount runs this cleanup and then keeps using the same
  // material; that's fine, three.js re-creates GPU resources for a disposed material.
  useEffect(() => () => grid.dispose(), [grid]);

  useLayoutEffect(() => {
    const levelAlpha = scaleAlphas(gridLevelAlphas(viewport.zoom), gridAlphaScale);
    grid.update({ levelAlpha, dpr, color: gridLine });
    invalidate();
  }, [grid, viewport.zoom, dpr, gridLine, gridAlphaScale, invalidate]);

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
