import { BoxGeometry, MeshBasicNodeMaterial } from 'three/webgpu';

export interface SlabStyle {
  color: string;
  /** Below 1 the slab is see-through and writes no depth, so it hides nothing under it. */
  opacity: number;
}

export type SlabStyler = (key: string) => SlabStyle;

const applyStyle = (m: MeshBasicNodeMaterial, { color, opacity }: SlabStyle) => {
  const transparent = opacity < 1;
  if (m.transparent !== transparent) m.needsUpdate = true;
  m.color.set(color);
  m.opacity = opacity;
  m.transparent = transparent;
  m.depthWrite = !transparent;
};

/**
 * A unit box shared by every slab and one material per style key, created on demand.
 * `restyle` swaps the styler (a theme change) and updates every cached material in
 * place. `dispose` frees them all (as with the grid, StrictMode may reuse disposed
 * resources; three.js re-creates them).
 */
export const createSlabResources = (initialStyleFor: SlabStyler) => {
  let styleFor = initialStyleFor;
  const geometry = new BoxGeometry(1, 1, 1);
  const materials = new Map<string, MeshBasicNodeMaterial>();
  const materialFor = (key: string) => {
    let m = materials.get(key);
    if (!m) {
      m = new MeshBasicNodeMaterial();
      applyStyle(m, styleFor(key));
      materials.set(key, m);
    }
    return m;
  };
  const restyle = (next: SlabStyler) => {
    styleFor = next;
    materials.forEach((m, key) => applyStyle(m, styleFor(key)));
  };
  const dispose = () => {
    geometry.dispose();
    materials.forEach((m) => m.dispose());
  };
  return { geometry, materialFor, restyle, dispose };
};
