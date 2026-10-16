/**
 * Plan-view colour per prop group, as a CSS variable (the values are theme tokens in
 * `global.css`). Use it in `style`: SVG presentation attributes don't resolve `var()`.
 */
import type { PropGroup } from './propDefs';

export const groupColor = (group: PropGroup | undefined): string =>
  `var(--prop-${group ?? 'fallback'})`;
