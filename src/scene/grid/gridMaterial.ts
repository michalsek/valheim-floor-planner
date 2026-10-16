/**
 * The single swap point between the two grid shader implementations. Both produce
 * the same picture; the TSL one is the fallback if the TypeGPU path ever breaks.
 */
export { createGridMaterialTypeGpu as createGridMaterial } from './gridMaterialTypeGpu';
