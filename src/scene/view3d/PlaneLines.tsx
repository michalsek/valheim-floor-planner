import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicNodeMaterial,
  LineDashedNodeMaterial,
  LineSegments,
} from 'three/webgpu';

import type { Polyline } from '../../model/geometry/box';
import { segments } from '../../model/geometry/polyline';

/** Lines sit this far above their plane, over floor tops and the grid. */
const LIFT = 0.01;
/** How strong a line is where something hides it. */
const HIDDEN_OPACITY = 0.35;
/** After the pieces and ghosts: the hidden pass, then the visible one over it. */
const HIDDEN_RENDER_ORDER = 10;
const VISIBLE_RENDER_ORDER = 11;

interface PlaneLinesProps {
  lines: readonly Polyline[];
  color: string;
  /** Dash and gap length in metres; solid without. */
  dash?: number | undefined;
  /** Also show, faintly, where pieces hide them (default true). */
  throughPieces?: boolean;
}

type LineMaterial = LineBasicNodeMaterial | LineDashedNodeMaterial;

const createMaterial = (dashed: boolean, hidden: boolean): LineMaterial => {
  const options = hidden
    ? { transparent: true, opacity: HIDDEN_OPACITY, depthTest: false, depthWrite: false }
    : { depthWrite: false };
  return dashed ? new LineDashedNodeMaterial(options) : new LineBasicNodeMaterial(options);
};

/** Two passes over one geometry: depth tested at full strength, and faint where hidden. */
const createLines = (dashed: boolean) => {
  const geometry = new BufferGeometry();
  const visible = new LineSegments(geometry, createMaterial(dashed, false));
  const hidden = new LineSegments(geometry, createMaterial(dashed, true));
  return { geometry, visible, hidden, objects: [visible, hidden] as const };
};

type Lines = ReturnType<typeof createLines>;

const positionsOf = (lines: readonly Polyline[]): number[] =>
  lines.flatMap((line) =>
    segments(line.points, line.closed).flatMap(({ a, b }) => [a.x, LIFT, a.z, b.x, LIFT, b.z])
  );

const setPositions = (lines: Lines, positions: number[]) => {
  lines.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  lines.geometry.computeBoundingSphere();
  // Dashes are laid out along each segment's distances (the attribute is shared).
  lines.visible.computeLineDistances();
};

const setStyle = (lines: Lines, color: string, dash: number | undefined) => {
  for (const object of lines.objects) {
    const material = object.material as LineMaterial;
    material.color.set(color);
    if (material instanceof LineDashedNodeMaterial && dash !== undefined) {
      material.dashSize = dash;
      material.gapSize = dash;
    }
  }
};

const LinesPair = ({ lines, color, dash, throughPieces = true }: PlaneLinesProps) => {
  const invalidate = useThree((s) => s.invalidate);
  const [pair] = useState(() => createLines(dash !== undefined));

  useLayoutEffect(() => {
    setPositions(pair, positionsOf(lines));
    invalidate();
  }, [pair, lines, invalidate]);

  useLayoutEffect(() => {
    setStyle(pair, color, dash);
    invalidate();
  }, [pair, color, dash, invalidate]);

  useEffect(
    () => () => {
      pair.geometry.dispose();
      pair.objects.forEach((object) => (object.material as LineMaterial).dispose());
    },
    [pair]
  );

  return (
    <>
      {throughPieces && (
        <primitive object={pair.hidden} renderOrder={HIDDEN_RENDER_ORDER} frustumCulled={false} />
      )}
      <primitive object={pair.visible} renderOrder={VISIBLE_RENDER_ORDER} frustumCulled={false} />
    </>
  );
};

/**
 * Polylines on the plane at y = 0 of the enclosing group (the work plane), 1 px wide.
 * Where pieces hide them they still show, faintly, so a line behind a wall is found
 * but doesn't read as being on its face. The GPU clips them at the camera, which an
 * SVG overlay can't do.
 */
export const PlaneLines = (props: PlaneLinesProps) => (
  // Solid and dashed lines are different materials.
  <LinesPair key={props.dash === undefined ? 'solid' : 'dashed'} {...props} />
);
