import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { propBox } from '../../model/pieceBoxes';
import { GhostBoxes } from '../../scene/view3d/GhostBoxes';
import { GroundRing } from '../../scene/view3d/GroundRing';
import { getLibrary } from '../../store/libraryInstance';

import { propGhostAtom } from './propState';

/** The armed prop's box where a click would place it, and a station's or ward's ring. */
export const PropPreview3d = () => {
  const ghost = useAtomValue(propGhostAtom);
  const boxes = useMemo(() => {
    if (!ghost) return [];
    const { def, position, rotation } = ghost;
    return [propBox({ id: 'preview', prefab: def.prefab, position, rotation }, getLibrary())];
  }, [ghost]);
  if (!ghost) return null;
  return (
    <>
      <GhostBoxes boxes={boxes} />
      <GroundRing prop={{ prefab: ghost.def.prefab, position: ghost.position, upgrades: 0 }} />
    </>
  );
};
