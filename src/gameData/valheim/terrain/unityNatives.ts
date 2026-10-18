/**
 * Unity's two native helpers that Valheim's world generator calls: `Mathf.PerlinNoise` and
 * `UnityEngine.Random`, plus the float32 rounding helper the port uses everywhere.
 *
 * Mathf.PerlinNoise and UnityEngine.Random reimplemented from the constants in
 * ricosolana/Valhalla (VUtilsMath.cpp, VUtilsRandom.cpp), MIT licence, © its authors:
 * https://github.com/ricosolana/Valhalla
 *
 * Validated against a real 1.0 save (research/README.md §8); goldens in
 * research/terrainGoldens.json.
 */

/** Round to float32 (the game's `conv.r4`). Used exactly where worldGen.py rounds. */
export const f = Math.fround;

// Ken Perlin's 2002 reference permutation, doubled so lookups never wrap.
const PERM = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142,
  8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203,
  117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165,
  71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92,
  41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208,
  89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217,
  226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58,
  17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155,
  167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218,
  246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
  239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150,
  254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];
const P = Uint8Array.from([...PERM, ...PERM]);
const p = (i: number): number => P[i]!;

/** The 16-entry gradient switch of improved noise, at z = 0. */
const grad = (hash: number, x: number, y: number): number => {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
  return (h & 1 ? -u : u) + (h & 2 ? -v : v);
};

const OUT_OFFSET = f(0.69);
const OUT_SCALE = f(1.483);

/** `Mathf.PerlinNoise(x, y)`: arguments are float32; roughly 0..1. */
export const perlin = (px: number, py: number): number => {
  let x = Math.abs(f(px));
  let y = Math.abs(f(py));
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  x = f(x - xi);
  y = f(y - yi);
  const X = xi & 255;
  const Y = yi & 255;
  const A = p(X) + Y;
  const B = p(X + 1) + Y;
  const u = x * x * x * (x * (x * 6 - 15) + 10);
  const v = y * y * y * (y * (y * 6 - 15) + 10);
  const g1 = f(grad(p(p(A)), x, y));
  const g2 = f(grad(p(p(B)), x - 1, y));
  const g3 = f(grad(p(p(A + 1)), x, y - 1));
  const g4 = f(grad(p(p(B + 1)), x - 1, y - 1));
  const l1 = f(g1 + f(u) * (g2 - g1));
  const l2 = f(g3 + f(u) * (g4 - g3));
  const res = f(l1 + f(v) * (l2 - l1));
  return f((res + OUT_OFFSET) / OUT_SCALE);
};

/** The four xorshift128 words. */
export type RandomState = readonly [number, number, number, number];

const INIT_MULTIPLIER = 1812433253;
const VALUE_SCALE = f(1.192093e-7);

/** `UnityEngine.Random`: xorshift128 seeded with the MT19937 init constant. */
export class UnityRandom {
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;

  constructor(seed = 0) {
    this.initState(seed);
  }

  initState(seed: number): void {
    this.s0 = seed >>> 0;
    this.s1 = (Math.imul(this.s0, INIT_MULTIPLIER) + 1) >>> 0;
    this.s2 = (Math.imul(this.s1, INIT_MULTIPLIER) + 1) >>> 0;
    this.s3 = (Math.imul(this.s2, INIT_MULTIPLIER) + 1) >>> 0;
  }

  get state(): RandomState {
    return [this.s0, this.s1, this.s2, this.s3];
  }

  set state([s0, s1, s2, s3]: RandomState) {
    this.s0 = s0 >>> 0;
    this.s1 = s1 >>> 0;
    this.s2 = s2 >>> 0;
    this.s3 = s3 >>> 0;
  }

  /** The next raw 32-bit word (unsigned). */
  nextUint(): number {
    const t = (this.s0 ^ (this.s0 << 11)) >>> 0;
    const next = (this.s3 ^ (this.s3 >>> 19) ^ t ^ (t >>> 8)) >>> 0;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = this.s3;
    this.s3 = next;
    return next;
  }

  /** `Random.value`: float32 in [0, 1]. */
  value(): number {
    return f((this.nextUint() & 0x7fffff) * VALUE_SCALE);
  }

  /** `Random.Range(int, int)`: `min + next % span` (unsigned), max exclusive, as int32. */
  rangeInt(min: number, max: number): number {
    if (min === max) return min;
    const lo = Math.min(min, max);
    const span = (Math.max(min, max) - lo) >>> 0;
    return (lo + (this.nextUint() % span)) | 0;
  }

  /** `Random.Range(float, float)`: `(1 − r)·max + r·min` in float32. */
  rangeFloat(min: number, max: number): number {
    const r = this.value();
    return f(f(f(1 - r) * f(max)) + f(r * f(min)));
  }
}
