import type { CSSProperties } from 'react';

/**
 * A footprint's colour, as the `--fp` custom property its class fills and strokes with
 * (`Footprints.module.css`): an inline `fill` would beat the ghost level's neutral one.
 */
export const footprintStyle = (color: string): CSSProperties =>
  ({ '--fp': color }) as CSSProperties;
