import type { CSSProperties } from 'react';

/**
 * A footprint's colour, as the `--fp` custom property its class fills and strokes with
 * (`Footprints.module.css`).
 */
export const footprintStyle = (color: string): CSSProperties =>
  ({ '--fp': color }) as CSSProperties;
