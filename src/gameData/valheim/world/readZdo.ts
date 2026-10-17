/**
 * One ZDO (`ZDO.Load`), v31–42. There's no per-ZDO length, so every ZDO is walked in
 * full; only what the planner needs is kept. The creator (a player ID) is reduced to
 * "built by a player" on the spot and never leaves this function.
 */
import type { ByteReader } from '../../bytes/ByteReader';

import { stableHash } from './stableHash';
import { CHUNKED_VERSION, readNumItems, readSmallRotation, skipString } from './zpackage';

export interface Zdo {
  /** The prefab's stable hash. */
  prefab: number;
  /** World position (metres, raw Unity axes). */
  x: number;
  y: number;
  z: number;
  /** Stored Euler degrees (truncated to 0.5° from v40; see `snapAngle`). */
  pitch: number;
  yaw: number;
  roll: number;
  /** A non-zero `creator` long: placed by a player (ruins have none). */
  built: boolean;
}

const CREATOR = stableHash('creator');

/** `ZDO.ExtraDataFlags`. */
const CONNECTION = 1;
const LONGS = 32;
const STRINGS = 64;
const BYTE_ARRAYS = 128;
const HAS_ROTATION = 1 << 12;
const SMALL_POSITION = 1 << 13;

/** Data sections with fixed-size values, in the order they're written: bit → bytes. */
const FIXED_SECTIONS: ReadonlyMap<number, number> = new Map([
  [2, 4], // floats
  [4, 12], // vec3s
  [8, 16], // quaternions
  [16, 4], // ints
]);

/** Walks one data section; returns whether it held a non-zero creator. */
const readSection = (r: ByteReader, version: number, bit: number): boolean => {
  let built = false;
  const count = readNumItems(r, version);
  for (let i = 0; i < count; i++) {
    const key = r.i32();
    if (bit === LONGS) {
      const value = r.i64();
      if (key === CREATOR && value !== 0n) built = true;
    } else if (bit === STRINGS) {
      skipString(r);
    } else if (bit === BYTE_ARRAYS) {
      // The length goes into a local first (research §7, "a1 pitfall").
      const length = r.i32();
      r.bytesView(length);
    } else {
      r.bytesView(FIXED_SECTIONS.get(bit)!);
    }
  }
  return built;
};

const SECTION_BITS = [2, 4, 8, 16, LONGS, STRINGS, BYTE_ARRAYS];

export const readZdo = (r: ByteReader, version: number): Zdo => {
  const flags = r.u16();
  if (version < CHUNKED_VERSION) r.bytesView(4); // the sector, discarded
  let x: number, y: number, z: number;
  if (flags & SMALL_POSITION) {
    x = r.i16();
    y = 0;
    z = r.i16();
  } else {
    x = r.f32();
    y = r.f32();
    z = r.f32();
  }
  const prefab = r.i32();
  let rotation: [number, number, number] = [0, 0, 0];
  if (flags & HAS_ROTATION) {
    rotation = version >= CHUNKED_VERSION ? readSmallRotation(r) : [r.f32(), r.f32(), r.f32()];
  }
  let built = false;
  if (flags & 0xff) {
    if (flags & CONNECTION) r.bytesView(5); // a type byte (a flag set) and a hash
    for (const bit of SECTION_BITS) {
      if (flags & bit && readSection(r, version, bit)) built = true;
    }
  }
  const [pitch, yaw, roll] = rotation;
  return { prefab, x, y, z, pitch, yaw, roll, built };
};
