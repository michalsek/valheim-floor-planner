/**
 * The support view's colours, shared by both views. Values are bucketed into bands, so
 * 2D slabs keep one material per band: grounded (blue, as in the game), six ramp bands
 * from weak (0, red) through yellow to strong (5, green), and collapsing (magenta).
 */
import { mixHex } from '../catalog/materialColors';
import type { BoxSupport, PlanSupport } from '../model/support/planSupport';
import type { ThemeTokens } from '../theme/themeTokens';

export const RAMP_BANDS = 6;

/** 'none': the piece takes no part (no material, or no support worked out yet). */
export type SupportBand = 'grounded' | 'broken' | 'none' | number;

export const supportBand = (support: BoxSupport | undefined): SupportBand => {
  if (!support) return 'none';
  switch (support.state) {
    case 'grounded':
      return 'grounded';
    case 'collapsing':
      return 'broken';
    case 'supported':
      return Math.min(RAMP_BANDS - 1, Math.floor(support.ratio * RAMP_BANDS));
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
  if (band === 'grounded') return support.grounded;
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
  return band === 'grounded' || band === 'broken' || band === 'none' ? band : Number(band);
};

/**
 * What a wall column shows in 2D: collapsing when any course would; grounded when its
 * base course is (a ground wall reads as one, as in the game); else its weakest course.
 */
export const columnBand = (base: SupportBand, courses: readonly SupportBand[]): SupportBand => {
  if (courses.includes('broken') || base === 'broken') return 'broken';
  if (base === 'grounded' || base === 'none') return base;
  const ramp = [base, ...courses].filter((b): b is number => typeof b === 'number');
  return ramp.length > 0 ? Math.min(...ramp) : base;
};
