/**
 * Checked accessors for values read through type trees (`readValue` returns `unknown`).
 * A wrong shape means the game data isn't what we expect: `corrupt`.
 */
import { check } from '../GameDataError';

import type { SerializedFile } from './serializedFile';

export type Fields = Readonly<Record<string, unknown>>;
export type V3 = [x: number, y: number, z: number];

export const fields = (value: unknown, what: string): Fields => {
  check(
    typeof value === 'object' && value !== null && !Array.isArray(value),
    () => `${what}: not an object`
  );
  return value as Fields;
};

export const num = (value: unknown, what: string): number => {
  if (typeof value === 'boolean') return Number(value);
  check(typeof value === 'number', () => `${what}: not a number`);
  return value;
};

export const str = (value: unknown, what: string): string => {
  check(typeof value === 'string', () => `${what}: not a string`);
  return value;
};

export const list = (value: unknown, what: string): readonly unknown[] => {
  check(Array.isArray(value), () => `${what}: not an array`);
  return value;
};

/** True for a non-zero bool / UInt8 flag. */
export const flag = (value: unknown, what: string): boolean => num(value, what) !== 0;

export const vec3 = (value: unknown, what: string): V3 => {
  const v = fields(value, what);
  return [num(v.x, what), num(v.y, what), num(v.z, what)];
};

export const quat = (value: unknown, what: string): [number, number, number, number] => {
  const q = fields(value, what);
  return [num(q.x, what), num(q.y, what), num(q.z, what), num(q.w, what)];
};

/** A `PPtr`: `fileId` 0 is this file, n > 0 is `SerializedFile.externals[n - 1]`. */
export interface PPtr {
  fileId: number;
  pathId: bigint;
}

export const pptr = (value: unknown, what: string): PPtr => {
  const ptr = fields(value, what);
  const pathId = ptr.m_PathID;
  check(typeof pathId === 'bigint', () => `${what}: not a PPtr`);
  return { fileId: num(ptr.m_FileID, what), pathId };
};

/**
 * The path ID a `PPtr` points at in the same file, or null when it is empty or points
 * into another file (`m_FileID` ≠ 0).
 */
export const localRef = (value: unknown, what: string): bigint | null => {
  const { fileId, pathId } = pptr(value, what);
  return fileId === 0 && pathId !== 0n ? pathId : null;
};

/** A `[name, value]` list (a material's `m_Floats`, `m_TexEnvs`) as a map. */
export const namedPairs = (value: unknown, what: string): Map<string, unknown> =>
  new Map(
    list(value, what).map((entry) => {
      const [key, item] = list(entry, what);
      return [str(key, what), item];
    })
  );

/** Reads several objects (in file order) as field records. */
export const readFields = (file: SerializedFile, ids: Iterable<bigint>): Map<bigint, Fields> =>
  new Map([...file.readMany(ids)].map(([id, value]) => [id, fields(value, `object ${id}`)]));
