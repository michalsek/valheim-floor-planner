import { useAtom, useAtomValue } from 'jotai';

import { Button } from '../../controls/Button';
import { formatCompact } from '../../format';
import { sameLevel } from '../../model/elevation';
import { getLibrary } from '../../store/libraryInstance';
import { usePlan } from '../../store/planHooks';
import { floorFamilyIdAtom, workDatumAtom } from '../../store/session';
import { setWorkElevation } from '../levelActions';
import { useToolContext } from '../toolContext';

import { FloorSettingsFields } from './FloorSettingsFields';

/** Floors thicker than this sink far into the walls they would rest on. */
const THICK_FLOOR = 0.5;

/**
 * For a thick floor (stone) on a wall top: it hangs below the level, so it would sink
 * into the walls beside it instead of resting on them; one click raises the level by
 * its thickness.
 */
const ThickFloorHint = ({ thickness }: { thickness: number }) => {
  const ctx = useToolContext();
  const datum = useAtomValue(workDatumAtom);
  const onWallTop = Object.values(usePlan().walls).some(
    (w) => w.elevation < datum && sameLevel(w.elevation + w.height, datum)
  );
  if (thickness <= THICK_FLOOR || !onWallTop) return null;
  const t = formatCompact(thickness);
  return (
    <>
      <span>
        This floor hangs {t} m below the level and sinks into the walls — place it at +{t} m?
      </span>
      <Button
        title="Raise the current level"
        onClick={() => setWorkElevation(ctx, datum + thickness)}
      >
        +{t} m
      </Button>
    </>
  );
};

/** The floor tool's settings bar. */
export const FloorOptions = () => {
  const [familyId, setFamilyId] = useAtom(floorFamilyIdAtom);
  const family = getLibrary().floorFamilies.get(familyId);
  return (
    <>
      <FloorSettingsFields familyId={familyId} onChange={setFamilyId} />
      {family && <ThickFloorHint thickness={family.thickness} />}
    </>
  );
};
