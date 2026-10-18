/** Valheim's `Heightmap.Biome` codes (a bitmask in the game) and their names. */
export const Biome = {
  Meadows: 1,
  Swamp: 2,
  Mountain: 4,
  BlackForest: 8,
  Plains: 16,
  AshLands: 32,
  DeepNorth: 64,
  Ocean: 256,
  Mistlands: 512,
} as const;

export type BiomeCode = (typeof Biome)[keyof typeof Biome];

const NAMES = new Map<number, string>(Object.entries(Biome).map(([name, code]) => [code, name]));

export const biomeName = (code: number): string => NAMES.get(code) ?? `Biome ${code}`;

/**
 * Whether the port has this biome's full height function. Ashlands and Deep North are only
 * ported in their pregeneration form (M16 Stage 2b).
 */
export const isPorted = (code: number): boolean =>
  code !== Biome.AshLands && code !== Biome.DeepNorth;
