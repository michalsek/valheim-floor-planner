import type { Material } from 'three/webgpu';

import type { Vec2 } from '../../model/types';

import type { GridLevelAlphas } from './gridLevels';

export interface GridMaterialOptions {
  /**
   * For a perspective camera: each level fades by its on-screen spacing per fragment
   * (`levelAlpha` is then each level's full strength), and the grid fades out with
   * distance from `target`.
   */
  perspective?: boolean;
}

export interface GridUniformValues {
  /** Opacity per grid level, in `GRID_LEVELS` order. */
  levelAlpha: GridLevelAlphas;
  /** Perspective mode: the orbit target on the plane, where the grid is strongest. */
  target?: Vec2;
  /** Perspective mode: the distance from `target` (metres) at which the grid is gone. */
  fadeRadius?: number;
  /** Device pixel ratio; line widths are in device px in the shader. */
  dpr: number;
  /** Line colour (any CSS colour three.js understands). */
  color: string;
}

export interface GridMaterialHandle {
  material: Material;
  update(values: GridUniformValues): void;
  dispose(): void;
}
