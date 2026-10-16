/**
 * Fallback, not imported: the same grid maths in plain TSL, in case the TypeGPU path
 * breaks (swap the export in `gridMaterial.ts`).
 */
import {
  Fn,
  abs,
  clamp,
  distance,
  float,
  fract,
  fwidth,
  max,
  min,
  positionWorld,
  round,
  smoothstep,
  uniform,
} from 'three/tsl';
import { MeshBasicNodeMaterial, Vector2, Vector4, type Node } from 'three/webgpu';

import { FADE_END_PX, FADE_START_PX, GRID_LEVELS } from './gridLevels';
import type {
  GridMaterialHandle,
  GridMaterialOptions,
  GridUniformValues,
} from './gridMaterialTypes';

type FloatNode = Node<'float'>;

/** Length of [lo, hi] ∩ [x − ½, x + ½]: box-filtered coverage of a 1-px pixel at x. */
const overlap = (x: FloatNode, lo: FloatNode, hi: FloatNode): FloatNode =>
  clamp(min(hi, x.add(0.5)).sub(max(lo, x.sub(0.5))), 0, 1);

/** Coverage of the grid line nearest to `c` (in grid cells); see the TypeGPU version. */
const lineCoverage = (c: FloatNode, widthPx: FloatNode): FloatNode => {
  const drawn = max(widthPx, 1);
  const shift = fract(round(drawn).mul(0.5));
  const cellsPerPx = fwidth(c);
  const dist = abs(fract(c.sub(shift.mul(cellsPerPx)).add(0.5)).sub(0.5)).div(cellsPerPx);
  return widthPx.div(drawn).mul(overlap(dist, drawn.mul(-0.5), drawn.mul(0.5)));
};

export const createGridMaterialTsl = ({
  perspective = false,
}: GridMaterialOptions = {}): GridMaterialHandle => {
  const levelAlpha = uniform(new Vector4());
  const dpr = uniform(1);
  const target = uniform(new Vector2());
  const fadeRadius = uniform(1);

  /** Perspective: how much of a level shows along an axis, from its spacing (CSS px) there. */
  const spacingFade = (c: FloatNode, spacing: number): FloatNode =>
    smoothstep(FADE_START_PX, FADE_END_PX, max(fwidth(c), 1e-6).mul(dpr).reciprocal().mul(spacing));

  const opacity = Fn(() => {
    const p = positionWorld.xz;
    const alphas = [levelAlpha.x, levelAlpha.y, levelAlpha.z, levelAlpha.w];
    let transmitted: FloatNode = float(1);
    GRID_LEVELS.forEach((level, i) => {
      const width = dpr.mul(level.widthPx);
      let across = lineCoverage(p.x.div(level.spacing), width);
      let along = lineCoverage(p.y.div(level.spacing), width);
      if (perspective) {
        // Each axis fades by its own spacing, so at a grazing angle one set of lines stays.
        across = across.mul(spacingFade(p.x, level.spacing));
        along = along.mul(spacingFade(p.y, level.spacing));
      }
      // Levels share lines (every 10 m line is also a 2 m line); composite them "over".
      transmitted = transmitted.mul(float(1).sub(alphas[i]!.mul(max(across, along))));
    });
    const ink = float(1).sub(transmitted);
    if (!perspective) return ink;
    return ink.mul(float(1).sub(smoothstep(fadeRadius.mul(0.5), fadeRadius, distance(p, target))));
  });

  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.opacityNode = opacity();

  return {
    material,
    update(values: GridUniformValues) {
      levelAlpha.value.set(...values.levelAlpha);
      dpr.value = values.dpr;
      material.color.set(values.color);
      if (values.target) target.value.set(values.target.x, values.target.z);
      if (values.fadeRadius !== undefined) fadeRadius.value = values.fadeRadius;
    },
    dispose() {
      material.dispose();
    },
  };
};
