import { BoxGeometry, MeshBasicNodeMaterial } from 'three/webgpu';

export interface SlabStyle {
  color: string;
  /** Below 1 the slab is see-through and writes no depth, so it hides nothing under it. */
  opacity: number;
}

/**
 * A unit box shared by every slab and one material per style key, created on demand.
 * `dispose` frees them all (as with the grid, StrictMode may reuse disposed resources;
 * three.js re-creates them).
 */
export const createSlabResources = (styleFor: (key: string) => SlabStyle) => {
  const geometry = new BoxGeometry(1, 1, 1);
  const materials = new Map<string, MeshBasicNodeMaterial>();
  const materialFor = (key: string) => {
    let m = materials.get(key);
    if (!m) {
      const { color, opacity } = styleFor(key);
      const transparent = opacity < 1;
      m = new MeshBasicNodeMaterial({ color, opacity, transparent, depthWrite: !transparent });
      materials.set(key, m);
    }
    return m;
  };
  const dispose = () => {
    geometry.dispose();
    materials.forEach((m) => m.dispose());
  };
  return { geometry, materialFor, dispose };
};
