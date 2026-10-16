import { boxOutline } from '../model/geometry/box';
import { footprintCorners } from '../model/geometry/polyline';
import { groundCourse } from '../model/types';
import { useViewport } from '../store/hooks';
import { useDisplayDerived, useDisplayPlan } from '../store/planHooks';

import styles from './Overlay.module.css';
import { RunPath } from './RunPath';
import { toSvgPoints } from './svgPoints';

/** Seams are drawn only while a tile is at least this many screen px across. */
const MIN_TILE_PX = 8;
const SEAM_MASK_ID = 'floorSeamMask';
/** Half the side (m) of the mask's open area: far beyond any plan. */
const MASK_REACH = 1e5;

/**
 * Floors in the world layer: 1 px seams round every tile (so tiles can be counted),
 * masked off where walls stand on the floor so the wall pieces stay readable, and a
 * thin outline round each floor.
 */
export const FloorOutlines = () => {
  const { floors } = useDisplayPlan();
  const { pieces } = useDisplayDerived();
  const { zoom } = useViewport();
  const tiles = pieces.filter(
    (p) => p.kind === 'floor' && p.footprint.length * zoom >= MIN_TILE_PX
  );

  const walls = groundCourse(pieces.filter((p) => p.kind === 'wall'));

  return (
    <g>
      <mask id={SEAM_MASK_ID} maskUnits="userSpaceOnUse">
        <rect
          x={-MASK_REACH}
          y={-MASK_REACH}
          width={2 * MASK_REACH}
          height={2 * MASK_REACH}
          fill="white"
        />
        {walls.map((piece) => (
          <polygon key={piece.key} points={toSvgPoints(footprintCorners(piece))} fill="black" />
        ))}
      </mask>
      <g mask={`url(#${SEAM_MASK_ID})`}>
        {tiles.map((tile) => (
          <polygon
            key={tile.key}
            className={styles.floorSeam}
            points={toSvgPoints(footprintCorners(tile))}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {Object.values(floors).map((floor) => {
        const { points } = boxOutline(floor);
        return <RunPath key={floor.id} points={points} closed className={styles.floorOutline} />;
      })}
    </g>
  );
};
