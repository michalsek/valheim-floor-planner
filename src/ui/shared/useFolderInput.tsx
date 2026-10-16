import { useRef, type ReactNode } from 'react';

/**
 * A hidden `<input webkitdirectory>`: the folder picker every browser has. It reads
 * the folder's file list (the browser calls it an upload; nothing is sent anywhere).
 */
export const useFolderInput = (
  onFiles: (files: File[]) => void
): { input: ReactNode; open(): void } => {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      hidden
      // Not in React's types; an empty string turns it on.
      {...{ webkitdirectory: '' }}
      onChange={(event) => {
        // Copy first: clearing the input empties its live FileList.
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = '';
        if (files.length > 0) onFiles(files);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
};
