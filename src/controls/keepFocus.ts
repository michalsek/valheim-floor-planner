import type { MouseEvent } from 'react';

/**
 * `onMouseDown` for buttons that must not take focus: a focused button would be
 * re-clicked by Space (pan) or Enter (a tool's key, e.g. the ruler's pin).
 */
export const keepFocus = (e: MouseEvent): void => e.preventDefault();
