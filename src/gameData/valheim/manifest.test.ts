import { describe, expect, it } from 'vitest';

import { bundleFor } from './manifest';

const MANIFEST = [
  '\uFEFFSoftRef manifest - Text',
  'bundle dependencies:',
  '- bundle: 11b3f7ee',
  '  dependencies: ',
  '  - c4210710',
  'asset locations:',
  '- asset ID: 0f',
  '  bundle: 1aa1260d',
  '  path in bundle: Assets/Other.prefab',
  '- asset ID: cd',
  '  bundle: c4210710',
  '  path in bundle: Assets/GameElements/Pieces/_HammerPieceTable.prefab',
].join('\r\n');

describe('bundleFor', () => {
  it('finds the bundle an asset is in', () => {
    expect(bundleFor(MANIFEST, 'Assets/GameElements/Pieces/_HammerPieceTable.prefab')).toBe(
      'c4210710'
    );
    expect(bundleFor(MANIFEST, 'Assets/Missing.prefab')).toBeNull();
  });
});
