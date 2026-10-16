/**
 * Grid material with the line maths written as TypeGPU 'use gpu' functions and wired
 * into a three.js node material through `@typegpu/three` (`toTSL`). The same code
 * compiles to WGSL on WebGPU and to GLSL on the WebGL2 fallback.
 *
 * Lines are shaded from `positionWorld.xz`, so they stay put while the plane moves
 * with the camera. Coverage is a box filter in device px (like anatomy's
 * `shading/lines.ts`): the ink of a line equals its width at any zoom. In perspective
 * mode each level also fades per fragment and per axis by its on-screen spacing (the
 * same 8–20 px ramp `gridLevelAlphas` applies to the whole plane in 2D), and the grid
 * fades out away from the orbit target.
 */
import * as t3 from '@typegpu/three';
import { MeshBasicNodeMaterial, Vector2, Vector4 } from 'three/webgpu';
import { d, std } from 'typegpu';

import { FADE_END_PX, FADE_START_PX, GRID_LEVELS } from './gridLevels';
import type {
  GridMaterialHandle,
  GridMaterialOptions,
  GridUniformValues,
} from './gridMaterialTypes';

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

/**
 * Coverage of one grid level at world point `p`: lines across x and across z, each
 * weighted by its own `fade` (1, 1 in 2D).
 */
const levelCoverage = (p: d.v2f, spacing: number, widthPx: number, fade: d.v2f) => {
  'use gpu';
  return std.max(
    fade.x * lineCoverage(p.x / spacing, widthPx),
    fade.y * lineCoverage(p.y / spacing, widthPx)
  );
};

/**
 * Perspective: how much of a level shows, per axis, from its on-screen spacing (CSS px)
 * along that axis. At a grazing angle the lines that run away from the camera stay
 * while the ones across the view crowd together and fade.
 */
const spacingFade = (spacing: number, metresPerPx: d.v2f, dpr: number) => {
  'use gpu';
  const px = d.vec2f(spacing).div(std.max(metresPerPx, d.vec2f(1e-6)).mul(dpr));
  return std.smoothstep(d.vec2f(FADE_START_PX), d.vec2f(FADE_END_PX), px);
};

const NO_FADE = d.vec2f(1, 1);

/** Levels share lines (every 10 m line is also a 2 m line); composite them "over". */
const composite = (a: d.v4f) => {
  'use gpu';
  return 1 - (1 - a.x) * (1 - a.y) * (1 - a.z) * (1 - a.w);
};

export const createGridMaterialTypeGpu = ({
  perspective = false,
}: GridMaterialOptions = {}): GridMaterialHandle => {
  const levelAlpha = t3.uniform(new Vector4(), d.vec4f);
  const dpr = t3.uniform(1, d.f32);
  const target = t3.uniform(new Vector2(), d.vec2f);
  const fadeRadius = t3.uniform(1, d.f32);

  /** Each level's coverage at `p`, times its opacity, its axes weighted by `f0`…`f3`. */
  const levelInk = (p: d.v2f, f0: d.v2f, f1: d.v2f, f2: d.v2f, f3: d.v2f) => {
    'use gpu';
    const alpha = levelAlpha.$;
    const width = WIDTH_PX.mul(dpr.$);
    return d.vec4f(
      alpha.x * levelCoverage(p, SPACING.x, width.x, f0),
      alpha.y * levelCoverage(p, SPACING.y, width.y, f1),
      alpha.z * levelCoverage(p, SPACING.z, width.z, f2),
      alpha.w * levelCoverage(p, SPACING.w, width.w, f3)
    );
  };

  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.opacityNode = perspective
    ? t3.toTSL(() => {
        'use gpu';
        const p = t3.positionWorld.$.xz;
        // Metres per device px along x and along z, here.
        const w = std.fwidth(p);
        const ink = levelInk(
          p,
          spacingFade(SPACING.x, w, dpr.$),
          spacingFade(SPACING.y, w, dpr.$),
          spacingFade(SPACING.z, w, dpr.$),
          spacingFade(SPACING.w, w, dpr.$)
        );
        const radius = fadeRadius.$;
        const near = 1 - std.smoothstep(radius * 0.5, radius, std.distance(p, target.$));
        return composite(ink) * near;
      })
    : t3.toTSL(() => {
        'use gpu';
        return composite(levelInk(t3.positionWorld.$.xz, NO_FADE, NO_FADE, NO_FADE, NO_FADE));
      });

  return {
    material,
    update(values: GridUniformValues) {
      levelAlpha.node.value.set(...values.levelAlpha);
      dpr.node.value = values.dpr;
      material.color.set(values.color);
      if (values.target) target.node.value.set(values.target.x, values.target.z);
      if (values.fadeRadius !== undefined) fadeRadius.node.value = values.fadeRadius;
    },
    dispose() {
      material.dispose();
    },
  };
};
