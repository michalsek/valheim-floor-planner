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

/** R turns props 90° clockwise, Shift+R 22.5° (the game's step); null for other keys. */
export const rotateStep = (e: KeyboardEvent): number | null =>
  e.key.toLowerCase() === 'r' && !isMod(e) && !e.altKey ? (e.shiftKey ? 22.5 : 90) : null;
