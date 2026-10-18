import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { mix, texture, uniform, uv } from 'three/tsl';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  type Group,
  LinearFilter,
  LineBasicNodeMaterial,
  MeshBasicNodeMaterial,
  RGFormat,
  Sphere,
  Vector3,
} from 'three/webgpu';

import { contourSegments } from '../model/terrain/contours';
import { hillshade } from '../model/terrain/hillshade';
import { worldToPlan } from '../model/terrain/siteTerrain';
import type { TerrainTile } from '../model/terrain/siteTiles';
import { useThemeTokens, useViewport } from '../store/hooks';
import { groundTiles, useShownSiteTerrain, type SiteGround } from '../store/siteTerrain';
import { terrainOpacityAtom } from '../store/terrainOpacity';

import { usePrewarm } from './usePrewarm';
import { useRelease } from './useRelease';

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

/**
 * Each tile's lines by tile key and interval, least recently used first: a new site
 * (an extension, an undo) traces only the tiles that changed.
 */
const tileLines = new Map<string, Float32Array>();
/** Floats of tile lines kept beyond the shown site's (for undo, redo and other sites). */
const KEEP_EXTRA = 4_000_000;

/** One tile's lines at `set`, in the plan. */
const tileContours = (ground: SiteGround, tile: TerrainTile, set: ContourSet): Float32Array => {
  const key = `${tile.key}:${set.step}`;
  let positions = tileLines.get(key);
  if (positions) {
    tileLines.delete(key);
  } else {
    const world = contourSegments(ground.grid, set.step, set.except, tile);
    // World → plan is affine: one turn for the patch's corner and axes, not per point.
    const { x0, z0 } = ground.grid;
    const base = worldToPlan(ground.frame, { x: x0, z: z0 });
    const ax = worldToPlan(ground.frame, { x: x0 + 1, z: z0 });
    const az = worldToPlan(ground.frame, { x: x0, z: z0 + 1 });
    positions = new Float32Array((world.length / 2) * 3);
    for (let k = 0; k < world.length / 2; k++) {
      const u = world[2 * k]! - x0;
      const w = world[2 * k + 1]! - z0;
      positions[3 * k] = base.x + u * (ax.x - base.x) + w * (az.x - base.x);
      positions[3 * k + 1] = CONTOUR_Y;
      positions[3 * k + 2] = base.z + u * (ax.z - base.z) + w * (az.z - base.z);
    }
  }
  tileLines.set(key, positions);
  return positions;
};

/** Drops the least recently used tile lines not in `keep` beyond `KEEP_EXTRA` floats. */
const evictTileLines = (keep: ReadonlySet<string>) => {
  let extra = 0;
  for (const [key, lines] of tileLines) if (!keep.has(key)) extra += lines.length;
  for (const [key, lines] of tileLines) {
    if (extra <= KEEP_EXTRA) break;
    if (keep.has(key)) continue;
    extra -= lines.length;
    tileLines.delete(key);
  }
};

const contourPositions = (ground: SiteGround, set: ContourSet): Float32Array => {
  let sets = contourCache.get(ground);
  if (!sets) contourCache.set(ground, (sets = new Map()));
  let positions = sets.get(set.step);
  if (!positions) {
    const tiles = groundTiles(ground);
    const parts = tiles.map((tile) => tileContours(ground, tile, set));
    positions = new Float32Array(parts.reduce((n, part) => n + part.length, 0));
    let at = 0;
    for (const part of parts) {
      positions.set(part, at);
      at += part.length;
    }
    sets.set(set.step, positions);
    evictTileLines(
      new Set(CONTOURS.flatMap(({ step }) => tiles.map((tile) => `${tile.key}:${step}`)))
    );
  }
  return positions;
};

/** A sphere holding the patch in the plan (at the contours' height). */
const patchSphere = ({ grid, frame }: SiteGround): Sphere => {
  const { x0, z0, cols, rows } = grid;
  const centre = worldToPlan(frame, { x: x0 + (cols - 1) / 2, z: z0 + (rows - 1) / 2 });
  return new Sphere(new Vector3(centre.x, CONTOUR_Y, centre.z), Math.hypot(cols, rows) / 2);
};

const disposeGeometry = (geometry: BufferGeometry) => geometry.dispose();

/** A line material's colour and opacity (uniforms). */
const styleLines = (material: LineBasicNodeMaterial, color: string, opacity: number) => {
  material.color.set(color);
  material.opacity = opacity;
};

/** One interval's contour lines, in the theme's contour colour, faded with the relief. */
const Contours = ({
  ground,
  set,
  opacity,
}: {
  ground: SiteGround;
  set: ContourSet;
  opacity: number;
}) => {
  const invalidate = useThree((s) => s.invalidate);
  const { terrain } = useThemeTokens();
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    // The array itself (not a copy), and the patch's bounds: no pass over the lines.
    g.setAttribute('position', new BufferAttribute(contourPositions(ground, set), 3));
    g.boundingSphere = patchSphere(ground);
    return g;
  }, [ground, set]);
  const [material] = useState(
    () => new LineBasicNodeMaterial({ transparent: true, opacity: set.opacity, depthWrite: false })
  );
  useRelease(geometry, disposeGeometry);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    styleLines(material, terrain.contour, set.opacity * opacity);
    invalidate();
  }, [material, terrain.contour, set, opacity, invalidate]);
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
 * The relief's materials: the theme's shade and light colours mixed by the hillshade,
 * then the water colour where the ground is under the sea; solid, and a see-through twin
 * for an opacity below 1 (an underlay under the canvas shows through it). A theme switch
 * or the slider only sets uniforms.
 */
const createReliefMaterials = (map: DataTexture) => {
  const shade = uniform(new Color());
  const light = uniform(new Color());
  const water = uniform(new Color());
  const texel = texture(map, uv());
  const colorNode = mix(mix(shade, light, texel.r), water, texel.g.mul(WATER_MIX));
  const material = new MeshBasicNodeMaterial();
  material.colorNode = colorNode;
  const seeThrough = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  seeThrough.colorNode = colorNode;
  return { material, seeThrough, shade, light, water };
};

type ReliefMaterials = ReturnType<typeof createReliefMaterials>;

/** The theme's relief colours and the see-through twin's opacity (uniforms). */
const styleRelief = (
  relief: ReliefMaterials,
  colors: { shade: string; light: string; water: string },
  opacity: number
) => {
  relief.shade.value.set(colors.shade);
  relief.light.value.set(colors.light);
  relief.water.value.set(colors.water);
  relief.seeThrough.opacity = opacity;
};

const disposeRelief = (resources: {
  map: DataTexture;
  quad: BufferGeometry;
  material: MeshBasicNodeMaterial;
  seeThrough: MeshBasicNodeMaterial;
}) => {
  resources.map.dispose();
  resources.quad.dispose();
  resources.material.dispose();
  resources.seeThrough.dispose();
};

const Relief = ({ ground, opacity }: { ground: SiteGround; opacity: number }) => {
  const invalidate = useThree((s) => s.invalidate);
  const { terrain } = useThemeTokens();
  const resources = useMemo(() => {
    const map = reliefTexture(ground);
    return { map, quad: reliefQuad(ground), ...createReliefMaterials(map) };
  }, [ground]);
  useRelease(resources, disposeRelief);
  useLayoutEffect(() => {
    styleRelief(resources, terrain, opacity);
    invalidate();
  }, [resources, terrain, opacity, invalidate]);
  const root = useRef<Group>(null);
  usePrewarm(root, resources);
  return (
    <group ref={root}>
      <mesh
        geometry={resources.quad}
        material={resources.material}
        visible={opacity >= 1}
        renderOrder={-3}
      />
      <mesh
        geometry={resources.quad}
        material={resources.seeThrough}
        visible={opacity < 1 && opacity > 0}
        renderOrder={-3}
      />
    </group>
  );
};

/**
 * A site's ground in 2D, under the grid: the hillshade (lit from the plan's upper left)
 * with the sea tinted, and contour lines at plan heights (so the 0 line is datum 0),
 * thinning as the view zooms out: 5 m always, 1 m from 3 px/m, 0.5 m from 12 px/m.
 * Both fade with the terrain's opacity (the slider beside the Terrain toggle).
 */
export const Terrain2d = () => {
  const ground = useShownSiteTerrain();
  const { zoom } = useViewport();
  const opacity = useAtomValue(terrainOpacityAtom);
  if (!ground) return null;
  return (
    <>
      <Relief ground={ground} opacity={opacity} />
      {CONTOURS.filter((set) => zoom >= set.minZoom).map((set) => (
        <Contours key={set.step} ground={ground} set={set} opacity={opacity} />
      ))}
    </>
  );
};
