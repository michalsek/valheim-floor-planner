/** Reading user images for the underlay: checks, downscaling, and data URL conversion. */
const MAX_IMAGE_FILE_BYTES = 50 * 1024 * 1024;
/** Longer sides are scaled down to this. */
const MAX_IMAGE_SIDE_PX = 4096;
/**
 * Files over this are re-encoded even when small enough on screen, so an embedded
 * image (base64 adds a third) stays well inside a plan file's size cap.
 */
const IMAGE_BUDGET_BYTES = 8 * 1024 * 1024;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** Draws `bitmap` at `width` × `height` and encodes it (WebP, else PNG). */
const encode = async (bitmap: ImageBitmap, width: number, height: number): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Couldn't read image");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const webp = await canvasBlob(canvas, 'image/webp', 0.9);
  // Browsers without a WebP encoder hand back PNG anyway.
  const blob = webp?.type === 'image/webp' ? webp : await canvasBlob(canvas, 'image/png');
  if (!blob) throw new Error("Couldn't read image");
  return blob;
};

/**
 * Checks and decodes an image file; one over `MAX_IMAGE_SIDE_PX` is scaled down, and
 * one over `IMAGE_BUDGET_BYTES` re-encoded. Rejects with a message fit for the user.
 */
export const prepareImage = async (file: File): Promise<PreparedImage> => {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" isn't an image.`);
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new Error(`"${file.name}" is over ${MAX_IMAGE_FILE_BYTES / 1024 / 1024} MB.`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (error) {
    throw new Error(`Couldn't read image "${file.name}".`, { cause: error });
  }
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_IMAGE_SIDE_PX / Math.max(width, height));
    if (scale === 1 && file.size <= IMAGE_BUDGET_BYTES) return { blob: file, width, height };
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    return { blob: await encode(bitmap, w, h), width: w, height: h };
  } finally {
    bitmap.close();
  }
};

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read image"));
    reader.readAsDataURL(blob);
  });

/** A `data:` URL back to a Blob; null when it isn't an image data URL. */
export const dataUrlToBlob = async (url: string): Promise<Blob | null> => {
  if (!/^data:image\/[\w.+-]+;base64,/.test(url)) return null;
  try {
    return await (await fetch(url)).blob();
  } catch {
    return null;
  }
};
