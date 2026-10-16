import './threeSetup';

import { Canvas } from '@react-three/fiber';
import { useSetAtom } from 'jotai';
import { useMemo } from 'react';

import { rendererBackendAtom } from '../store/session';
import { DEFAULT_VIEWPORT } from '../viewport/viewportMath';

import { CameraRig } from './CameraRig';
import { createRenderer } from './createRenderer';
import { GridPlane } from './GridPlane';

/**
 * The 3D layer: an orthographic camera looking straight down (screen right = +x,
 * screen down = +z). Renders on demand onto a transparent canvas; pointer input is
 * handled by `ToolHost`.
 */
export const PlanCanvas = () => {
  const setBackend = useSetAtom(rendererBackendAtom);
  const gl = useMemo(() => createRenderer(setBackend), [setBackend]);

  return (
    <Canvas
      orthographic
      frameloop="demand"
      dpr={[1, 2]}
      // An object (not `false`) keeps r3f from setting PCFSoftShadowMap, which
      // WebGPURenderer no longer supports and warns about.
      shadows={{ enabled: false }}
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
      <CameraRig />
      <GridPlane />
    </Canvas>
  );
};
