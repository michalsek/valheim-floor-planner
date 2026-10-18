import { useFrame, useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ShadowNodeMaterial, Vector3 } from 'three/webgpu';

import { useThemeTokens } from '../../store/hooks';
import { workDatumAtom } from '../../store/session';
import { createGridMaterial } from '../grid/gridMaterial';
import { strength3d } from '../grid/gridLevels';

/** The ground planes' size (metres): far beyond any plan. */
const GROUND_SIZE = 4000;
/** Just under the floor tops on the ground, so floors cover the grid. */
const GRID_DROP = 0.02;
/** The shadow catcher sits just under the terrain (y = 0), whatever the current level. */
const CATCHER_DROP = 0.03;
/** The grid is gone this many orbit distances from the target (at least the minimum). */
const FADE_DISTANCES = 3;
const MIN_FADE_RADIUS = 30;
/**
 * While the current level is off the ground (the level plate is the work grid), the
 * ground keeps only its 2 m and 10 m lines, at this strength: a coarse reference.
 */
const RAISED_STRENGTH = 0.5;
const RAISED_LEVELS = [0, 0, 0, 1] as const;

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
 * The ground: the plan grid at the terrain (y = 0, perspective mode) and a shadow
 * catcher just under it. Neither hides what is below it. The grid fades out around the
 * orbit target; while the current level is raised (`LevelPlate` draws its grid) it
 * keeps only its coarse lines, fainter.
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
  const levelAlpha = useMemo(
    () =>
      raised
        ? strength3d(gridAlphaScale * RAISED_STRENGTH, RAISED_LEVELS)
        : strength3d(gridAlphaScale),
    [raised, gridAlphaScale]
  );

  useLayoutEffect(() => {
    grid.update({ levelAlpha, dpr, color: gridLine });
    catcher.setAlpha(shadowAlpha);
    invalidate();
  }, [grid, catcher, levelAlpha, dpr, gridLine, shadowAlpha, invalidate]);

  // Uniforms only: follows the camera on every frame drawn, without asking for more.
  useFrame(({ camera, controls }) => {
    const target = orbitTarget(controls);
    if (!target) return;
    const distance = camera.position.distanceTo(target);
    grid.update({
      levelAlpha,
      dpr,
      color: gridLine,
      target: { x: target.x, z: target.z },
      fadeRadius: Math.max(distance * FADE_DISTANCES, MIN_FADE_RADIUS),
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
        position-y={-GRID_DROP}
        rotation-x={-Math.PI / 2}
        renderOrder={-1}
        material={grid.material}
      >
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      </mesh>
    </>
  );
};
