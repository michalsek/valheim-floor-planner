import type { Vec2 } from '../model/types';

import { toSvgPoints } from './svgPoints';

interface RunPathProps {
  points: readonly Vec2[];
  closed: boolean;
  className: string | undefined;
}

/** A wall run's drawn line (world layer). */
export const RunPath = ({ points, closed, className }: RunPathProps) => {
  const Shape = closed ? 'polygon' : 'polyline';
  return (
    <Shape className={className} points={toSvgPoints(points)} vectorEffect="non-scaling-stroke" />
  );
};
