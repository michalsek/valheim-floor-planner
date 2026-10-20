import { describe, expect, it } from 'vitest';

import { legacyNotice } from './fileActions';

describe('legacyNotice', () => {
  it('lists the nonzero counts, with plurals, and says where the plan is kept', () => {
    const { message } = legacyNotice({ walls: 2, floors: 1, doors: 0, roofs: 1 }, true);
    expect(message).toBe(
      'Left out 2 walls, 1 floor and 1 roof: they were drawn with tools this version no longer has. ' +
        'To keep them as single pieces, open the plan in an earlier version and Explode them first. ' +
        'The plan as it was is kept aside in this browser.'
    );
    expect(legacyNotice({ walls: 1, floors: 0, doors: 0, roofs: 0 }).message).toMatch(
      /^Left out 1 wall: it was drawn .* Explode it first\.$/
    );
  });
});
