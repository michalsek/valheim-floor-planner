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

/** `59.29` → `"59.3 m²"`. */
export const formatArea = (n: number): string => `${formatNumber(n, 1)} m²`;

/** Whole and half metres without trailing zeros: `8` → `"8"`, `8.5` → `"8.5"`. */
export const formatCompact = (n: number): string => String(Math.round(n * 100) / 100);

/** `(7.7, 7.7, 2)` → `"7.70 × 7.70"`; without `digits`, compact (`"8 × 8"`). */
export const formatSize = (w: number, d: number, digits?: number): string => {
  const f = (n: number) => (digits === undefined ? formatCompact(n) : formatNumber(n, digits));
  return `${f(w)} × ${f(d)}`;
};
