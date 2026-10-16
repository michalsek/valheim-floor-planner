import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import type { OpeningDef } from '../../catalog/openingDefs';
import { openingBox, type PieceBox } from '../../model/pieceBoxes';
import { Label3d } from '../../overlay/Label3d';
import styles from '../../overlay/Overlay.module.css';
import { GhostBoxes } from '../../scene/view3d/GhostBoxes';
import { useThemeTokens } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { usePlan } from '../../store/planHooks';

import type { Placement } from './openingPlacement';
import { openingDefAtom, openingHoverAtom } from './openingState';

/** The ghost stands this far proud of each wall face, so the wall around it can't hide it. */
const PROUD = 0.03;
/** Gap (px) between the opening's foot and the reason it can't go there. */
const LABEL_ABOVE = 22;

/** The opening a click would cut, as a panel through the wall's whole thickness. */
const ghostBox = (placement: Placement, def: OpeningDef, wallThickness: number): PieceBox => {
  const box = openingBox({
    key: 'opening:preview',
    kind: 'opening',
    prefab: def.prefab,
    material: def.material,
    sourceId: 'preview',
    segment: placement.segment,
    course: 0,
    base: 0,
    height: def.height,
    center: placement.stripCenter,
    rotation: Math.atan2(placement.dir.z, placement.dir.x),
    footprint: { length: def.width, thickness: wallThickness },
  });
  return { ...box, size: { ...box.size, z: wallThickness + 2 * PROUD } };
};

/** The opening a click would place: green where it fits, red where it doesn't. */
export const OpeningPreview3d = () => {
  const placement = useAtomValue(openingHoverAtom);
  const def = useAtomValue(openingDefAtom);
  const { ink } = useThemeTokens();
  const familyId = usePlan().walls[placement?.wallId ?? '']?.familyId;
  const thickness = getLibrary().wallFamilies.get(familyId ?? '')?.thickness ?? 0;
  const boxes = useMemo(
    () => (placement && def ? [ghostBox(placement, def, thickness)] : []),
    [placement, def, thickness]
  );
  const color = placement?.valid ? ink.success : ink.danger;
  const colorOf = useMemo(() => () => color, [color]);
  if (boxes.length === 0) return null;
  return <GhostBoxes boxes={boxes} colorOf={colorOf} />;
};

/** Why a click here would do nothing ("needs 2 m, 1 m free"), over the opening. */
export const OpeningOverlay3d = () => {
  const placement = useAtomValue(openingHoverAtom);
  if (!placement?.reason) return null;
  return (
    <Label3d
      at={placement.center}
      text={placement.reason}
      above={LABEL_ABOVE}
      className={`${styles.label} ${styles.labelDanger}`}
    />
  );
};
