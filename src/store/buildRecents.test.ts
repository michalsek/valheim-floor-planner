import { describe, expect, it } from 'vitest';

import { MAX_RECENTS, parseRecents, withRecent } from './buildRecents';

describe('buildRecents', () => {
  it('moves an armed prefab to the front and keeps the last twelve', () => {
    const many = Array.from({ length: MAX_RECENTS }, (_, i) => `p${i}`);
    expect(withRecent(many, 'p3').slice(0, 2)).toEqual(['p3', 'p0']);
    expect(withRecent(many, 'new')).toHaveLength(MAX_RECENTS);
    expect(withRecent(many, 'new').at(-1)).toBe('p10');
  });

  it('reads back only a list of names', () => {
    expect(parseRecents('["woodwall","woodwall","wood_floor"]')).toEqual([
      'woodwall',
      'wood_floor',
    ]);
    expect(parseRecents('{"a":1}')).toBeNull();
    expect(parseRecents('[1]')).toBeNull();
    expect(parseRecents('not json')).toBeNull();
  });
});
