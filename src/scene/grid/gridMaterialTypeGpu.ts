/**
 * Grid material with the line maths written as TypeGPU 'use gpu' functions and wired
 * into a three.js node material through `@typegpu/three` (`toTSL`). The same code
 * compiles to WGSL on WebGPU and to GLSL on the WebGL2 fallback.
 *
 * Lines are shaded from `positionWorld.xz`, so they stay put while the plane moves
 * with the camera. Coverage is a box filter in device px (like anatomy's
 * `shading/lines.ts`): the ink of a line equals its width at any zoom.
 */
import * as t3 from '@typegpu/three';
import { MeshBasicNodeMaterial, Vector4 } from 'three/webgpu';
import { d, std } from 'typegpu';

import { GRID_LEVELS } from './gridLevels';
import type { GridMaterialHandle, GridUniformValues } from './gridMaterialTypes';

const [L0, L1, L2, L3] = GRID_LEVELS;
const SPACING = d.vec4f(L0.spacing, L1.spacing, L2.spacing, L3.spacing);
const WIDTH_PX = d.vec4f(L0.widthPx, L1.widthPx, L2.widthPx, L3.widthPx);

/** Length of [lo, hi] ∩ [x − ½, x + ½]: box-filtered coverage of a 1-px pixel at x. */
const overlap = (x: number, lo: number, hi: number) => {
  'use gpu';
  return std.clamp(std.min(hi, x + 0.5) - std.max(lo, x - 0.5), 0, 1);
};

/**
 * Coverage of the grid line nearest to `c` (in grid cells) for a line `widthPx`
 * device px wide. Lines thinner than a pixel are drawn one pixel wide, fainter.
 * Lines an odd number of pixels wide move half a pixel towards +x/+z (screen
 * right/down), onto a pixel centre, so they stay crisp when their nominal position
 * is a pixel boundary (`crispLineOffset` applies the same rule to the overlay).
 */
const lineCoverage = (c: number, widthPx: number) => {
  'use gpu';
  const drawn = std.max(widthPx, 1);
  const shift = std.fract(std.round(drawn) * 0.5);
  const cellsPerPx = std.fwidth(c);
  const dist = std.abs(std.fract(c - shift * cellsPerPx + 0.5) - 0.5) / cellsPerPx;
  return (widthPx / drawn) * overlap(dist, -drawn / 2, drawn / 2);
};

/** Coverage of one grid level (lines along both axes) at world point `p`. */
const levelCoverage = (p: d.v2f, spacing: number, widthPx: number) => {
  'use gpu';
  return std.max(lineCoverage(p.x / spacing, widthPx), lineCoverage(p.y / spacing, widthPx));
};

export const createGridMaterialTypeGpu = (): GridMaterialHandle => {
  const levelAlpha = t3.uniform(new Vector4(), d.vec4f);
  const dpr = t3.uniform(1, d.f32);

  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.opacityNode = t3.toTSL(() => {
    'use gpu';
    const p = t3.positionWorld.$.xz;
    const alpha = levelAlpha.$;
    const width = WIDTH_PX.mul(dpr.$);
    const a0 = alpha.x * levelCoverage(p, SPACING.x, width.x);
    const a1 = alpha.y * levelCoverage(p, SPACING.y, width.y);
    const a2 = alpha.z * levelCoverage(p, SPACING.z, width.z);
    const a3 = alpha.w * levelCoverage(p, SPACING.w, width.w);
    // Levels share lines (every 10 m line is also a 2 m line); composite them "over".
    return 1 - (1 - a0) * (1 - a1) * (1 - a2) * (1 - a3);
  });

  return {
    material,
    update(values: GridUniformValues) {
      levelAlpha.node.value.set(...values.levelAlpha);
      dpr.node.value = values.dpr;
      material.color.set(values.color);
    },
    dispose() {
      material.dispose();
    },
  };
};
