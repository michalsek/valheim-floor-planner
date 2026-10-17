import { useFrame, useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ShadowNodeMaterial, Vector3 } from 'three/webgpu';

import { useThemeTokens } from '../../store/hooks';
import { workDatumAtom } from '../../store/session';
import { createGridMaterial } from '../grid/gridMaterial';
import { GRID_LEVELS, type GridLevelAlphas } from '../grid/gridLevels';

/** The ground planes' size (metres): far beyond any plan. */
const GROUND_SIZE = 4000;
/** Just under the floor tops at the work datum, so floors cover the grid. */
const GRID_DROP = 0.02;
/** The shadow catcher sits just under the terrain (y = 0), whatever the current level. */
const CATCHER_DROP = 0.03;
/** The grid is gone this many orbit distances from the target (at least the minimum). */
const FADE_DISTANCES = 3;
const MIN_FADE_RADIUS = 30;
/**
 * On a level off the ground the grid is a see-through plane over the levels below it:
 * fainter, and only around the orbit target.
 */
const RAISED = { strength: 0.4, fadeDistances: 1, minFadeRadius: 8 } as const;

/**
 * Each level's strength in 3D, relative to 2D: the 10 m lines are toned down, since at
 * mid distance (where the finer levels have faded) they would otherwise dominate.
 */
const LEVEL_SCALE_3D = [1, 1, 1, 0.6] as const;

const fullStrength = (scale: number): GridLevelAlphas => {
  const [a, b, c, d] = GRID_LEVELS.map((level, i) =>
    Math.min(1, level.strength * scale * LEVEL_SCALE_3D[i]!)
  );
  return [a ?? 0, b ?? 0, c ?? 0, d ?? 0];
};

/** A see-through ground that only shows the shadows cast on it. */
const createCatcher = () => {
  const material = new ShadowNodeMaterial({ depthWrite: false });
  return {
    material,
    setAlpha(alpha: number) {
      material.opacity = alpha;
    },
  };
};

/** What the controls orbit around (`OrbitRig` registers them with r3f). */
const orbitTarget = (controls: unknown): Vector3 | null =>
  controls &&
  typeof controls === 'object' &&
  'target' in controls &&
  controls.target instanceof Vector3
    ? controls.target
    : null;

/**
 * The ground: the plan grid on the work plane (the current level, perspective mode)
 * and a shadow catcher just under the terrain. Neither hides what is below it, so a
 * floor's thickness and the levels under the current one show. The grid fades out
 * around the orbit target.
 */
export const Ground = () => {
  const datum = useAtomValue(workDatumAtom);
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const [grid] = useState(() => createGridMaterial({ perspective: true }));
  const [catcher] = useState(createCatcher);
  const { gridLine, gridAlphaScale, shadowAlpha } = useThemeTokens();

  useEffect(
    () => () => {
      grid.dispose();
      catcher.material.dispose();
    },
    [grid, catcher]
  );

  const raised = datum !== 0;
  const alphaScale = gridAlphaScale * (raised ? RAISED.strength : 1);

  useLayoutEffect(() => {
    grid.update({ levelAlpha: fullStrength(alphaScale), dpr, color: gridLine });
    catcher.setAlpha(shadowAlpha);
    invalidate();
  }, [grid, catcher, alphaScale, dpr, gridLine, shadowAlpha, invalidate]);

  // Uniforms only: follows the camera on every frame drawn, without asking for more.
  useFrame(({ camera, controls }) => {
    const target = orbitTarget(controls);
    if (!target) return;
    const distance = camera.position.distanceTo(target);
    const fadeRadius = raised
      ? Math.max(distance * RAISED.fadeDistances, RAISED.minFadeRadius)
      : Math.max(distance * FADE_DISTANCES, MIN_FADE_RADIUS);
    grid.update({
      levelAlpha: fullStrength(alphaScale),
      dpr,
      color: gridLine,
      target: { x: target.x, z: target.z },
      fadeRadius,
    });
  });

  return (
    <>
      <mesh
        position-y={-CATCHER_DROP}
        rotation-x={-Math.PI / 2}
        renderOrder={-2}
        material={catcher.material}
        receiveShadow
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      </mesh>
      <mesh
        position-y={datum - GRID_DROP}
        rotation-x={-Math.PI / 2}
        renderOrder={-1}
        material={grid.material}
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      </mesh>
    </>
  );
};
