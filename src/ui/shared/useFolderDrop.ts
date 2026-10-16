import { useRef, useState, type DragEvent } from 'react';

import { captureDrop } from '../../install/dropFolder';
import { chooseDrop } from '../../install/loadInstall';
import { steamFolderBlocked } from '../../install/platform';

const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

/**
 * Makes an element a drop target for the Valheim folder: spread `dropProps` on it and
 * use `dragging` for the highlight. Drags without files (text, links) pass through.
 */
export const useFolderDrop = () => {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child crossed; count them to know when we left.
  const depth = useRef(0);

  const dropProps = {
    onDragEnter: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current++;
      setDragging(true);
    },
    onDragOver: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      // Synchronously: the items are unreadable once the event returns.
      const drop = captureDrop(event.dataTransfer, !steamFolderBlocked());
      if (drop) void chooseDrop(drop);
    },
  };
  return { dragging, dropProps };
};
