/** Plan-view fill colour per piece material (`PieceDef.material`). */
const MATERIAL_COLORS: Record<string, string> = {
  wood: '#b07a45',
  hardwood: '#7d5232',
  timberwood: '#8f6a4a',
  ashstone: '#6f7781',
  stone: '#9a9a92',
};

const FALLBACK_COLOR = '#b06ab3';

export const materialColor = (material: string | null | undefined): string =>
  (material && MATERIAL_COLORS[material]) || FALLBACK_COLOR;
