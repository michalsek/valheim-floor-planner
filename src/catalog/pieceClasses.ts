/** Prefab classes the editor treats specially, by name. Pure. */

/**
 * Square floor tiles. Their raw boxes are lifted 1 mm (`rawBoxes.ts`) so a tile on a
 * wall top doesn't fight it, and Build places them `unlifted` (`build/placement.ts`);
 * their clusters make the storey stops the cut steps between (`model/cut.ts`).
 */
export const FLOOR_TILE_PREFABS: ReadonlySet<string> = new Set([
  'wood_floor',
  'wood_floor_1x1',
  'ashwood_floor_2x2',
  'ashwood_floor_1x1',
  'stone_floor_2x2',
  'blackmarble_floor',
  'Piece_grausten_floor_4x4',
  'Piece_grausten_floor_2x2',
  'Piece_grausten_floor_1x1',
  'iron_floor_2x2',
  'iron_floor_1x1_v2',
]);

/** Doors, gates and grates: drawn as their thin panel, not the frame's snap depth. */
export const DOOR_PREFABS: ReadonlySet<string> = new Set([
  'wood_door',
  'wood_gate',
  'ashwood_door',
  'stave_gate',
  'iron_grate',
  'darkwood_gate',
]);
