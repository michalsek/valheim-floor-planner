/**
 * Valheim 1.0's `WorldGenerator`: seeding, base height, biomes and `GetHeight`. This is our
 * own TypeScript port of `private/research/extract/world/worldGen.py` (validated against a
 * real save, research/README.md §8), line by line and scalar: float32 rounding (`f`) sits
 * exactly where the Python rounds and nowhere else. Coordinates are world x and z (the Python's y).
 *
 * Heights depend on the rendered rivers in `rivers`: empty until `pregenerate` (or
 * `restoreRivers`) fills it.
 */
import {
  ashlandsPregenHeight,
  C0001,
  C0002,
  C0003,
  C0005,
  C001,
  C002,
  C005,
  C01,
  C04,
  deepNorthPregenHeight,
  forestHeight,
  type HeightContext,
  marshHeight,
  meadowsHeight,
  mistlandsHeight,
  mountainHeight,
} from './biomeHeights';
import { Biome } from './biomes';
import {
  clamp01,
  length,
  lerp,
  lerpStep,
  smoothStep,
  smoothStepMathf,
  worldAngle,
} from './mathHelpers';
import { RiverPoints } from './rivers';
import { f, perlin as P, UnityRandom } from './unityNatives';

/** The only world generator version the port supports (Valheim 1.0, "altbiomes"). */
export const SUPPORTED_WORLD_GEN_VERSION = 2;

/** Normalised height × this = metres. */
export const HEIGHT_SCALE = 200;

const INT_MIN = -0x80000000;
const INT_MAX = 0x7fffffff;
const C0123 = f(0.123);
const C015123 = f(0.15123);
const C0321 = f(0.321);
const C0231 = f(0.231);
const C007 = f(0.07);
const C009 = f(0.9);
const C028 = f(0.28);
const C038 = f(0.38);
const CM02 = f(-0.2);
const C06 = f(0.6);

export class WorldGenerator implements HeightContext {
  readonly version: number;
  readonly off0: number;
  readonly off1: number;
  readonly off2: number;
  readonly off3: number;
  readonly off4: number;
  readonly riverSeed: number;
  readonly streamSeed: number;
  /** Rendered river and stream points (filled by pregeneration or a restore). */
  rivers = new RiverPoints();

  private readonly maxMarsh: number;
  private readonly minDarkland: number;
  private readonly minMountain: number;

  constructor(seed: number, version = SUPPORTED_WORLD_GEN_VERSION) {
    this.version = version;
    this.maxMarsh = version <= 1 ? 8000 : 6000;
    this.minDarkland = version <= 1 ? f(0.5) : f(0.4);
    this.minMountain = version <= 0 ? 1500 : 1000;
    const rnd = new UnityRandom(seed);
    this.off0 = rnd.rangeInt(-10000, 10000);
    this.off1 = rnd.rangeInt(-10000, 10000);
    this.off2 = rnd.rangeInt(-10000, 10000);
    this.off3 = rnd.rangeInt(-10000, 10000);
    this.riverSeed = rnd.rangeInt(INT_MIN, INT_MAX);
    this.streamSeed = rnd.rangeInt(INT_MIN, INT_MAX);
    this.off4 = rnd.rangeInt(-10000, 10000);
  }

  /** `GetBaseHeight` (normalised). */
  baseHeight(x: number, z: number): number {
    const dist = length(x, z);
    const X = x + (100000 + this.off0);
    const Z = z + (100000 + this.off1);
    let h = f(0 + P(X * C0002 * 0.5, Z * C0002 * 0.5) * P(X * C0003 * 0.5, Z * C0003 * 0.5) * 1);
    h = f(h + P(X * C0002, Z * C0002) * P(X * C0003, Z * C0003) * h * C009);
    h = f(h + P(X * C0005, Z * C0005) * P(X * C001, Z * C001) * 0.5 * h);
    h = f(h - C007);
    const a = P(X * C0002 * 0.25 + C0123, Z * C0002 * 0.25 + C015123);
    const b = P(X * C0002 * 0.25 + C0321, Z * C0002 * 0.25 + C0231);
    const ridge = Math.abs(f(a - b));
    let r = f(1 - lerpStep(C002, f(0.12), ridge));
    r = f(r * smoothStep(744, 1000, dist));
    h = f(h * (1 - r));
    if (dist > 10000) {
      let edge = lerp(h, CM02, lerpStep(10000, 10500, dist));
      if (dist > 10490) edge = lerp(edge, -2, lerpStep(10490, 10500, dist));
      return edge;
    }
    const mm = this.minMountain;
    if (dist < mm && h > C028) {
      const t = f(clamp01((h - C028) / C01));
      return lerp(lerp(C028, C038, t), h, lerpStep(f(mm - 400), mm, dist));
    }
    return h;
  }

  isAshlands(x: number, z: number): boolean {
    const ang = worldAngle(x, z) * 100;
    return length(x, f(z - 4000)) > 12000 + ang;
  }

  isDeepNorth(x: number, z: number): boolean {
    const ang = f(worldAngle(x, z) * 100);
    return length(x, f(z + 4000)) > f(12000 + ang);
  }

  /** `GetBiome`: the first rule that matches. */
  biome(x: number, z: number): number {
    const mag = length(x, z);
    const base = this.baseHeight(x, z);
    const ang = f(worldAngle(x, z) * 100);
    const noise = (off: number) => P(f(off + x) * C0001, f(off + z) * C0001);
    if (this.isAshlands(x, z)) return Biome.AshLands;
    if (base <= C002) return Biome.Ocean;
    if (this.isDeepNorth(x, z)) return Biome.DeepNorth;
    if (base > C04) return Biome.Mountain;
    if (noise(this.off0) > C06 && mag > 2000 && mag < this.maxMarsh && base > C005 && base < 0.25) {
      return Biome.Swamp;
    }
    if (noise(this.off4) > this.minDarkland && mag > f(6000 + ang) && mag < 10000) {
      return Biome.Mistlands;
    }
    if (noise(this.off1) > C04 && mag > f(3000 + ang) && mag < 8000) return Biome.Plains;
    if (noise(this.off2) > C04 && mag > f(600 + ang) && mag < 6000) return Biome.BlackForest;
    if (mag > f(5000 + ang)) return Biome.BlackForest;
    return Biome.Meadows;
  }

  /** The 0..1 band that flattens heights near the Ashlands border. */
  ashlandsGap(x: number, z: number): number {
    const ang = worldAngle(x, z) * 100;
    const d = length(x, f(z - 4000)) - (12000 + ang);
    return smoothStepMathf(f(clamp01(Math.abs(d) / 400)));
  }

  deepNorthGap(x: number, z: number): number {
    const ang = worldAngle(x, z) * 100;
    const d = length(x, f(z + 4000)) - (12000 + ang);
    return smoothStepMathf(f(clamp01(Math.abs(d) / 400)));
  }

  /**
   * `GetBiomeHeight` in metres. Ashlands and Deep North are only ported in their
   * pregeneration form (`pregen`); otherwise they give NaN.
   */
  biomeHeight(biome: number, x: number, z: number, pregen = false, flag = true): number {
    if (length(x, z) > 10500) return -400;
    const mult = pregen ? HEIGHT_SCALE : f(200 * this.ashlandsGap(x, z) * this.deepNorthGap(x, z));
    const h = this.normalisedHeight(biome, x, z, pregen, flag);
    return f(h * mult);
  }

  private normalisedHeight(
    biome: number,
    x: number,
    z: number,
    pregen: boolean,
    flag: boolean
  ): number {
    switch (biome) {
      case Biome.Meadows:
      case Biome.Plains:
        return meadowsHeight(this, x, z);
      case Biome.BlackForest:
        return forestHeight(this, x, z);
      case Biome.Swamp:
        return marshHeight(this, x, z);
      case Biome.Mountain:
        return mountainHeight(this, x, z);
      case Biome.Ocean:
        return this.baseHeight(x, z);
      case Biome.Mistlands:
        return pregen ? forestHeight(this, x, z) : mistlandsHeight(this, x, z);
      case Biome.AshLands:
        return pregen ? ashlandsPregenHeight(this, x, z) : NaN;
      case Biome.DeepNorth:
        return pregen ? deepNorthPregenHeight(this, x, z, flag) : NaN;
      default:
        return NaN;
    }
  }

  /** `WorldGenerator.GetHeight`: the point's own biome, no corner blending (metres). */
  getHeight(x: number, z: number): number {
    return this.biomeHeight(this.biome(x, z), x, z);
  }

  /** The height pregeneration tests streams against (metres). */
  pregenHeight(x: number, z: number, flag = true): number {
    return this.biomeHeight(this.biome(x, z), x, z, true, flag);
  }
}
