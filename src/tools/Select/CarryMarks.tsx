import { useAtomValue } from 'jotai';

import { boxBounds } from '../../model/build/snapPoints';
import type { Vec3 } from '../../model/types';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';
import { projection3dAtom } from '../../store/session';
import { project3d } from '../../viewport/projection3d';
import type { ScreenPoint } from '../../viewport/viewportMath';
import { useGhostShades } from '../Build/buildColors';
import { ghostLabel } from '../Build/buildLabel';
import { LabelLines, SnapDots } from '../Build/BuildMarks';

import { selectGestureAtom } from './selectState';

/** The carried set's ghost while a snap-move is going, or null. */
const useCarryGhost = () => {
  const g = useAtomValue(selectGestureAtom);
  return g.phase === 'carrying' ? g.carry.ghost : null;
};

interface MarksProps {
  project: (p: Vec3) => ScreenPoint | null;
  /** Where the label goes; null for over the ghost's top. */
  labelAt: ScreenPoint | null;
}

/** A snap-move's snap points, snapped pair and label (support, snap, warnings). */
const CarryMarks = ({ project, labelAt }: MarksProps) => {
  const ghost = useCarryGhost();
  const shades = useGhostShades(ghost);
  if (!ghost || !shades) return null;
  const first = ghost.boxes[0]!;
  const top = Math.max(...ghost.boxes.map((box) => boxBounds(box).max.y));
  const at = labelAt ?? project({ x: first.center.x, y: top, z: first.center.z });
  return (
    <g>
      <SnapDots ghost={ghost} project={project} color={shades.edge} />
      {at && <LabelLines at={at} lines={ghostLabel(ghost)} />}
    </g>
  );
};

/** 2D: the marks from above, the label by the cursor. */
export const CarryMarks2d = () => {
  const toScreen = useWorldToScreen();
  const g = useAtomValue(selectGestureAtom);
  const pointer = g.phase === 'carrying' ? (g.carry.last?.screen ?? null) : null;
  return <CarryMarks project={toScreen} labelAt={pointer} />;
};

/** 3D: the marks where the camera sees them, the label over the ghost. */
export const CarryMarks3d = () => {
  const v = useAtomValue(projection3dAtom);
  if (!v) return null;
  return <CarryMarks project={(p) => project3d(p, v)} labelAt={null} />;
};
