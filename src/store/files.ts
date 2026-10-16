/** Plan files on disk: save (picker or download), pick and read. Browser I/O only. */
import { parsePlan, PlanParseError, serializePlan } from '../model/serialize';
import { DEFAULT_PLAN_NAME, type Plan } from '../model/types';

const EXTENSION = '.valheimplan.json';
const MAX_PLAN_FILE_BYTES = 5 * 1024 * 1024;

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
  // The download has started by the next tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** How a plan was saved, and under which file name; null when the picker was cancelled. */
type SaveResult = { via: 'picker' | 'download'; fileName: string } | null;

/**
 * Saves through the browser's save picker where there is one (it needs a user
 * gesture), otherwise as a download.
 */
export const savePlanFile = async (plan: Plan): Promise<SaveResult> => {
  const blob = new Blob([serializePlan(plan)], { type: 'application/json' });
  const fileName = planFileName(plan.name);
  const picker = saveFilePicker();
  if (!picker) {
    download(blob, fileName);
    return { via: 'download', fileName };
  }
  try {
    const handle = await picker({
      suggestedName: fileName,
      types: [{ description: 'Valheim plan', accept: { 'application/json': ['.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { via: 'picker', fileName: handle.name };
  } catch (error) {
    if (isAbort(error)) return null;
    throw error;
  }
};

/** Opens the browser's file picker; null when it is dismissed. */
export const pickPlanFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    // A fresh input each time, so picking the same file again still fires `change`.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
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

/** Reads and validates a plan file; rejects with a message fit for the user. */
export const readPlanFile = async (file: File): Promise<Plan> => {
  if (file.size > MAX_PLAN_FILE_BYTES) {
    throw new Error(`"${file.name}" is over ${MAX_PLAN_FILE_BYTES / 1024 / 1024} MB.`);
  }
  try {
    return parsePlan(JSON.parse(await file.text()));
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
