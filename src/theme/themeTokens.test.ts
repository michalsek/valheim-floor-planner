import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME_TOKENS, readThemeTokens } from './themeTokens';

const getter =
  (values: Record<string, string>) =>
  (name: string): string =>
    values[name] ?? '';

describe('readThemeTokens', () => {
  it('trims values, expands short hex, parses numbers and fills missing materials', () => {
    const tokens = readThemeTokens(
      getter({
        '--grid-line': ' #3B4350 ',
        '--grid-alpha-scale': ' 0.55',
        '--floor-opacity': '0.75',
        '--floor-material-share': '0.7',
        '--floor-base': '#ccc',
        '--mat-stone': ' #85857b',
        '--mat-fallback': '#123456',
        '--selection': '#C2179B',
        '--prop-crafting': '#b8761a',
        '--shadow-alpha': '0.3',
        '--ghost': '#7D8794',
        '--contour': '#7a5a32',
        '--water': '#6FA3CF',
      })
    );
    expect(tokens.gridLine).toBe('#3b4350');
    expect(tokens.gridAlphaScale).toBe(0.55);
    expect(tokens.floorOpacity).toBe(0.75);
    expect(tokens.palette.floorShare).toBe(0.7);
    expect(tokens.palette.floorBase).toBe('#cccccc');
    expect(tokens.palette.fallback).toBe('#123456');
    expect(tokens.palette.materials.stone).toBe('#85857b');
    expect(tokens.palette.materials.wood).toBe('#123456');
    expect(tokens.selection).toBe('#c2179b');
    expect(tokens.propGroups.crafting).toBe('#b8761a');
    expect(tokens.propGroups.ships).toBe(DEFAULT_THEME_TOKENS.propGroups.ships);
    expect(tokens.shadowAlpha).toBe(0.3);
    expect(tokens.ghost).toBe('#7d8794');
    expect(tokens.terrain).toEqual({
      ...DEFAULT_THEME_TOKENS.terrain,
      contour: '#7a5a32',
      water: '#6fa3cf',
    });
  });

  it('keeps the defaults for missing or invalid values', () => {
    const tokens = readThemeTokens(
      getter({
        '--grid-line': 'var(--x)',
        '--grid-alpha-scale': 'loud',
        '--floor-material-share': '1.5',
        '--mat-wood': 'rgb(1 2 3)',
        '--shadow-alpha': '2',
        '--ghost': 'grey',
      })
    );
    expect(tokens).toEqual(DEFAULT_THEME_TOKENS);
  });
});
