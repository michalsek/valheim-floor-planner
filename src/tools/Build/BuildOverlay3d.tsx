import { useAtomValue } from 'jotai';

import { boxBounds } from '../../model/build/snapPoints';
import type { PieceBox } from '../../model/pieceBoxes';
import type { Vec3 } from '../../model/types';
import { projection3dAtom } from '../../store/session';
import { project3d } from '../../viewport/projection3d';

import { useGhostShades } from './buildColors';
import { buildGhostAtom, buildRemovalAtom } from './buildGhost';
import { ghostLabel, removalLabel } from './buildLabel';
import { LabelLines, SnapDots } from './BuildMarks';

/** The top of the boxes, above the first one's centre. */
const topOf = (boxes: readonly PieceBox[]): Vec3 => {
  const top = Math.max(...boxes.map((box) => boxBounds(box).max.y));
  return { x: boxes[0]!.center.x, y: top, z: boxes[0]!.center.z };
};

/** The Build ghost's snap points and label (M17 §2.5), or what Ctrl/⌘ + click removes. */
export const BuildOverlay3d = () => {
  const ghost = useAtomValue(buildGhostAtom);
  const removal = useAtomValue(buildRemovalAtom);
  const v = useAtomValue(projection3dAtom);
  const shades = useGhostShades(ghost);
  if (!v) return null;
  const project = (p: Vec3) => project3d(p, v);
  if (removal) {
    const at = project(topOf([removal.box]));
    return at && <LabelLines at={at} lines={[removalLabel(removal)]} />;
  }
  if (!ghost || !shades) return null;
  const at = project(topOf(ghost.boxes));
  return (
    <g>
      <SnapDots ghost={ghost} project={project} color={shades.edge} />
      {at && <LabelLines at={at} lines={ghostLabel(ghost)} />}
    </g>
  );
};
