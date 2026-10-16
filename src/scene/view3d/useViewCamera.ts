import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useState } from 'react';
import { PerspectiveCamera } from 'three/webgpu';

import { clipPlanes } from './orbitMath';

/** Vertical field of view of the 3D camera, in degrees. */
export const VIEW_FOV = 45;

/**
 * The 3D view's perspective camera, made r3f's default camera while mounted (the
 * orthographic plan camera comes back on unmount), with its aspect kept to the canvas.
 * r3f only updates the default camera on resize, so the aspect is set here too.
 */
export const useViewCamera = (): PerspectiveCamera => {
  const get = useThree((s) => s.get);
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const [camera] = useState(() => new PerspectiveCamera(VIEW_FOV, 1, 0.1, 1000));

  useLayoutEffect(() => {
    const previous = get().camera;
    set({ camera });
    return () => set({ camera: previous });
  }, [camera, get, set]);

  useLayoutEffect(() => {
    setAspect(camera, size.width / Math.max(size.height, 1));
    invalidate();
  }, [camera, size, invalidate]);

  return camera;
};

const setAspect = (camera: PerspectiveCamera, aspect: number) => {
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
};

/** Sets depth planes for a camera `distance` from its target (see `clipPlanes`). */
export const fitClipPlanes = (camera: PerspectiveCamera, distance: number, radius: number) => {
  const { near, far } = clipPlanes(distance, radius);
  camera.near = near;
  camera.far = far;
  camera.updateProjectionMatrix();
};
