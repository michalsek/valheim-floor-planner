/**
 * The support view's colours, shared by both views, on the game's scale (as recalled
 * from `WearNTear`): blue at the material's maximum (on the ground, or capped like wood
 * on stone), then red → yellow → green up to half the maximum, which is all green.
 * Values are bucketed into bands, so 2D slabs keep one material per band: 'max', six
 * ramp bands from weak (0) to strong (5), and collapsing (magenta).
 */
import { mixHex } from '../catalog/materialColors';
import type { BoxSupport, PlanSupport } from '../model/support/planSupport';
import type { ThemeTokens } from '../theme/themeTokens';

export const RAMP_BANDS = 6;

/** 'none': the piece takes no part (no material, or no support worked out yet). */
export type SupportBand = 'max' | 'broken' | 'none' | number;

export const supportBand = (support: BoxSupport | undefined): SupportBand => {
  if (!support) return 'none';
  switch (support.state) {
    case 'grounded':
      return 'max';
    case 'collapsing':
      return 'broken';
    case 'supported':
      return support.full
        ? 'max'
        : Math.min(RAMP_BANDS - 1, Math.floor(support.ratio * RAMP_BANDS));
    case 'none':
      return 'none';
  }
};

/** The band of the box with `key` (none without support). */
export const bandOf = (support: PlanSupport | null, key: string): SupportBand =>
  supportBand(support?.byKey.get(key));

/** A band's colour; null for 'none'. */
export const supportBandColor = ({ support }: ThemeTokens, band: SupportBand): string | null => {
  if (band === 'none') return null;
  if (band === 'max') return support.grounded;
  if (band === 'broken') return support.broken;
  const t = band / (RAMP_BANDS - 1);
  return t < 0.5
    ? mixHex(support.low, support.mid, t * 2)
    : mixHex(support.mid, support.high, (t - 0.5) * 2);
};

/** Slab style keys carry the band as `support:<band>`. */
const SUPPORT_KEY = 'support:';

export const bandKey = (band: SupportBand): string => `${SUPPORT_KEY}${band}`;

/** The band in a slab style key, or null for a material key. */
export const bandOfKey = (key: string): SupportBand | null => {
  if (!key.startsWith(SUPPORT_KEY)) return null;
  const band = key.slice(SUPPORT_KEY.length);
  return band === 'max' || band === 'broken' || band === 'none' ? band : Number(band);
};

/**
 * What a wall column shows in 2D: collapsing when any course would; at maximum when its
 * base course is (a ground wall reads as one); else its weakest course.
 */
export const columnBand = (base: SupportBand, courses: readonly SupportBand[]): SupportBand => {
  if (courses.includes('broken') || base === 'broken') return 'broken';
  if (base === 'max' || base === 'none') return base;
  const ramp = [base, ...courses].filter((b): b is number => typeof b === 'number');
  return ramp.length > 0 ? Math.min(...ramp) : base;
};
