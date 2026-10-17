import { abs, fwidth, max, min, mix, positionGeometry, smoothstep, vec3 } from 'three/tsl';
import { DoubleSide, MeshLambertNodeMaterial } from 'three/webgpu';

/** Edge width (device px) and how dark edges get, so neighbouring pieces read apart. */
const EDGE_PX = 1.25;
const EDGE_SHADE = 0.55;

/**
 * A grey factor that darkens the unit box's edges. On a face, one axis sits at ±0.5;
 * the distance (in px) to the nearest edge is the second-smallest of the three
 * distances to the box faces. Shaded from `positionGeometry` (the unit box before the
 * instance transform), so it works for every instance whatever its scale; `fwidth` is
 * 0 along a face, hence the clamp.
 */
const edgeShade = () => {
  const p = positionGeometry;
  const px = vec3(0.5)
    .sub(abs(p))
    .div(max(fwidth(p), vec3(1e-6)));
  const lo = min(px.x, px.y, px.z);
  const hi = max(px.x, px.y, px.z);
  const edge = px.x.add(px.y).add(px.z).sub(lo).sub(hi);
  return vec3(mix(EDGE_SHADE, 1, smoothstep(EDGE_PX - 0.5, EDGE_PX + 0.5, edge)));
};

export interface PieceMaterialOptions {
  opacity: number;
  /**
   * Darkened unit-box edges (default true). Off for the other shapes (roof corners,
   * gable triangles): the edge shader assumes a box, and they are drawn from both sides.
   */
  edges?: boolean;
}

/**
 * The 3D pieces' material: lit, shadowed, white with darkened edges. three.js
 * multiplies `instanceColor` into the `colorNode`, so each instance brings its colour.
 * Below 1 opacity it is see-through and writes no depth (door and gate panels).
 */
export const createPieceMaterial = ({
  opacity,
  edges = true,
}: PieceMaterialOptions): MeshLambertNodeMaterial => {
  const transparent = opacity < 1;
  const material = new MeshLambertNodeMaterial({ transparent, opacity, depthWrite: !transparent });
  if (edges) material.colorNode = edgeShade();
  else material.side = DoubleSide;
  return material;
};
