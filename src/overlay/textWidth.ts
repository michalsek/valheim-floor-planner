/**
 * Width of overlay text in CSS px, measured with a canvas in the app's UI font and
 * cached (labels re-measure on every pan and zoom).
 */
export interface TextFont {
  sizePx: number;
  weight: number;
}

/** Average glyph width in em, for when there's no canvas to measure with. */
const FALLBACK_EM_PER_GLYPH = 0.48;

const cache = new Map<string, number>();
let measurer: CanvasRenderingContext2D | null | undefined;

const getMeasurer = (): CanvasRenderingContext2D | null => {
  if (measurer === undefined) {
    measurer =
      typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  return measurer;
};

export const textWidth = (text: string, { sizePx, weight }: TextFont): number => {
  const ctx = getMeasurer();
  if (!ctx) return text.length * sizePx * FALLBACK_EM_PER_GLYPH;
  const family = getComputedStyle(document.documentElement).fontFamily;
  const font = `${weight} ${sizePx}px ${family}`;
  const key = `${font}|${text}`;
  let width = cache.get(key);
  if (width === undefined) {
    ctx.font = font;
    width = ctx.measureText(text).width;
    cache.set(key, width);
  }
  return width;
};
