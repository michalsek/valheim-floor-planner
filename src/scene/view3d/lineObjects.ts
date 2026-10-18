/**
 * The 3D view's 1 px lines as three.js objects: one geometry drawn twice, depth tested
 * at full strength and faintly where something hides it. `PlaneLines` draws polylines
 * on a plane with them; `DropLine3d` a vertical guide.
 */
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
export const HIDDEN_RENDER_ORDER = 10;
export const VISIBLE_RENDER_ORDER = 11;

type LineMaterial = LineBasicNodeMaterial | LineDashedNodeMaterial;

const createMaterial = (dashed: boolean, hidden: boolean): LineMaterial => {
  const options = hidden
    ? { transparent: true, opacity: HIDDEN_OPACITY, depthTest: false, depthWrite: false }
    : { depthWrite: false };
  return dashed ? new LineDashedNodeMaterial(options) : new LineBasicNodeMaterial(options);
};

/** Two passes over one geometry: depth tested at full strength, and faint where hidden. */
export const createLines = (dashed: boolean) => {
  const geometry = new BufferGeometry();
  const materials = [createMaterial(dashed, false), createMaterial(dashed, true)] as const;
  const visible = new LineSegments(geometry, materials[0]);
  const hidden = new LineSegments(geometry, materials[1]);
  return { geometry, materials, visible, hidden };
};

export type Lines = ReturnType<typeof createLines>;

/** The segments of polylines on the plane at y = 0, as line end points (just above it). */
export const planePositions = (lines: readonly Polyline[]): number[] =>
  lines.flatMap((line) =>
    segments(line.points, line.closed).flatMap(({ a, b }) => [a.x, LIFT, a.z, b.x, LIFT, b.z])
  );

/** Sets the segments' end points (x, y, z, pairwise). */
export const setPositions = (lines: Lines, positions: number[]) => {
  lines.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  lines.geometry.computeBoundingSphere();
  // Dashes are laid out along each segment's distances (the attribute is shared).
  lines.visible.computeLineDistances();
};

/** The lines' colour, and (dashed lines) their dash and gap length in metres. */
export const setStyle = (lines: Lines, color: string, dash: number | undefined) => {
  for (const material of lines.materials) {
    material.color.set(color);
    if (material instanceof LineDashedNodeMaterial && dash !== undefined) {
      material.dashSize = dash;
      material.gapSize = dash;
    }
  }
};

export const disposeLines = (lines: Lines) => {
  lines.geometry.dispose();
  lines.materials.forEach((material) => material.dispose());
};
