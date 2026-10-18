/**
 * A site's heights in a plan file (version 6): each value less the plane through its
 * left, upper and upper-left neighbours (smooth ground leaves small residuals), the
 * residuals' low bytes then their high bytes, deflated, in base64. Lossless, and about
 * 2.4× smaller than the raw int16 values (Findings, "Site terrain storage"). Pure:
 * `CompressionStream` / `DecompressionStream`, `btoa` / `atob`.
 */

/** `SiteTerrain.heights` as a version 6 file holds it. */
export interface PackedHeights {
  packing: typeof PACKING;
  data: string;
}

export const PACKING = 'plane/deflate';

/** Residuals of `heights` (`cols` a row) against the plane predictor, wrapping as int16. */
const predict = (heights: Int16Array, cols: number, out: Int16Array, undo: boolean): void => {
  // Decoding reads the values already rebuilt; encoding the originals. Both are `src`.
  const src = undo ? out : heights;
  for (let k = 0; k < heights.length; k++) {
    const i = k % cols;
    const left = i > 0 ? src[k - 1]! : k >= cols ? src[k - cols]! : 0;
    const up = k >= cols ? src[k - cols]! : left;
    const corner = i > 0 && k >= cols ? src[k - cols - 1]! : left;
    const guess = left + up - corner;
    out[k] = undo ? heights[k]! + guess : heights[k]! - guess;
  }
};

const toBase64 = (bytes: Uint8Array): string => {
  let text = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(text);
};

const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** All of a stream's bytes, refusing more than `limit`. */
const readAll = async (
  stream: ReadableStream<Uint8Array>,
  limit: number
): Promise<Uint8Array<ArrayBuffer>> => {
  const out = new Uint8Array(limit);
  let length = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out.subarray(0, length);
    if (length + value.length > limit) {
      await reader.cancel();
      throw new Error('more heights than the patch has');
    }
    out.set(value, length);
    length += value.length;
  }
};

const through = (bytes: Uint8Array<ArrayBuffer>, transform: ReadableWritablePair) =>
  new Blob([bytes]).stream().pipeThrough(transform);

const packed = new WeakMap<Int16Array, Promise<PackedHeights>>();

/** `heights`, `cols` values a row, packed (once per array: files and the fallback share it). */
export const packHeights = (heights: Int16Array, cols: number): Promise<PackedHeights> => {
  let pack = packed.get(heights);
  if (!pack) {
    pack = (async () => {
      const residuals = new Int16Array(heights.length);
      predict(heights, cols, residuals, false);
      const n = residuals.length;
      const planes = new Uint8Array(2 * n);
      for (let k = 0; k < n; k++) {
        planes[k] = residuals[k]! & 0xff;
        planes[n + k] = (residuals[k]! >> 8) & 0xff;
      }
      const deflated = await readAll(
        through(planes, new CompressionStream('deflate')),
        // Deflate's worst case is a little over the input.
        2 * n + 1024 + n / 8
      );
      return { packing: PACKING, data: toBase64(deflated) };
    })();
    packed.set(heights, pack);
  }
  return pack;
};

/** Packed heights back as `cols` × `rows` values; throws when they don't unpack to that. */
export const unpackHeights = async (
  { data }: PackedHeights,
  cols: number,
  rows: number
): Promise<Int16Array> => {
  const n = cols * rows;
  const planes = await readAll(
    through(fromBase64(data), new DecompressionStream('deflate')),
    2 * n
  );
  if (planes.length !== 2 * n) throw new Error(`fewer heights than ${cols} × ${rows}`);
  const residuals = new Int16Array(n);
  for (let k = 0; k < n; k++) residuals[k] = planes[k]! | (planes[n + k]! << 8);
  const heights = new Int16Array(n);
  predict(residuals, cols, heights, true);
  return heights;
};

/** Whether `value` has the shape of `PackedHeights` (not whether it unpacks). */
export const isPackedHeights = (value: unknown): value is PackedHeights =>
  typeof value === 'object' &&
  value !== null &&
  (value as PackedHeights).packing === PACKING &&
  typeof (value as PackedHeights).data === 'string';
