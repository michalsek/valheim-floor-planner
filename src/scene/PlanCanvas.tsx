import './threeSetup';

import { Canvas } from '@react-three/fiber';
import { useSetAtom } from 'jotai';
import { useMemo } from 'react';
import { PCFShadowMap } from 'three/webgpu';

import { useViewMode } from '../store/hooks';
import { rendererBackendAtom } from '../store/session';
import { DEFAULT_VIEWPORT } from '../viewport/viewportMath';

import { createRenderer } from './createRenderer';
import { Plan2d } from './Plan2d';
import { View3d } from './view3d/View3d';

/**
 * The one canvas and renderer for both views. In 2D an orthographic camera looks
 * straight down (screen right = +x, screen down = +z) and pointer input is handled by
 * `ToolHost`; in 3D `View3d` puts in its own perspective camera and controls. Renders
 * on demand onto a transparent canvas.
 */
export const PlanCanvas = () => {
  const setBackend = useSetAtom(rendererBackendAtom);
  const gl = useMemo(() => createRenderer(setBackend), [setBackend]);

  return (
    <Canvas
      orthographic
      frameloop="demand"
      dpr={[1, 2]}
      // Set once with the renderer (switching later rebuilds every material). An
      // object keeps r3f from setting PCFSoftShadowMap, which WebGPURenderer dropped.
      shadows={{ enabled: true, type: PCFShadowMap }}
      gl={gl}
      camera={{
        position: [0, 100, 0],
        rotation: [-Math.PI / 2, 0, 0],
        zoom: DEFAULT_VIEWPORT.zoom,
        near: 0.1,
        far: 500,
      }}
      onCreated={(state) => state.invalidate()}
    >
      {useViewMode() === '3d' ? <View3d /> : <Plan2d />}
    </Canvas>
  );
};
