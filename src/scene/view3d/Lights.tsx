import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useState } from 'react';
import { DirectionalLight } from 'three/webgpu';

import { boundsCentre, type Bounds3 } from '../../model/geometry/bounds3';

import { along, boundsRadius, directionFrom } from './orbitMath';

/** Towards the sun: from the left and behind the default camera, fairly high. */
const SUN_DIR = directionFrom(-50, 55);
/** Sky and ground colours and strengths, tuned so a lit top face reads close to 2D. */
const SKY = '#ffffff';
const GROUND = '#8f949b';
const HEMISPHERE_INTENSITY = 1.2;
const SUN_INTENSITY = 2;
/** The shadow box when the plan is empty (nothing casts then anyway). */
const EMPTY_BOUNDS: Bounds3 = { min: { x: -10, y: 0, z: -10 }, max: { x: 10, y: 2, z: 10 } };

const createSun = (): DirectionalLight => {
  const sun = new DirectionalLight(SKY, SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // Against shadow acne on the boxes' faces.
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  return sun;
};

/** Puts the sun above the plan and fits its shadow camera around `b`. */
const aimSun = (sun: DirectionalLight, b: Bounds3) => {
  const radius = boundsRadius(b);
  const centre = boundsCentre(b);
  const from = along(centre, SUN_DIR, radius * 2);
  sun.position.set(from.x, from.y, from.z);
  sun.target.position.set(centre.x, centre.y, centre.z);
  sun.target.updateMatrixWorld();
  const cam = sun.shadow.camera;
  cam.left = -radius;
  cam.right = radius;
  cam.top = radius;
  cam.bottom = -radius;
  cam.near = radius * 0.5;
  cam.far = radius * 3.5;
  cam.updateProjectionMatrix();
};

/**
 * A sky/ground hemisphere light and a shadow-casting sun. The sun's orthographic
 * shadow camera is fitted around the plan's bounds, so the whole plan casts shadows
 * (they get softer on big plans).
 */
export const Lights = ({ bounds }: { bounds: Bounds3 | null }) => {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const [sun] = useState(createSun);

  // The sun aims at its target, which must be in the scene to follow its position.
  useLayoutEffect(() => {
    scene.add(sun.target);
    return () => {
      scene.remove(sun.target);
    };
  }, [scene, sun]);

  useLayoutEffect(() => {
    aimSun(sun, bounds ?? EMPTY_BOUNDS);
    invalidate();
  }, [bounds, sun, invalidate]);

  useLayoutEffect(() => () => sun.shadow.dispose(), [sun]);

  return (
    <>
      <hemisphereLight args={[SKY, GROUND, HEMISPHERE_INTENSITY]} />
      <primitive object={sun} />
    </>
  );
};
