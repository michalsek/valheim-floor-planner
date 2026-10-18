import { useAtomValue } from 'jotai';

import { convexHull } from '../../model/geometry/convex';
import { boxCorners } from '../../model/geometry/orient';
import type { PieceBox } from '../../model/pieceBoxes';
import type { Vec2 } from '../../model/types';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';
import { pointerScreenAtom } from '../../store/session';
import type { ScreenPoint } from '../../viewport/viewportMath';

import { useGhostShades, useRemovalShades, type GhostShades } from './buildColors';
import { buildGhostAtom, buildRemovalAtom } from './buildGhost';
import { ghostLabel, removalLabel } from './buildLabel';
import { LabelLines, SnapDots } from './BuildMarks';

const FILL_OPACITY = 0.35;

/** A box's top-down outline: the hull of its corners. */
const outlineOf = (box: PieceBox): Vec2[] =>
  convexHull(boxCorners({ ...box, shape: 'box' }).map((c) => ({ x: c.x, z: c.z })));

const Footprints = ({
  boxes,
  shades,
  toScreen,
}: {
  boxes: readonly PieceBox[];
  shades: GhostShades;
  toScreen: (p: Vec2) => ScreenPoint;
}) =>
  boxes.map((box) => (
    <polygon
      key={box.key}
      points={outlineOf(box)
        .map((p) => toScreen(p))
        .map((s) => `${s.x},${s.y}`)
        .join(' ')}
      fill={shades.colorOf(box)}
      fillOpacity={FILL_OPACITY}
      stroke={shades.edge}
      strokeWidth={1.5}
    />
  ));

/**
 * 2D: the ghost's footprint in its state colour on the work plane, its snap points (the
 * manual one filled, the snapped pair ringed) and the label by the cursor; with Ctrl/⌘
 * held, the piece a click would remove (M17 §2.2).
 */
export const BuildPreview = () => {
  const ghost = useAtomValue(buildGhostAtom);
  const removal = useAtomValue(buildRemovalAtom);
  const pointer = useAtomValue(pointerScreenAtom);
  const shades = useGhostShades(ghost);
  const removalShades = useRemovalShades(removal);
  const toScreen = useWorldToScreen();
  if (removal && removalShades && pointer) {
    return (
      <g>
        <Footprints boxes={[removal.box]} shades={removalShades} toScreen={toScreen} />
        <LabelLines at={pointer} lines={[removalLabel(removal)]} />
      </g>
    );
  }
  if (!ghost || !shades || !pointer) return null;
  return (
    <g>
      <Footprints boxes={ghost.boxes} shades={shades} toScreen={toScreen} />
      <SnapDots ghost={ghost} project={toScreen} color={shades.edge} />
      <LabelLines at={pointer} lines={ghostLabel(ghost)} />
    </g>
  );
};
