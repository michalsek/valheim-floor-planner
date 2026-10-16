const MINUS = '−';

/** Fixed-point number with a typographic minus; values that round to zero lose their sign. */
export const formatNumber = (n: number, digits = 2): string => {
  const text = Math.abs(n).toFixed(digits);
  return n < 0 && Number(text) !== 0 ? `${MINUS}${text}` : text;
};

/** `4.5` → `"4.50 m"`. */
export const formatMetres = (n: number, digits = 2): string => `${formatNumber(n, digits)} m`;

/** `(4, -2)` → `"Δx 4.00 · Δz −2.00"`. */
export const formatDelta = (dx: number, dz: number): string =>
  `Δx ${formatNumber(dx)} · Δz ${formatNumber(dz)}`;

/** `40` → `"40 px/m"`, `2.5` → `"2.5 px/m"`. */
export const formatZoom = (zoom: number): string =>
  `${zoom < 10 ? zoom.toFixed(1) : Math.round(zoom)} px/m`;
