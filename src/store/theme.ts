/**
 * Theme session state: the user's preference (persisted), the OS scheme, the theme
 * they resolve to, and the scene tokens read from CSS for that theme. `index.html` sets
 * `<html data-theme>` before the first paint; `startThemeSync` takes over from there.
 */
import { atom } from 'jotai';

import { DEFAULT_THEME_TOKENS, readThemeTokens, type ThemeTokens } from '../theme/themeTokens';

import { getLocalStorage } from './browserStorage';
import type { SessionStore } from './session';

export type Theme = 'light' | 'dark';
export type ThemePref = 'system' | Theme;

/** Also read by the bootstrap script in `index.html`; keep the two in sync. */
export const THEME_STORAGE_KEY = 'valheimFloorPlanner.theme.v1';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

export const themePrefAtom = atom<ThemePref>('system');
/** The OS colour scheme, kept current by `startThemeSync`. */
export const systemThemeAtom = atom<Theme>('dark');
export const resolvedThemeAtom = atom<Theme>((get) => {
  const pref = get(themePrefAtom);
  return pref === 'system' ? get(systemThemeAtom) : pref;
});
/** Scene colours for the resolved theme (grid uniforms, slab materials). */
export const themeTokensAtom = atom<ThemeTokens>(DEFAULT_THEME_TOKENS);

const isThemePref = (value: unknown): value is ThemePref =>
  value === 'system' || value === 'light' || value === 'dark';

type PrefStorage = Pick<Storage, 'getItem' | 'setItem'>;

const readPref = (storage: PrefStorage | null): ThemePref => {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePref(value) ? value : 'system';
  } catch {
    return 'system';
  }
};

const writePref = (storage: PrefStorage | null, pref: ThemePref): void => {
  try {
    storage?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Blocked or full storage: the choice lasts for this session only.
  }
};

/**
 * Loads the preference, follows OS scheme changes, persists preference changes, and
 * on every resolved-theme change sets `<html data-theme>` first and only then reads the
 * scene tokens, so `getComputedStyle` sees the new theme. Call before the first render.
 */
export const startThemeSync = (store: SessionStore): (() => void) => {
  const storage = getLocalStorage();
  const root = document.documentElement;
  const media = window.matchMedia(LIGHT_QUERY);

  const syncSystem = () => store.set(systemThemeAtom, media.matches ? 'light' : 'dark');
  const applyTheme = () => {
    root.dataset.theme = store.get(resolvedThemeAtom);
    const style = getComputedStyle(root);
    store.set(
      themeTokensAtom,
      readThemeTokens((name) => style.getPropertyValue(name))
    );
  };

  store.set(themePrefAtom, readPref(storage));
  syncSystem();
  applyTheme();

  media.addEventListener('change', syncSystem);
  // Dev only: an edited `global.css` changes token values without a theme change.
  import.meta.hot?.on('vite:afterUpdate', applyTheme);
  const stopTheme = store.sub(resolvedThemeAtom, applyTheme);
  const stopPref = store.sub(themePrefAtom, () => writePref(storage, store.get(themePrefAtom)));
  return () => {
    media.removeEventListener('change', syncSystem);
    import.meta.hot?.off('vite:afterUpdate', applyTheme);
    stopTheme();
    stopPref();
  };
};
