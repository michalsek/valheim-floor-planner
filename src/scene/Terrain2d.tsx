import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { mix, texture, uniform, uv } from 'three/tsl';
import {
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  LineBasicNodeMaterial,
  MeshBasicNodeMaterial,
  RGFormat,
} from 'three/webgpu';

import { contourSegments } from '../model/terrain/contours';
import { hillshade } from '../model/terrain/hillshade';
import { worldToPlan } from '../model/terrain/siteTerrain';
import { useThemeTokens, useViewport } from '../store/hooks';
import { useShownSiteTerrain, type SiteGround } from '../store/siteTerrain';

/** Under the level-below ghosts (−0.2) and everything else; contours just over it. */
const RELIEF_Y = -0.3;
const CONTOUR_Y = -0.25;
/** How much the water colour covers ground under the sea. */
const WATER_MIX = 0.6;

/** The contour sets: interval, the coarser interval it leaves out, from what zoom, how strong. */
const CONTOURS = [
  { step: 0.5, except: 1, minZoom: 12, opacity: 0.25 },
  { step: 1, except: 5, minZoom: 3, opacity: 0.45 },
  { step: 5, except: null, minZoom: 0, opacity: 0.7 },
] as const;

type ContourSet = (typeof CONTOURS)[number];

/** Contour line end points in the plan (x, y, z), per site and interval, made once. */
const contourCache = new WeakMap<SiteGround, Map<number, Float32Array>>();

const contourPositions = (ground: SiteGround, { step, except }: ContourSet): Float32Array => {
  let sets = contourCache.get(ground);
  if (!sets) contourCache.set(ground, (sets = new Map()));
  let positions = sets.get(step);
  if (!positions) {
    const world = contourSegments(ground.grid, step, except);
    positions = new Float32Array((world.length / 2) * 3);
    for (let k = 0; k < world.length / 2; k++) {
      const p = worldToPlan(ground.frame, { x: world[2 * k]!, z: world[2 * k + 1]! });
      positions.set([p.x, CONTOUR_Y, p.z], 3 * k);
    }
    sets.set(step, positions);
  }
  return positions;
};

/** One interval's contour lines, in the theme's contour colour. */
const Contours = ({ ground, set }: { ground: SiteGround; set: ContourSet }) => {
  const invalidate = useThree((s) => s.invalidate);
  const { terrain } = useThemeTokens();
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(contourPositions(ground, set), 3));
    return g;
  }, [ground, set]);
  const [material] = useState(
    () => new LineBasicNodeMaterial({ transparent: true, opacity: set.opacity, depthWrite: false })
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    material.color.set(terrain.contour);
    invalidate();
  }, [material, terrain.contour, invalidate]);
  return <lineSegments geometry={geometry} material={material} renderOrder={-2} />;
};

/** The hillshade as a texture: shade in red, water in green, one texel per vertex. */
const reliefTexture = ({ grid, frame }: SiteGround): DataTexture => {
  const map = new DataTexture(hillshade(grid, frame), grid.cols, grid.rows, RGFormat);
  map.magFilter = LinearFilter;
  map.minFilter = LinearFilter;
  map.needsUpdate = true;
  return map;
};

/**
 * The quad under the patch, turned into the plan: texel centres on the vertices, so
 * it reaches half a metre past them; each corner's uv says which world corner it is
 * (the z mirror is in the mapping).
 */
const reliefQuad = ({ grid, frame }: SiteGround): BufferGeometry => {
  const { x0, z0, cols, rows } = grid;
  const corners = [
    { x: x0 - 0.5, z: z0 - 0.5, u: 0, v: 0 },
    { x: x0 + cols - 0.5, z: z0 - 0.5, u: 1, v: 0 },
    { x: x0 + cols - 0.5, z: z0 + rows - 0.5, u: 1, v: 1 },
    { x: x0 - 0.5, z: z0 + rows - 0.5, u: 0, v: 1 },
  ];
  const geometry = new BufferGeometry();
  const plan = corners.map((c) => worldToPlan(frame, c));
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      plan.flatMap((p) => [p.x, RELIEF_Y, p.z]),
      3
    )
  );
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(
      corners.flatMap((c) => [c.u, c.v]),
      2
    )
  );
  // Facing up in the plan (as the 3D surface's triangles).
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
};

/**
 * The relief's material: the theme's shade and light colours mixed by the hillshade,
 * then the water colour where the ground is under the sea. A theme switch only sets
 * uniforms.
 */
const createReliefMaterial = (map: DataTexture) => {
  const shade = uniform(new Color());
  const light = uniform(new Color());
  const water = uniform(new Color());
  const texel = texture(map, uv());
  const material = new MeshBasicNodeMaterial();
  material.colorNode = mix(mix(shade, light, texel.r), water, texel.g.mul(WATER_MIX));
  return { material, shade, light, water };
};

const Relief = ({ ground }: { ground: SiteGround }) => {
  const invalidate = useThree((s) => s.invalidate);
  const { terrain } = useThemeTokens();
  const resources = useMemo(() => {
    const map = reliefTexture(ground);
    return { map, quad: reliefQuad(ground), ...createReliefMaterial(map) };
  }, [ground]);
  useEffect(
    () => () => {
      resources.map.dispose();
      resources.quad.dispose();
      resources.material.dispose();
    },
    [resources]
  );
  useLayoutEffect(() => {
    resources.shade.value.set(terrain.shade);
    resources.light.value.set(terrain.light);
    resources.water.value.set(terrain.water);
    invalidate();
  }, [resources, terrain, invalidate]);
  return <mesh geometry={resources.quad} material={resources.material} renderOrder={-3} />;
};

/**
 * A site's ground in 2D, under the grid: the hillshade (lit from the plan's upper left)
 * with the sea tinted, and contour lines at plan heights (so the 0 line is datum 0),
 * thinning as the view zooms out: 5 m always, 1 m from 3 px/m, 0.5 m from 12 px/m.
 */
export const Terrain2d = () => {
  const ground = useShownSiteTerrain();
  const { zoom } = useViewport();
  if (!ground) return null;
  return (
    <>
      <Relief ground={ground} />
      {CONTOURS.filter((set) => zoom >= set.minZoom).map((set) => (
        <Contours key={set.step} ground={ground} set={set} />
      ))}
    </>
  );
};
