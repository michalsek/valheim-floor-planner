import { materialVar } from '../catalog/materialColors';
import { isRawRoof, rawOutline } from '../model/rawBoxes';
import { rawDef } from '../model/rawPieces';
import type { Plan, RawPiece } from '../model/types';
import { getLibrary } from '../store/libraryInstance';
import { useGhostPlan, useLevelPlan } from '../store/planHooks';

import styles from './Overlay.module.css';
import { toSvgPoints } from './svgPoints';

/** Lowest first, so what is seen from above is drawn on top. */
const inDrawOrder = (plan: Pick<Plan, 'rawPieces'>): RawPiece[] =>
  Object.values(plan.rawPieces).sort(
    (a, b) => a.elevation + a.position.y - (b.elevation + b.position.y)
  );

/**
 * One raw piece's outline from above, in its material's colour (world layer): filled,
 * or only stroked for roof pieces, as the roof layer draws roofs.
 */
const RawFootprint = ({ piece }: { piece: RawPiece }) => {
  const lib = getLibrary();
  const color = materialVar(rawDef(lib, piece)?.material);
  const roof = isRawRoof(piece, lib);
  return (
    <polygon
      className={roof ? styles.rawRoof : styles.rawFootprint}
      points={toSvgPoints(rawOutline(piece, lib))}
      style={{ fill: roof ? 'none' : color, stroke: color }}
      vectorEffect="non-scaling-stroke"
    />
  );
};

const Footprints = ({ plan }: { plan: Pick<Plan, 'rawPieces'> }) => (
  <>
    {inDrawOrder(plan).map((piece) => (
      <RawFootprint key={piece.id} piece={piece} />
    ))}
  </>
);

/**
 * The current level's raw pieces (an imported build) as their outlines from above;
 * stacked courses overlap, so taller stacks read darker.
 */
export const RawFootprints = () => <Footprints plan={useLevelPlan()} />;

/** The level below's raw pieces, faintly (inside `LevelGhosts`' group). */
export const RawGhosts = () => <Footprints plan={useGhostPlan()} />;
