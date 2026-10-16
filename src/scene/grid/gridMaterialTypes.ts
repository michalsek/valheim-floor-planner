import type { Material } from 'three/webgpu';

import type { GridLevelAlphas } from './gridLevels';

export interface GridUniformValues {
  /** Opacity per grid level, in `GRID_LEVELS` order. */
  levelAlpha: GridLevelAlphas;
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
