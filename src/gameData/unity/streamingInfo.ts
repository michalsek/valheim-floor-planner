/**
 * `StreamingInfo`: where a Mesh's vertex data or a Texture2D's pixels live when they
 * aren't inline: a byte range of a resource node (`CAB-….resS`) in the same bundle,
 * named as `archive:/CAB-x/CAB-x.resS`.
 */
import { checkRange, type ByteSource } from '../bytes/ByteSource';
import { check } from '../GameDataError';

import type { Bundle } from './bundle';
import { fields, num, str } from './values';

export interface StreamingInfo {
  path: string;
  offset: number;
  size: number;
}

/** Reads the bytes a `StreamingInfo` names. */
export type ResourceReader = (info: StreamingInfo) => Uint8Array;

/** The object's `m_StreamData`, or null when its data is inline (an empty path). */
export const streamingInfo = (value: unknown, what: string): StreamingInfo | null => {
  const info = fields(value, what);
  const path = str(info.path, `${what}.path`);
  if (path === '') return null;
  const offset = info.offset;
  check(
    typeof offset === 'bigint' && offset >= 0n && offset <= BigInt(Number.MAX_SAFE_INTEGER),
    () => `${what}.offset: bad offset ${String(offset)}`
  );
  return { path, offset: Number(offset), size: num(info.size, `${what}.size`) };
};

const basename = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** The byte range `info` names, as a source of its own. */
export const streamSource = (bundle: Bundle, info: StreamingInfo): ByteSource => {
  const node = bundle.node(basename(info.path));
  checkRange(node, info.offset, info.size);
  return {
    size: info.size,
    read: (off, len) => {
      checkRange(info, off, len);
      return node.read(info.offset + off, len);
    },
  };
};

/** Reads streamed data from the bundle's own resource nodes. */
export const bundleResources =
  (bundle: Bundle): ResourceReader =>
  (info) =>
    streamSource(bundle, info).read(0, info.size);
