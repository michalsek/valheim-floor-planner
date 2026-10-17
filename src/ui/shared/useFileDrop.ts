import { useRef, useState, type DragEvent } from 'react';

const carriesFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

/**
 * Makes an element a drop target for files and folders: spread `dropProps` on it and
 * use `dragging` for the highlight. `onDrop` runs inside the drop event (the items are
 * unreadable once it returns). Drags without files pass through.
 */
export const useFileDrop = (onDrop: (data: DataTransfer) => void) => {
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
      event.stopPropagation();
      depth.current = 0;
      setDragging(false);
      onDrop(event.dataTransfer);
    },
  };
  return { dragging, dropProps };
};
