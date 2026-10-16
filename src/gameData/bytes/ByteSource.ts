/**
 * Random-access bytes: a file on disk (read lazily) or a node inside a bundle.
 * Reads are synchronous; the parser runs in a worker.
 */
import { check } from '../GameDataError';

export interface ByteSource {
  readonly size: number;
  /** Exactly `len` bytes from `off`; throws when the range is out of bounds. */
  read(off: number, len: number): Uint8Array;
}

/** Throws `corrupt` unless `off`..`off + len` lies within `source`. */
export const checkRange = (source: { size: number }, off: number, len: number): void =>
  check(
    off >= 0 && len >= 0 && off + len <= source.size,
    () => `read ${off}+${len} of ${source.size}`
  );
