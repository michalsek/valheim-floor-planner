import { describe, expect, it } from 'vitest';

import { roofSpan } from './roof';

describe('roofSpan', () => {
  it('accepts an 8 m span and flags a 6 m one', () => {
    expect(roofSpan(8, 12)).toEqual({
      span: 8,
      wholePiece: true,
      rise: { p26: 2, p45: 4, p67: 8 },
    });
    expect(roofSpan(6, 10).wholePiece).toBe(false);
  });
});
