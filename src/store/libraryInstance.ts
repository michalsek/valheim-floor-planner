/**
 * The app's one catalogue, built from the user's install by the install gate before
 * the editor mounts. It never changes during a page load: re-scanning or switching
 * installs reloads the page, so derived caches can't go stale.
 */
import type { Library } from '../catalog/library';

let current: Library | null = null;

export const setLibrary = (lib: Library): void => {
  current = lib;
};

export const hasLibrary = (): boolean => current !== null;

/** Throws before the gate has installed a library. */
export const getLibrary = (): Library => {
  if (!current) throw new Error('The catalogue is not loaded yet');
  return current;
};
