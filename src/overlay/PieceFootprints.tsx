import { materialColor } from '../catalog/materialColors';
import { footprintCorners } from '../model/geometry/polyline';
import { groundCourse, type PlacedPiece } from '../model/types';

import { toSvgPoints } from './svgPoints';

interface PieceFootprintsProps {
  pieces: readonly PlacedPiece[];
  className: string | undefined;
  /** Stroke in the piece colour too, so thin walls keep a minimum on-screen width. */
  solid?: boolean;
}

/** Ground-course piece footprints, filled by material (world layer). */
export const PieceFootprints = ({ pieces, className, solid = false }: PieceFootprintsProps) => (
  <g>
    {groundCourse(pieces).map((piece) => {
      const color = materialColor(piece.material);
      return (
        <polygon
          key={piece.key}
          className={className}
          points={toSvgPoints(footprintCorners(piece))}
          fill={color}
          stroke={solid ? color : undefined}
          vectorEffect="non-scaling-stroke"
        />
      );
    })}
  </g>
);
