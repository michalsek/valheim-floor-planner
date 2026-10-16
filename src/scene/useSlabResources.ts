import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useThemeTokens } from '../store/hooks';
import type { ThemeTokens } from '../theme/themeTokens';

import { createSlabResources, type SlabStyler } from './slabResources';

/**
 * Slab resources styled from the theme tokens: created once, restyled in place (and
 * the frame invalidated) when the theme changes, disposed on unmount. `stylerFor`
 * should be a stable, module-level function.
 */
export const useSlabResources = (stylerFor: (tokens: ThemeTokens) => SlabStyler) => {
  const tokens = useThemeTokens();
  const invalidate = useThree((s) => s.invalidate);
  const [resources] = useState(() => createSlabResources(stylerFor(tokens)));
  /** The tokens the cached materials were styled with; no restyle on mount. */
  const styledWith = useRef(tokens);

  useEffect(() => () => resources.dispose(), [resources]);
  useLayoutEffect(() => {
    if (styledWith.current === tokens) return;
    styledWith.current = tokens;
    resources.restyle(stylerFor(tokens));
    invalidate();
  }, [resources, stylerFor, tokens, invalidate]);

  return resources;
};
