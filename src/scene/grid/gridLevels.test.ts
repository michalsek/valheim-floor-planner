import { describe, expect, it } from 'vitest';

import { MAX_ZOOM, MIN_ZOOM } from '../../viewport/viewportMath';

import { GRID_LEVELS, gridLevelAlphas } from './gridLevels';

describe('gridLevelAlphas', () => {
  it('never decreases as zoom grows', () => {
    let previous = gridLevelAlphas(MIN_ZOOM);
    for (let zoom = MIN_ZOOM; zoom <= MAX_ZOOM; zoom *= 1.1) {
      const current = gridLevelAlphas(zoom);
      current.forEach((alpha, i) => expect(alpha).toBeGreaterThanOrEqual(previous[i] ?? 0));
      previous = current;
    }
  });

  it('hides fine levels when zoomed out and shows every level at full strength when zoomed in', () => {
    expect(gridLevelAlphas(MIN_ZOOM)).toEqual([0, 0, 0, GRID_LEVELS[3].strength]);
    expect(gridLevelAlphas(MAX_ZOOM)).toEqual(GRID_LEVELS.map((l) => l.strength));
  });
});
