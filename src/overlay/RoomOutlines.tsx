import { useDisplayDerived } from '../store/planHooks';

import styles from './Overlay.module.css';
import { RunPath } from './RunPath';

/** Dashed outlines of every room's clear floor, holes included (world layer). */
export const RoomOutlines = () => {
  const { rooms } = useDisplayDerived();
  return (
    <g>
      {rooms.flatMap((room) =>
        room.clear.map((ring, i) => (
          <RunPath key={`${room.key}:${i}`} points={ring} closed className={styles.roomOutline} />
        ))
      )}
    </g>
  );
};
