import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { OrthographicCamera } from 'three/webgpu';

import { useViewport, useViewportSize } from '../store/hooks';
import { screenCentre } from '../viewport/viewportMath';

/**
 * Drives the orthographic camera from the session viewport. r3f keeps the ortho
 * frustum at ±size/2 in CSS px, so `camera.zoom` is exactly px per metre. The camera
 * looks at the exact canvas middle; it is nudged so the viewport centre lands on
 * `screenCentre` (whole px), matching the overlay maths. The frustum is set here too:
 * r3f only sets it on resize, and the canvas may have been resized while the 3D view's
 * camera was the default one.
 */
export const CameraRig = () => {
  // Read the camera inside the effect: it is a three.js object we mutate in place.
  const getState = useThree((s) => s.get);
  const viewport = useViewport();
  const size = useViewportSize();

  useLayoutEffect(() => {
    const { camera, invalidate } = getState();
    if (camera instanceof OrthographicCamera) {
      camera.left = -size.width / 2;
      camera.right = size.width / 2;
      camera.top = size.height / 2;
      camera.bottom = -size.height / 2;
    }
    const c = screenCentre(size);
    camera.position.x = viewport.center.x + (size.width / 2 - c.x) / viewport.zoom;
    camera.position.z = viewport.center.z + (size.height / 2 - c.y) / viewport.zoom;
    camera.zoom = viewport.zoom;
    camera.updateProjectionMatrix();
    invalidate();
  }, [getState, viewport, size]);

  return null;
};
