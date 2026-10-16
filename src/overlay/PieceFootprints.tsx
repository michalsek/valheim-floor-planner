import type { CSSProperties } from 'react';

import { materialVar } from '../catalog/materialColors';
import { footprintCorners } from '../model/geometry/polyline';
import { groundCourse, type PlacedPiece } from '../model/types';

import { toSvgPoints } from './svgPoints';

/**
 * fill: in the material colour; solid: stroked in it too, so thin walls keep a minimum
 * on-screen width; none: `className` paints them (selection, hover).
 */
export type FootprintPaint = 'fill' | 'solid' | 'none';

interface PieceFootprintsProps {
  pieces: readonly PlacedPiece[];
  className: string | undefined;
  paint?: FootprintPaint;
}

/** In `style`, since SVG presentation attributes don't resolve the theme's `var()`. */
const paintStyle = (paint: FootprintPaint, material: string | null): CSSProperties | undefined => {
  if (paint === 'none') return undefined;
  const color = materialVar(material);
  return paint === 'solid' ? { fill: color, stroke: color } : { fill: color };
};

/** Ground-course piece footprints (world layer). */
export const PieceFootprints = ({ pieces, className, paint = 'fill' }: PieceFootprintsProps) => (
  <g>
    {groundCourse(pieces).map((piece) => (
      <polygon
        key={piece.key}
        className={className}
        points={toSvgPoints(footprintCorners(piece))}
        style={paintStyle(paint, piece.material)}
        vectorEffect="non-scaling-stroke"
      />
    ))}
  </g>
);
