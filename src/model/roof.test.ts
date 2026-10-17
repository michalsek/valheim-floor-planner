import { describe, expect, it } from 'vitest';

import { roofSpan } from './roof';

describe('roofSpan', () => {
  it('takes a 6 m span with whole pieces and flags a 7 m one', () => {
    expect(roofSpan(6, 10)).toEqual({
      span: 6,
      wholePiece: true,
      rise: { p26: 1.5, p45: 3, p67: 6 },
    });
    expect(roofSpan(7, 10).wholePiece).toBe(false);
  });
});
