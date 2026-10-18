/**
 * The river cache file: pregenerated definitions and render states as one little-endian
 * binary (~80–100 KB per world), plus the FNV-1a hash the goldens compare.
 *
 * Layout: magic `VTPG`, format, lake / river / stream / Deep North stream counts (the last
 * 0xFFFFFFFF when the pass was skipped), three 4-word random states, then float32 `[x, z]`
 * per lake and the 8 float32 fields of each river definition, in order.
 */
import { GameDataError } from '../../GameDataError';

import type { Lake, Pregenerated } from './pregenerate';
import type { RiverDef } from './rivers';
import type { RandomState } from './unityNatives';

const MAGIC = 0x47505456;
const FORMAT = 1;
const NONE = 0xffffffff;
const HEADER_WORDS = 6 + 12;
const DEF_FIELDS = 8;

const defFields = (r: RiverDef): number[] => [
  r.p0x,
  r.p0z,
  r.p1x,
  r.p1z,
  r.widthMax,
  r.widthMin,
  r.curveWidth,
  r.curveWavelength,
];

const toDef = (v: Float32Array, at: number): RiverDef => ({
  p0x: v[at]!,
  p0z: v[at + 1]!,
  p1x: v[at + 2]!,
  p1z: v[at + 3]!,
  widthMax: v[at + 4]!,
  widthMin: v[at + 5]!,
  curveWidth: v[at + 6]!,
  curveWavelength: v[at + 7]!,
});

export const encodePregenerated = (pre: Pregenerated): ArrayBuffer => {
  const deep = pre.deepStreams ?? [];
  const floats = [
    ...pre.lakes.flatMap((l) => [l.x, l.z]),
    ...[...pre.rivers, ...pre.streams, ...deep].flatMap(defFields),
  ];
  const buffer = new ArrayBuffer(HEADER_WORDS * 4 + floats.length * 4);
  const view = new DataView(buffer);
  const counts = [pre.lakes.length, pre.rivers.length, pre.streams.length];
  const states = [pre.states.rivers, pre.states.streams, pre.states.deepStreams ?? [0, 0, 0, 0]];
  const words = [MAGIC, FORMAT, ...counts, pre.deepStreams ? deep.length : NONE, ...states.flat()];
  words.forEach((w, i) => view.setUint32(i * 4, w, true));
  floats.forEach((v, i) => view.setFloat32((HEADER_WORDS + i) * 4, v, true));
  return buffer;
};

export const decodePregenerated = (buffer: ArrayBuffer): Pregenerated => {
  const corrupt = (detail: string) => new GameDataError('corrupt', `river cache: ${detail}`);
  if (buffer.byteLength < HEADER_WORDS * 4) throw corrupt('too short');
  const view = new DataView(buffer);
  const word = (i: number) => view.getUint32(i * 4, true);
  if (word(0) !== MAGIC || word(1) !== FORMAT) throw corrupt('unknown format');
  const [lakes, rivers, streams, deepCount] = [word(2), word(3), word(4), word(5)];
  const deep = deepCount === NONE ? 0 : deepCount;
  const nFloats = 2 * lakes + DEF_FIELDS * (rivers + streams + deep);
  if (buffer.byteLength !== (HEADER_WORDS + nFloats) * 4) throw corrupt('bad length');
  const state = (at: number): RandomState => [word(at), word(at + 1), word(at + 2), word(at + 3)];
  const v = new Float32Array(nFloats);
  for (let i = 0; i < nFloats; i++) v[i] = view.getFloat32((HEADER_WORDS + i) * 4, true);
  const lakeList: Lake[] = Array.from({ length: lakes }, (_, i) => ({
    x: v[2 * i]!,
    z: v[2 * i + 1]!,
  }));
  let at = 2 * lakes;
  const defs = (n: number): RiverDef[] =>
    Array.from({ length: n }, () => {
      const d = toDef(v, at);
      at += DEF_FIELDS;
      return d;
    });
  const riverDefs = defs(rivers);
  const streamDefs = defs(streams);
  return {
    lakes: lakeList,
    rivers: riverDefs,
    streams: streamDefs,
    deepStreams: deepCount === NONE ? null : defs(deep),
    states: {
      rivers: state(6),
      streams: state(10),
      deepStreams: deepCount === NONE ? null : state(14),
    },
  };
};

/** FNV-1a (32-bit) over the values as float32 little-endian bytes. */
export const fnv1a32 = (values: readonly number[]): number => {
  const view = new DataView(new ArrayBuffer(values.length * 4));
  values.forEach((v, i) => view.setFloat32(i * 4, v, true));
  const bytes = new Uint8Array(view.buffer);
  let h = 0x811c9dc5;
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193);
  return h >>> 0;
};

/** The golden hashes: `[x, z]` per lake; `[p0, p1, widthMin, widthMax]` per river. */
export const lakesHash = (lakes: readonly Lake[]): number =>
  fnv1a32(lakes.flatMap((l) => [l.x, l.z]));

export const riversHash = (defs: readonly RiverDef[]): number =>
  fnv1a32(defs.flatMap((r) => [r.p0x, r.p0z, r.p1x, r.p1z, r.widthMin, r.widthMax]));
