import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useState } from 'react';

import type { Polyline } from '../../model/geometry/box';

import {
  createLines,
  disposeLines,
  HIDDEN_RENDER_ORDER,
  planePositions,
  setPositions,
  setStyle,
  VISIBLE_RENDER_ORDER,
} from './lineObjects';

interface PlaneLinesProps {
  lines: readonly Polyline[];
  color: string;
  /** Dash and gap length in metres; solid without. */
  dash?: number | undefined;
  /** Also show, faintly, where pieces hide them (default true). */
  throughPieces?: boolean;
}

const LinesPair = ({ lines, color, dash, throughPieces = true }: PlaneLinesProps) => {
  const invalidate = useThree((s) => s.invalidate);
  const [pair] = useState(() => createLines(dash !== undefined));

  useLayoutEffect(() => {
    setPositions(pair, planePositions(lines));
    invalidate();
  }, [pair, lines, invalidate]);

  useLayoutEffect(() => {
    setStyle(pair, color, dash);
    invalidate();
  }, [pair, color, dash, invalidate]);

  useEffect(() => () => disposeLines(pair), [pair]);

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
 * Polylines on the plane at y = 0 of the enclosing group, 1 px wide.
 * Where pieces hide them they still show, faintly, so a line behind a wall is found
 * but doesn't read as being on its face. The GPU clips them at the camera, which an
 * SVG overlay can't do.
 */
export const PlaneLines = (props: PlaneLinesProps) => (
  // Solid and dashed lines are different materials.
  <LinesPair key={props.dash === undefined ? 'solid' : 'dashed'} {...props} />
);
