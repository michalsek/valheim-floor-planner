import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DoubleSide, Vector3 } from 'three/webgpu';

import { useThemeTokens } from '../../store/hooks';
import { createGridMaterial } from '../grid/gridMaterial';
import { strength3d } from '../grid/gridLevels';
import type { GridMaterialHandle } from '../grid/gridMaterialTypes';

/** The grid is gone this many orbit distances from the target (at least the minimum). */
const FADE_DISTANCES = 3;
const MIN_FADE_RADIUS = 30;
/**
 * While the ground isn't the work plane (the level plate draws the work grid), it keeps
 * only its 10 m lines, at this strength: a coarse reference.
 */
const COARSE_STRENGTH = 0.5;
const COARSE_LEVELS = [0, 0, 0, 1] as const;
/**
 * Draped over the terrain, the grid is pulled towards the camera in depth (factor,
 * units), so it wins over the surface it lies on. Floors resting on the ground still
 * cover it.
 */
const DRAPE_OFFSET = [-1, -4] as const;
/** Draped, the grid is quieter still: lit, tinted ground carries it less well than a plain canvas. */
const DRAPED_STRENGTH = 0.6;

/** What the controls orbit around (`OrbitRig` registers them with r3f). */
const orbitTarget = (controls: unknown): Vector3 | null =>
  controls &&
  typeof controls === 'object' &&
  'target' in controls &&
  controls.target instanceof Vector3
    ? controls.target
    : null;

export interface GroundGridOptions {
  /** Only the coarse lines, fainter: the ground is not the work plane. */
  coarse: boolean;
  /** Drawn on the terrain's own surface (depth-offset towards the camera). */
  draped?: boolean;
}

/**
 * The 3D ground grid's material, shared by the flat ground (`Ground`) and the terrain
 * (`Terrain3d`): the theme's grid colour and strength, all levels or only the coarse
 * ones, and a fade around the orbit target that follows the camera on every frame drawn
 * (uniforms only, so it never asks for more frames).
 */
export const useGroundGrid = ({
  coarse,
  draped = false,
}: GroundGridOptions): GridMaterialHandle => {
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const [grid] = useState(() => {
    const handle = createGridMaterial({ perspective: true });
    // The flat grid also shows from under the ground (the datum seen from below); the
    // draped one doesn't, so the terrain is see-through from underneath.
    if (draped) {
      handle.material.polygonOffset = true;
      [handle.material.polygonOffsetFactor, handle.material.polygonOffsetUnits] = DRAPE_OFFSET;
    } else {
      handle.material.side = DoubleSide;
    }
    return handle;
  });
  const { gridLine, gridAlphaScale } = useThemeTokens();

  useEffect(() => () => grid.dispose(), [grid]);

  const levelAlpha = useMemo(() => {
    const scale = gridAlphaScale * (draped ? DRAPED_STRENGTH : 1);
    return coarse ? strength3d(scale * COARSE_STRENGTH, COARSE_LEVELS) : strength3d(scale);
  }, [coarse, draped, gridAlphaScale]);

  useLayoutEffect(() => {
    grid.update({ levelAlpha, dpr, color: gridLine });
    invalidate();
  }, [grid, levelAlpha, dpr, gridLine, invalidate]);

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

  return grid;
};
