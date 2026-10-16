/**
 * Plan files on disk: save (picker or download), pick and read. Browser I/O only. A
 * file may carry the underlay image as a top-level `underlayImage` data URL.
 */
import { parsePlan, PlanParseError, serializePlan } from '../model/serialize';
import { DEFAULT_PLAN_NAME, type Plan } from '../model/types';

import { blobToDataUrl, dataUrlToBlob } from './prepareImage';

const EXTENSION = '.valheimplan.json';
/** Largest plan file saved with an embedded image, or opened. */
const MAX_PLAN_FILE_BYTES = 30 * 1024 * 1024;
const MAX_PLAN_FILE_MB = MAX_PLAN_FILE_BYTES / 1024 / 1024;

/** `Hall: v2` → `Hall_ v2.valheimplan.json` (characters file systems reject become `_`). */
export const planFileName = (name: string): string =>
  `${name.replace(/[/\\:*?"<>|]/g, '_').trim() || DEFAULT_PLAN_NAME}${EXTENSION}`;

// The File System Access API (Chromium only), declared locally: it isn't in lib.dom.
interface WritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface SaveFileHandle {
  /** The name the user chose. */
  name: string;
  createWritable(): Promise<WritableFile>;
}
type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<SaveFileHandle>;

const saveFilePicker = (): SaveFilePicker | undefined =>
  (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

const download = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Some browsers start the download a little after the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * How a plan was saved, under which file name, and whether an image that was asked for
 * was left out (too big); null when the picker was cancelled.
 */
type SaveResult = {
  via: 'picker' | 'download';
  fileName: string;
  imageSkipped: boolean;
} | null;

/**
 * The file's contents: the plan, with the underlay image as a data URL when one is
 * given and the file stays within `MAX_PLAN_FILE_BYTES` (else without it).
 */
const buildPlanBlob = async (
  plan: Plan,
  underlayImage: (() => Promise<Blob | null>) | undefined
): Promise<{ blob: Blob; imageSkipped: boolean }> => {
  const toBlob = (text: string) => new Blob([text], { type: 'application/json' });
  const image = underlayImage ? await underlayImage() : null;
  if (image) {
    const blob = toBlob(serializePlan(plan, { underlayImage: await blobToDataUrl(image) }));
    if (blob.size <= MAX_PLAN_FILE_BYTES) return { blob, imageSkipped: false };
  }
  return { blob: toBlob(serializePlan(plan)), imageSkipped: image !== null };
};

/**
 * Saves through the browser's save picker where there is one (it needs a user
 * gesture, so it opens before the image is read), otherwise as a download.
 * `underlayImage` supplies the image to embed, if any.
 */
export const savePlanFile = async (
  plan: Plan,
  { underlayImage }: { underlayImage?: () => Promise<Blob | null> } = {}
): Promise<SaveResult> => {
  const fileName = planFileName(plan.name);
  const picker = saveFilePicker();
  if (!picker) {
    const { blob, imageSkipped } = await buildPlanBlob(plan, underlayImage);
    download(blob, fileName);
    return { via: 'download', fileName, imageSkipped };
  }
  try {
    const handle = await picker({
      suggestedName: fileName,
      types: [{ description: 'Valheim plan', accept: { 'application/json': ['.json'] } }],
    });
    const { blob, imageSkipped } = await buildPlanBlob(plan, underlayImage);
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { via: 'picker', fileName: handle.name, imageSkipped };
  } catch (error) {
    if (isAbort(error)) return null;
    throw error;
  }
};

/** Opens the browser's file picker for `accept` types; null when it is dismissed. */
export const pickFile = (accept: string): Promise<File | null> =>
  new Promise((resolve) => {
    // A fresh input each time, so picking the same file again still fires `change`.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.hidden = true;
    const done = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => done(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => done(null), { once: true });
    document.body.append(input);
    input.click();
  });

export const pickPlanFile = (): Promise<File | null> => pickFile('.json,application/json');

export interface PlanFile {
  plan: Plan;
  /** The embedded underlay image, if the file has one. */
  underlayImage: Blob | null;
}

const embeddedImage = async (raw: unknown): Promise<Blob | null> => {
  if (typeof raw !== 'object' || raw === null || !('underlayImage' in raw)) return null;
  const url = raw.underlayImage;
  return typeof url === 'string' ? dataUrlToBlob(url) : null;
};

/** Reads and validates a plan file; rejects with a message fit for the user. */
export const readPlanFile = async (file: File): Promise<PlanFile> => {
  if (file.size > MAX_PLAN_FILE_BYTES) {
    throw new Error(`"${file.name}" is over ${MAX_PLAN_FILE_MB} MB.`);
  }
  try {
    const raw: unknown = JSON.parse(await file.text());
    return { plan: parsePlan(raw), underlayImage: await embeddedImage(raw) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`"${file.name}" isn't valid JSON.`, { cause: error });
    }
    if (error instanceof PlanParseError) {
      throw new Error(`"${file.name}" isn't a valid plan. ${error.message}.`, { cause: error });
    }
    throw error;
  }
};
