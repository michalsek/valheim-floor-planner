/** Ctrl (or ⌘ on a Mac) is held. */
export const isMod = (e: KeyboardEvent): boolean => e.ctrlKey || e.metaKey;

/** Ctrl/Cmd+Z, without Shift or Alt. */
export const isUndoKey = (e: KeyboardEvent): boolean =>
  isMod(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z';

/** Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y. */
export const isRedoKey = (e: KeyboardEvent): boolean => {
  if (!isMod(e) || e.altKey) return false;
  const key = e.key.toLowerCase();
  return (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey);
};
