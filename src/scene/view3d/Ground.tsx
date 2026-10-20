import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ShadowNodeMaterial } from 'three/webgpu';

import { useThemeTokens } from '../../store/hooks';
import { workPlaneAtom } from '../../store/session';

import { useGroundGrid } from './useGroundGrid';

/** The ground planes' size (metres): far beyond any plan. */
const GROUND_SIZE = 4000;
/** Just under the floor tops on the ground, so floors cover the grid. */
const GRID_DROP = 0.02;
/** The shadow catcher sits just under the terrain (y = 0), whatever the work plane. */
const CATCHER_DROP = 0.03;

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

/**
 * The flat ground of a plan without (shown) terrain: the plan grid at y = 0 and a
 * shadow catcher just under it. Neither hides what is below it. The grid fades out
 * around the orbit target; while the work plane is raised (`LevelPlate` draws its
 * grid) it keeps only its coarse lines, fainter (`useGroundGrid`).
 */
export const Ground = () => {
  const plane = useAtomValue(workPlaneAtom);
  const invalidate = useThree((s) => s.invalidate);
  const grid = useGroundGrid({ coarse: plane !== 0 });
  const [catcher] = useState(createCatcher);
  const { shadowAlpha } = useThemeTokens();

  useEffect(() => () => catcher.material.dispose(), [catcher]);

  useLayoutEffect(() => {
    catcher.setAlpha(shadowAlpha);
    invalidate();
  }, [catcher, shadowAlpha, invalidate]);

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
