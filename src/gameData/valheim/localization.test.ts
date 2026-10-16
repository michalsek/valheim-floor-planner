import { describe, expect, it } from 'vitest';

import { parseLocalization } from './localization';

describe('parseLocalization', () => {
  it('reads multi-line cells and escaped quotes by column header', () => {
    const csv = [
      '\uFEFF"","English","Swedish","Polish"',
      '"piece_bed","Bed","","Łóżko"',
      '"msg","Say ""hi""\nthen leave",x,"Powiedz ""cześć"""',
      'piece_x,Plain,,',
      '',
    ].join('\r\n');
    const { en, pl } = parseLocalization(csv);
    expect(en.get('piece_bed')).toBe('Bed');
    expect(pl.get('piece_bed')).toBe('Łóżko');
    expect(en.get('msg')).toBe('Say "hi"\nthen leave');
    expect(pl.get('msg')).toBe('Powiedz "cześć"');
    expect(en.get('piece_x')).toBe('Plain');
    expect(pl.has('piece_x')).toBe(false);
  });
});
