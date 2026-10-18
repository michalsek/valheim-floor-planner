/** What an imported site's terrain may get wrong, as the Terrain toggle's title lists it. */
import { MISMATCH } from '../../install/siteGeneration';
import type { SiteNotices } from '../../model/types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const noticeLines = ({ locations, legacyEdits, check }: SiteNotices): string[] => {
  const lines: string[] = [];
  if (locations.length > 0) {
    lines.push(
      `${plural(locations.length, 'location', 'locations')} (ruins, dolmens, dungeons) near the site: the game flattens the ground around them and the planner doesn’t, so the terrain may differ by a few metres there (dashed rings in 2D).`
    );
  }
  if (legacyEdits > 0) {
    lines.push(
      `${plural(legacyEdits, 'pre-1.0 terrain edit', 'pre-1.0 terrain edits')} here ${legacyEdits === 1 ? 'isn’t' : 'aren’t'} applied (the game still applies them as it runs). Run optterrain in the game’s console to fold them into the save, then add the terrain again.`
    );
  }
  if (check.n > 0 && check.maxError > MISMATCH) {
    lines.push(
      `The world’s own heights near the site differ from the planner’s by up to ${check.maxError.toFixed(2)} m: this terrain may not match the world (a newer game version?).`
    );
  }
  return lines;
};
