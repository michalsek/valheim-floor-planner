import { worldToPlan } from '../model/terrain/siteTerrain';
import { useShownSiteTerrain } from '../store/siteTerrain';

import { toSvgPoints } from './svgPoints';

/** The radius (metres) of the ring around a location's centre. */
const LOCATION_RING = 25;
const RING_TITLE =
  'Ruins and other locations flatten the ground here; the terrain may differ by a few metres';

const lineStyle = (dash: string) => ({
  fill: 'none',
  stroke: 'var(--contour)',
  strokeDasharray: dash,
  strokeOpacity: 0.8,
});

/**
 * A site's marks on the 2D plan (world layer): the edge of its terrain patch, dashed,
 * and a dashed ring around each location centre near it, where the game flattens
 * ground the terrain doesn't know about.
 */
export const SiteMarks = () => {
  const site = useShownSiteTerrain();
  if (!site) return null;
  const { grid, frame, terrain } = site;
  const { x0, z0, cols, rows } = grid;
  const outline = [
    { x: x0, z: z0 },
    { x: x0 + cols - 1, z: z0 },
    { x: x0 + cols - 1, z: z0 + rows - 1 },
    { x: x0, z: z0 + rows - 1 },
  ].map((w) => worldToPlan(frame, w));
  return (
    <g>
      <polygon
        points={toSvgPoints(outline)}
        style={lineStyle('6 4')}
        vectorEffect="non-scaling-stroke"
      />
      {terrain.notices.locations.map((location) => {
        const c = worldToPlan(frame, location);
        return (
          <circle
            key={`${location.x},${location.z}`}
            cx={c.x}
            cy={c.z}
            r={LOCATION_RING}
            style={lineStyle('3 4')}
            vectorEffect="non-scaling-stroke"
          >
            <title>{RING_TITLE}</title>
          </circle>
        );
      })}
    </g>
  );
};
