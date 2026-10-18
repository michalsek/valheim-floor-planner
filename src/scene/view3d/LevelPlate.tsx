import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';

import { boxOutline, boxSize, type WorldBox } from '../../model/geometry/box';
import type { Bounds3 } from '../../model/geometry/bounds3';
import { useThemeTokens } from '../../store/hooks';
import { DEFAULT_PLATE_FROST, plateFrostAtom } from '../../store/plateFrost';
import { workDatumAtom } from '../../store/session';
import { createGridMaterial } from '../grid/gridMaterial';
import { strength3d } from '../grid/gridLevels';

import { plateRect } from './plateRect';
import { Collapsed } from './Collapsed';
import { PlaneLines } from './PlaneLines';
import { usePlateShown, usePreviewLevel } from './useLevelShading';

/** Just under the current level's floor tops, as the ground grid is under the ground's. */
const PLATE_DROP = 0.02;
/**
 * The plate's grid, relative to the ground grid's full 3D strength, from a frost of
 * `GRID_FULL_FROST` up (M15's tuning); below that it fades with the frost's square
 * root (linear left it too faint at the default 0.2), to nothing at 0.
 */
const PLATE_GRID_STRENGTH = 0.35;
const GRID_FULL_FROST = 0.4;
/** The plate's grid doesn't fade with distance: the plate itself bounds it. */
const NO_FADE_RADIUS = 1e6;
/** Dash and gap (metres) of a previewed level's outline. */
const PREVIEW_DASH = 0.5;
/** The fill under the plate's grid; both after the opaque pieces. */
const FILL_RENDER_ORDER = 1;
const GRID_RENDER_ORDER = 2;

const createFill = () =>
  new MeshBasicNodeMaterial({
    transparent: true,
    opacity: DEFAULT_PLATE_FROST,
    depthWrite: false,
    side: DoubleSide,
  });

/** The fill's colour and opacity (uniforms: no new pipeline). */
const styleFill = (fill: MeshBasicNodeMaterial, color: string, opacity: number) => {
  fill.color.set(color);
  fill.opacity = opacity;
};

/** The plate grid's strength at `frost` (the fill's opacity). */
const gridStrength = (frost: number): number =>
  PLATE_GRID_STRENGTH * Math.sqrt(Math.min(frost / GRID_FULL_FROST, 1));

/**
 * The grid, frosted fill and edge of the plate at the current level. The frost (the
 * Levels bar's slider) sets the fill's opacity and the grid's strength as uniforms,
 * live, without a new material.
 */
const Plate = ({ rect }: { rect: WorldBox }) => {
  const dpr = useThree((s) => s.viewport.dpr);
  const invalidate = useThree((s) => s.invalidate);
  const { gridLine, gridAlphaScale, canvas, ink } = useThemeTokens();
  const frost = useAtomValue(plateFrostAtom);
  const [grid] = useState(() => {
    const handle = createGridMaterial({ perspective: true });
    handle.material.side = DoubleSide;
    return handle;
  });
  const [fill] = useState(createFill);
  useEffect(
    () => () => {
      grid.dispose();
      fill.dispose();
    },
    [grid, fill]
  );

  const { size, centre } = useMemo(() => {
    const size = boxSize(rect);
    return { size, centre: { x: rect.min.x + size.x / 2, z: rect.min.z + size.z / 2 } };
  }, [rect]);
  useLayoutEffect(() => {
    grid.update({
      levelAlpha: strength3d(gridAlphaScale * gridStrength(frost)),
      dpr,
      color: gridLine,
      target: centre,
      fadeRadius: NO_FADE_RADIUS,
    });
    styleFill(fill, canvas, frost);
    invalidate();
  }, [grid, fill, gridAlphaScale, dpr, gridLine, canvas, centre, frost, invalidate]);

  const edge = useMemo(() => [boxOutline(rect)], [rect]);
  return (
    <>
      <group position={[centre.x, -PLATE_DROP, centre.z]} rotation-x={-Math.PI / 2}>
        <mesh renderOrder={FILL_RENDER_ORDER} material={fill} frustumCulled={false}>
          <planeGeometry args={[size.x, size.z]} />
        </mesh>
        <mesh renderOrder={GRID_RENDER_ORDER} material={grid.material} frustumCulled={false}>
          <planeGeometry args={[size.x, size.z]} />
        </mesh>
      </group>
      <PlaneLines lines={edge} color={ink.accent} />
    </>
  );
};

/**
 * The work plane made visible in 3D: off the ground (and at every level over shown
 * terrain, `usePlateShown`), a frosted plate at the current level over the plan (its
 * grid, a canvas-coloured fill that what is below shows through, an accent edge); and
 * a dashed outline at the level the Levels bar previews. Their tags are `LevelTags3d`.
 */
export const LevelPlate = ({ bounds }: { bounds: Bounds3 | null }) => {
  const datum = useAtomValue(workDatumAtom);
  const preview = usePreviewLevel();
  const shown = usePlateShown();
  const { ink } = useThemeTokens();
  const rect = useMemo(() => plateRect(bounds), [bounds]);
  const outline = useMemo(() => [boxOutline(rect)], [rect]);
  return (
    <>
      <group position-y={datum}>
        <Collapsed shown={shown}>
          <Plate rect={rect} />
        </Collapsed>
      </group>
      <group position-y={preview ?? 0}>
        <Collapsed shown={preview !== null}>
          <PlaneLines lines={outline} color={ink.accent} dash={PREVIEW_DASH} />
        </Collapsed>
      </group>
    </>
  );
};
