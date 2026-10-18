import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MeshLambertNodeMaterial, type BufferGeometry, type Group } from 'three/webgpu';

import { groundAt } from '../../model/terrain/siteTerrain';
import { useThemeTokens } from '../../store/hooks';
import type { SiteGround } from '../../store/siteTerrain';
import { terrainOpacityAtom } from '../../store/terrainOpacity';
import { usePrewarm } from '../usePrewarm';
import { useRelease } from '../useRelease';
import { useDetachedFrame } from '../useDetachedFrame';

import { lowestGround, skirtGeometry, waterGeometry } from './terrainGeometry';
import { useGroundGrid } from './useGroundGrid';
import { useTerrainTiles } from './useTerrainTiles';

/** How much of the ground shows through the sea. */
const WATER_OPACITY = 0.55;
/**
 * The see-through ground first among the see-through things (its depth, then its
 * colour), then the draped grid, then the sea over it: the same order as with the
 * solid ground, which is drawn with the opaque pieces.
 */
const DEPTH_RENDER_ORDER = -4;
const SEE_THROUGH_RENDER_ORDER = -3;
const GRID_RENDER_ORDER = -1;
const WATER_RENDER_ORDER = 0;

type TerrainGeometry = ReturnType<typeof createGeometry>;

/** The skirts and the sea (the surface is in tiles: `useTerrainTiles`). */
const createGeometry = (ground: SiteGround) => ({
  skirt: skirtGeometry(ground),
  water: waterGeometry(ground),
});

const disposeGeometry = (geometry: TerrainGeometry) => {
  geometry.skirt.dispose();
  geometry.water?.dispose();
};

/**
 * The solid ground (as M16 drew it), and the see-through ground below an opacity of 1:
 * a depth-only pass that keeps the nearest ground (so hills don't show through each
 * other), then its colour blended over what is under it with an `opacity` uniform. Both
 * are made up front, so the slider only sets uniforms and visibility.
 */
const createMaterials = () => ({
  ground: new MeshLambertNodeMaterial({ vertexColors: true }),
  depth: new MeshLambertNodeMaterial({ vertexColors: true, transparent: true, colorWrite: false }),
  seeThrough: new MeshLambertNodeMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  }),
  water: new MeshLambertNodeMaterial({
    transparent: true,
    opacity: WATER_OPACITY,
    depthWrite: false,
  }),
});

type TerrainMaterials = ReturnType<typeof createMaterials>;

/** The sea's colour, and the see-through ground's and the sea's opacity (uniforms). */
const styleMaterials = (materials: TerrainMaterials, water: string, opacity: number) => {
  materials.water.color.set(water);
  materials.water.opacity = WATER_OPACITY * opacity;
  materials.seeThrough.opacity = opacity;
};

const disposeMaterials = (materials: TerrainMaterials) =>
  Object.values(materials).forEach((material) => material.dispose());

/**
 * One part of the ground (the surface or the skirts): solid at opacity 1, casting
 * shadows when `castShadow`; see-through below it, casting none (so what is under the
 * ground is lit); gone at 0.
 */
const GroundPart = ({
  geometry,
  materials,
  opacity,
  castShadow = false,
}: {
  geometry: BufferGeometry;
  materials: TerrainMaterials;
  opacity: number;
  castShadow?: boolean;
}) => {
  const solid = opacity >= 1;
  const seeThrough = !solid && opacity > 0;
  return (
    <>
      <mesh
        geometry={geometry}
        material={materials.ground}
        visible={solid}
        castShadow={castShadow}
        receiveShadow
      />
      <mesh
        geometry={geometry}
        material={materials.depth}
        visible={seeThrough}
        renderOrder={DEPTH_RENDER_ORDER}
      />
      <mesh
        geometry={geometry}
        material={materials.seeThrough}
        visible={seeThrough}
        renderOrder={SEE_THROUGH_RENDER_ORDER}
        receiveShadow
      />
    </>
  );
};

/**
 * A site's ground in 3D, in place of the flat ground: the surface in tiles (biome tints,
 * rock on steep slopes; casting and taking shadows), earth skirts down its edges, the sea where
 * the ground dips under it, and the plan grid draped over the surface. The grid is
 * always the coarse reference: with terrain, the level plate is the work plane at every
 * level, the ground included.
 *
 * From under the ground the surface and its grid are left out, so the build's underside
 * and foundations show (back faces alone would still draw slivers of far slopes that
 * face the camera). The skirts stay: they outline the block.
 *
 * The Terrain slider fades all of it (`terrainOpacityAtom`): the ground goes see-through
 * (`GroundPart`), and the draped grid and the sea fade with it.
 */
export const Terrain3d = ({ ground }: { ground: SiteGround }) => {
  const invalidate = useThree((s) => s.invalidate);
  const { terrain: colors } = useThemeTokens();
  const opacity = useAtomValue(terrainOpacityAtom);
  const [materials] = useState(createMaterials);
  const grid = useGroundGrid({ coarse: true, draped: true, opacity });
  const geometry = useMemo(() => createGeometry(ground), [ground]);
  useRelease(geometry, disposeGeometry);
  const tiles = useTerrainTiles(ground);
  const lowest = useMemo(() => lowestGround(ground), [ground]);
  const surface = useRef<Group>(null);
  const root = useRef<Group>(null);
  // The see-through ground's pipelines, ready before the slider first leaves 1 (one tile
  // is enough: they all share them).
  usePrewarm(root, tiles.length > 0 ? geometry : null);

  // Before every frame drawn: hide the surface while the camera is under the ground
  // (under its lowest point off the patch). Visibility only: no new pipelines.
  useDetachedFrame(({ camera }) => {
    if (!surface.current) return;
    const { x, y, z } = camera.position;
    const below = groundAt(ground.grid, ground.frame, { x, z }) ?? lowest;
    surface.current.visible = y >= below;
  });
  useEffect(() => () => disposeMaterials(materials), [materials]);

  // Uniforms only: the slider never makes a new material or pipeline.
  useLayoutEffect(() => {
    styleMaterials(materials, colors.water, opacity);
    invalidate();
  }, [materials, colors.water, opacity, invalidate]);

  return (
    <group ref={root}>
      <group ref={surface}>
        {tiles.map((tile) => (
          <group key={tile.id}>
            <GroundPart
              geometry={tile.geometry}
              materials={materials}
              opacity={opacity}
              castShadow
            />
            <mesh
              geometry={tile.geometry}
              material={grid.material}
              visible={opacity > 0}
              renderOrder={GRID_RENDER_ORDER}
            />
          </group>
        ))}
      </group>
      <GroundPart geometry={geometry.skirt} materials={materials} opacity={opacity} />
      {geometry.water && (
        <mesh
          geometry={geometry.water}
          material={materials.water}
          visible={opacity > 0}
          renderOrder={WATER_RENDER_ORDER}
        />
      )}
    </group>
  );
};
