/**
 * Writes tiny synthetic world saves for tests (the layouts of research/README.md §7):
 * a chunked world folder or a legacy `.db`. Tests only.
 */
import { stableHash } from './stableHash';
import { chunkFileName } from './worldFiles';
import { CHUNKED_VERSION } from './zpackage';

export interface FixtureZdo {
  prefab: string;
  position: [number, number, number];
  /** Euler degrees (pitch, yaw, roll); none when all are 0. */
  rotation?: [number, number, number];
  /** The `creator` long; left out for world-generated objects. */
  creator?: bigint;
  /** Extra data, to exercise every section. */
  ints?: number;
  strings?: string[];
  bytes?: number;
  connection?: boolean;
  /** Saved as two int16s (y = 0), as the game does for whole-number ground objects. */
  smallPosition?: boolean;
}

class Writer {
  private bytes: number[] = [];
  private view = new DataView(new ArrayBuffer(8));

  private put(n: number) {
    for (let i = 0; i < n; i++) this.bytes.push(this.view.getUint8(i));
  }
  u8(v: number) {
    this.bytes.push(v & 0xff);
  }
  u16(v: number) {
    this.view.setUint16(0, v, true);
    this.put(2);
  }
  i16(v: number) {
    this.view.setInt16(0, v, true);
    this.put(2);
  }
  i32(v: number) {
    this.view.setInt32(0, v, true);
    this.put(4);
  }
  u32(v: number) {
    this.view.setUint32(0, v, true);
    this.put(4);
  }
  i64(v: bigint) {
    this.view.setBigInt64(0, v, true);
    this.put(8);
  }
  f32(v: number) {
    this.view.setFloat32(0, v, true);
    this.put(4);
  }
  f64(v: number) {
    this.view.setFloat64(0, v, true);
    this.put(8);
  }
  raw(data: Uint8Array) {
    this.bytes.push(...data);
  }
  string(s: string) {
    const data = new TextEncoder().encode(s);
    this.u8(data.length); // short strings only
    this.raw(data);
  }
  count(n: number, version: number) {
    if (n < 0x80 || version < 33) this.u8(n);
    else {
      this.u8(0x80 | (n >> 8));
      this.u8(n & 0xff);
    }
  }
  done = () => Uint8Array.from(this.bytes);
}

/** The 0.5° truncation the game applies (`(uint)(deg × 2)`). */
const half = (deg: number) => Math.floor(deg * 2);

const writeZdo = (w: Writer, z: FixtureZdo, version: number) => {
  const rotation = z.rotation ?? [0, 0, 0];
  const longs = z.creator !== undefined;
  let flags = 256 | (2 << 10);
  if (z.connection) flags |= 1;
  if (z.ints) flags |= 16;
  if (longs) flags |= 32;
  if (z.strings) flags |= 64;
  if (z.bytes) flags |= 128;
  if (rotation.some((r) => r !== 0)) flags |= 1 << 12;
  if (z.smallPosition) flags |= 1 << 13;
  w.u16(flags);
  if (version < CHUNKED_VERSION) w.u32(0);
  if (z.smallPosition) {
    w.i16(z.position[0]);
    w.i16(z.position[2]);
  } else z.position.forEach((v) => w.f32(v));
  w.i32(stableHash(z.prefab));
  if (flags & (1 << 12)) {
    const [x, y, r] = rotation;
    if (version < CHUNKED_VERSION) rotation.forEach((v) => w.f32(v));
    else if (x === 0 && r === 0) w.u16(0x8000 | half(y));
    else {
      const packed = half(x) | (half(y) << 10) | (half(r) << 20);
      w.u16(packed >>> 16);
      w.u16(packed & 0xffff);
    }
  }
  if (!(flags & 0xff)) return;
  if (z.connection) {
    w.u8(19);
    w.i32(12345);
  }
  if (z.ints) {
    w.count(z.ints, version);
    for (let i = 0; i < z.ints; i++) {
      w.i32(i);
      w.i32(i * 7);
    }
  }
  if (longs) {
    w.count(1, version);
    w.i32(stableHash('creator'));
    w.i64(z.creator!);
  }
  if (z.strings) {
    w.count(z.strings.length, version);
    z.strings.forEach((s, i) => {
      w.i32(i);
      w.string(s);
    });
  }
  if (z.bytes) {
    w.count(1, version);
    w.i32(stableHash('data'));
    w.i32(z.bytes);
    w.raw(new Uint8Array(z.bytes).fill(7));
  }
};

const fwl2 = (name: string): Uint8Array => {
  const body = new Writer();
  body.i32(42);
  body.string(name);
  body.string('seed');
  body.i32(1234);
  body.i64(99n);
  body.i32(2);
  // Player history and the rest: never read.
  body.raw(new Uint8Array([1, 2, 3, 4]));
  const data = body.done();
  const w = new Writer();
  w.i32(data.length);
  w.raw(data);
  return w.done();
};

/** A chunked world folder: file name → bytes. `chunks` maps a chunk index to its ZDOs. */
export const chunkedWorld = (
  name: string,
  generation: number,
  chunks: ReadonlyMap<number, readonly FixtureZdo[]>
): Map<string, Uint8Array> => {
  const files = new Map<string, Uint8Array>();
  const manifest = new Writer();
  const total = [...chunks.values()].reduce((n, zdos) => n + zdos.length, 0);
  manifest.u16(42);
  manifest.i32(total);
  manifest.i32(chunks.size);
  for (const [chunk, zdos] of chunks) {
    const entry = { chunk, size: 0, chunkVersion: 3 };
    manifest.u16(chunk);
    manifest.u8(0);
    manifest.u32(entry.chunkVersion);
    manifest.i32(zdos.length);
    const w = new Writer();
    w.i16(42);
    w.i32(zdos.length);
    zdos.forEach((z) => writeZdo(w, z, 42));
    files.set(chunkFileName(entry), w.done());
  }
  const n = generation;
  files.set(`_main.${n}.chunks`, manifest.done());
  files.set(`_main.${n}.fwl2`, fwl2(name));
  files.set(`_main.${n}.db2`, new Uint8Array(16));
  files.set(`_main.${n}.ok`, Uint8Array.of(42, 0, 0, 0));
  return files;
};

/** A legacy `.db` at `version` (31–39). */
export const legacyDb = (zdos: readonly FixtureZdo[], version = 34): Uint8Array => {
  const w = new Writer();
  w.i32(version);
  w.f64(1234.5);
  w.i64(1n);
  w.u32(77);
  w.i32(zdos.length);
  zdos.forEach((z) => writeZdo(w, z, version));
  return w.done();
};
