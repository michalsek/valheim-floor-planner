import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { MeshLambertNodeMaterial } from 'three/webgpu';

import { useThemeTokens } from '../../store/hooks';
import type { SiteGround } from '../../store/siteTerrain';
import { useRelease } from '../useRelease';

import { surfaceGeometry, skirtGeometry, waterGeometry } from './terrainGeometry';
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
 */
export const Terrain3d = ({ ground }: { ground: SiteGround }) => {
  const invalidate = useThree((s) => s.invalidate);
  const { terrain: colors } = useThemeTokens();
  const [materials] = useState(createMaterials);
  const grid = useGroundGrid({ coarse: true, draped: true });
  const geometry = useMemo(() => createGeometry(ground), [ground]);
  useRelease(geometry, disposeGeometry);
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
      <mesh geometry={geometry.surface} material={materials.ground} castShadow receiveShadow />
      <mesh geometry={geometry.skirt} material={materials.ground} receiveShadow />
      <mesh geometry={geometry.surface} material={grid.material} renderOrder={GRID_RENDER_ORDER} />
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
