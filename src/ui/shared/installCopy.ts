/** Words the install gate and the status-strip menu share. */
import type { GameDataErrorCode } from '../../gameData/GameDataError';
import type { ExtractPhase } from '../../gameData/valheim/extractCatalogue';
import type { InstallInfo } from '../../install/installStore';

export const ERROR_MESSAGES: Readonly<Record<GameDataErrorCode, string>> = {
  notInstall:
    "This folder isn't a Valheim install. Choose the folder Steam installed the game in (…/steamapps/common/Valheim).",
  server:
    'This is the Valheim dedicated server, which has no building pieces. Choose the game itself.',
  unsupported:
    "This Valheim build stores its files in a format the planner can't read yet. The planner needs an update.",
  incomplete:
    'The install looks incomplete: a file is missing or shorter than expected. Let Steam finish updating (or verify the game files), then try again.',
  corrupt:
    "Some game files couldn't be read. Verify the game files in Steam (Properties → Installed Files), then try again.",
  busy: 'The game files changed while they were being read; Steam is probably updating Valheim. Wait for it to finish, then try again.',
  permission:
    "The browser didn't allow reading this folder. Try again and allow access, or use “Select with upload dialog”.",
  missingPieces:
    'This Valheim version renamed or removed pieces the planner relies on, so the planner needs an update.',
  moved: 'The folder was moved or deleted. Choose it again.',
  workerFailed:
    "The parser couldn't start in this browser (it runs in a module Web Worker). Reload the page and try again, or use a current Chrome, Edge, Firefox or Safari.",
};

/** Shown after the folder picker closed without a folder. */
export const PICKER_HINT =
  'If Chrome said the folder contains system files, drag the Valheim folder onto this page instead.';

export const PHASES: readonly { phase: ExtractPhase; label: string }[] = [
  { phase: 'bundle', label: 'Opening the game data' },
  { phase: 'pieces', label: "Reading the Hammer's pieces" },
  { phase: 'shapes', label: 'Measuring snap points and colliders' },
  { phase: 'names', label: 'Reading English and Polish names' },
];

export const phaseLabel = (phase: ExtractPhase): string =>
  PHASES.find((p) => p.phase === phase)?.label ?? phase;

/** In English, like the rest of the UI. */
export const formatScanDate = (info: InstallInfo): string =>
  new Date(info.scannedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
