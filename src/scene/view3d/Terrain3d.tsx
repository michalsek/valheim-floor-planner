import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MeshLambertNodeMaterial, type Group } from 'three/webgpu';

import { groundAt } from '../../model/terrain/siteTerrain';
import { useThemeTokens } from '../../store/hooks';
import type { SiteGround } from '../../store/siteTerrain';
import { useRelease } from '../useRelease';

import { lowestGround, surfaceGeometry, skirtGeometry, waterGeometry } from './terrainGeometry';
import { useGroundGrid } from './useGroundGrid';

/** How much of the ground shows through the sea. */
const WATER_OPACITY = 0.55;
/** The draped grid first among the see-through things, then the sea over it. */
const GRID_RENDER_ORDER = -1;
const WATER_RENDER_ORDER = 0;

type TerrainGeometry = ReturnType<typeof createGeometry>;

const createGeometry = (ground: SiteGround) => ({
  surface: surfaceGeometry(ground),
  skirt: skirtGeometry(ground),
  water: waterGeometry(ground),
});

const disposeGeometry = (geometry: TerrainGeometry) => {
  geometry.surface.dispose();
  geometry.skirt.dispose();
  geometry.water?.dispose();
};

const createMaterials = () => ({
  ground: new MeshLambertNodeMaterial({ vertexColors: true }),
  water: new MeshLambertNodeMaterial({
    transparent: true,
    opacity: WATER_OPACITY,
    depthWrite: false,
  }),
});

/**
 * A site's ground in 3D, in place of the flat ground: the surface (biome tints, rock on
 * steep slopes; casting and taking shadows), earth skirts down its edges, the sea where
 * the ground dips under it, and the plan grid draped over the surface. The grid is
 * always the coarse reference: with terrain, the level plate is the work plane at every
 * level, the ground included.
 *
 * From under the ground the surface and its grid are left out, so the build's underside
 * and foundations show (back faces alone would still draw slivers of far slopes that
 * face the camera). The skirts stay: they outline the block.
 */
export const Terrain3d = ({ ground }: { ground: SiteGround }) => {
  const invalidate = useThree((s) => s.invalidate);
  const { terrain: colors } = useThemeTokens();
  const [materials] = useState(createMaterials);
  const grid = useGroundGrid({ coarse: true, draped: true });
  const geometry = useMemo(() => createGeometry(ground), [ground]);
  useRelease(geometry, disposeGeometry);
  const lowest = useMemo(() => lowestGround(ground), [ground]);
  const surface = useRef<Group>(null);

  // Before every frame drawn: hide the surface while the camera is under the ground
  // (under its lowest point off the patch). Visibility only: no new pipelines.
  useFrame(({ camera }) => {
    if (!surface.current) return;
    const { x, y, z } = camera.position;
    const below = groundAt(ground.grid, ground.frame, { x, z }) ?? lowest;
    surface.current.visible = y >= below;
  });
  useEffect(
    () => () => {
      materials.ground.dispose();
      materials.water.dispose();
    },
    [materials]
  );

  useLayoutEffect(() => {
    materials.water.color.set(colors.water);
    invalidate();
  }, [materials, colors.water, invalidate]);

  return (
    <>
      <group ref={surface}>
        <mesh geometry={geometry.surface} material={materials.ground} castShadow receiveShadow />
        <mesh
          geometry={geometry.surface}
          material={grid.material}
          renderOrder={GRID_RENDER_ORDER}
        />
      </group>
      <mesh geometry={geometry.skirt} material={materials.ground} receiveShadow />
      {geometry.water && (
        <mesh
          geometry={geometry.water}
          material={materials.water}
          renderOrder={WATER_RENDER_ORDER}
        />
      )}
    </>
  );
};
