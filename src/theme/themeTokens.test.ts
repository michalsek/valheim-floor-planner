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
  });

  it('keeps the defaults for missing or invalid values', () => {
    const tokens = readThemeTokens(
      getter({
        '--grid-line': 'var(--x)',
        '--grid-alpha-scale': 'loud',
        '--floor-material-share': '1.5',
        '--mat-wood': 'rgb(1 2 3)',
      })
    );
    expect(tokens).toEqual(DEFAULT_THEME_TOKENS);
  });
});
