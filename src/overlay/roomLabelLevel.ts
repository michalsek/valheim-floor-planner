/** How much of a room label fits in its free space. */
type RoomLabelLevel = 'full' | 'compact' | 'area' | 'none';

/** Screen px the widest line of each level would take. */
type LabelWidths = Record<Exclude<RoomLabelLevel, 'none'>, number>;

/** Clear space kept between a label and the room's sides, in px. */
const MARGIN = 12;

/**
 * The richest level that fits a free space of `wPx` × `dPx` screen px: each level has
 * a minimum box, and its widest line must fit too.
 */
export const roomLabelLevel = (wPx: number, dPx: number, widths: LabelWidths): RoomLabelLevel => {
  const fits = (minW: number, minD: number, textW: number) =>
    dPx >= minD && wPx >= Math.max(minW, textW + MARGIN);
  if (fits(170, 70, widths.full)) return 'full';
  if (fits(110, 30, widths.compact)) return 'compact';
  if (fits(50, 20, widths.area)) return 'area';
  return 'none';
};
