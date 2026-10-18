/** The world panel's words. */
import type { GameDataErrorCode } from '../../gameData/GameDataError';
import type { RevealSummary } from '../../store/worldImport';
import { ERROR_MESSAGES } from '../shared/installCopy';

export const WORLD_INTRO =
  'Open a world save to find your builds and import one as a new plan. The save is only read, here in this browser: nothing is uploaded or changed.';

export const WORLD_PLACES: readonly { label: string; path: string }[] = [
  { label: 'Local worlds', path: '~/Library/Application Support/IronGate/Valheim/worlds_local/' },
  {
    label: 'Steam Cloud worlds',
    path: '~/Library/Application Support/Steam/userdata/<id>/892970/remote/worlds/',
  },
];

export const WORLD_DRAG_HINT =
  "Chrome's folder dialog can't open ~/Library. In Finder choose Go → Go to Folder…, paste the path, then drag a world's folder (or the whole worlds folder) onto this panel. A world from a server is the same folder, copied from its save directory.";

export const WORLD_PRIVACY =
  'Only the built pieces are kept (which piece, where, and how it is turned), and in this browser what the ground needs: the seed, your terrain edits and where the world’s locations are. Who placed them (player IDs) and the world’s player list are never read or stored. A plan keeps the ground itself, never the seed.';

const WORLD_ERRORS: Partial<Record<GameDataErrorCode, string>> = {
  notWorld:
    'No world save there. Drop a world’s folder (it holds _main.N.fwl2 and .chunk files), a folder of worlds, or an old .db file.',
  unsupported: 'This save is from a game version the planner can’t read yet.',
  incomplete:
    'The save is missing files. Copy the whole world folder, after the game (or server) has finished saving.',
  corrupt: 'The save doesn’t read cleanly: a file may have been cut short while copying.',
  permission: 'The browser didn’t allow reading this folder. Drag it onto the panel instead.',
  moved: 'The world isn’t there any more. Open it again.',
};

export const worldErrorMessage = (code: GameDataErrorCode): string =>
  WORLD_ERRORS[code] ?? ERROR_MESSAGES[code];

const sitesText = (sizes: readonly number[]): string =>
  `${sizes.length} ${sizes.length === 1 ? 'site' : 'sites'} (${sizes
    .map((n) => n.toLocaleString('en-GB'))
    .join(' + ')} ${sizes.length === 1 && sizes[0] === 1 ? 'piece' : 'pieces'})`;

/**
 * "Revealed 2 sites (122 + 96 pieces)", with any left out and why; null for none.
 * `lead` names what happened to them ("Revealed", "With nearby").
 */
export const revealNotice = (summary: RevealSummary, lead = 'Revealed'): string | null => {
  const { sites, refused } = summary;
  const parts = [
    sites.length > 0 && `${lead} ${sitesText(sites)}`,
    refused.length > 0 &&
      `${sitesText(refused.map((r) => r.pieces))} left out: ${refused[0]!.reason}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('; ') : null;
};

export const REVEAL_TITLE =
  'When the terrain is extended from its edge handles, sites of this world that come onto the larger patch are added to the plan (whole, in its frame), in the same undo step.';
