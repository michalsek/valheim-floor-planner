/**
 * Fallback, not imported: the same grid maths in plain TSL, in case the TypeGPU path
 * breaks (swap the export in `gridMaterial.ts`).
 */
import {
  Fn,
  abs,
  clamp,
  float,
  fract,
  fwidth,
  max,
  min,
  positionWorld,
  round,
  uniform,
} from 'three/tsl';
import { MeshBasicNodeMaterial, Vector4, type Node } from 'three/webgpu';

import { GRID_LEVELS } from './gridLevels';
import type { GridMaterialHandle, GridUniformValues } from './gridMaterialTypes';

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

export const createGridMaterialTsl = (): GridMaterialHandle => {
  const levelAlpha = uniform(new Vector4());
  const dpr = uniform(1);

  const opacity = Fn(() => {
    const p = positionWorld.xz;
    const alphas = [levelAlpha.x, levelAlpha.y, levelAlpha.z, levelAlpha.w];
    let transmitted: FloatNode = float(1);
    GRID_LEVELS.forEach((level, i) => {
      const width = dpr.mul(level.widthPx);
      const coverage = max(
        lineCoverage(p.x.div(level.spacing), width),
        lineCoverage(p.y.div(level.spacing), width)
      );
      // Levels share lines (every 10 m line is also a 2 m line); composite them "over".
      transmitted = transmitted.mul(float(1).sub(alphas[i]!.mul(coverage)));
    });
    return float(1).sub(transmitted);
  });

  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.opacityNode = opacity();

  return {
    material,
    update(values: GridUniformValues) {
      levelAlpha.value.set(...values.levelAlpha);
      dpr.value = values.dpr;
      material.color.set(values.color);
    },
    dispose() {
      material.dispose();
    },
  };
};
