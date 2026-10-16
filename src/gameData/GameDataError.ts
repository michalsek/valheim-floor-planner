/**
 * Why reading the game files failed. Each code has its own message on the install
 * gate; `detail` adds specifics (a file name, the browser's error).
 */
export type GameDataErrorCode =
  /** The folder isn't a Valheim install (or holds no game data folder). */
  | 'notInstall'
  /** The folder is the dedicated server, which has no building pieces. */
  | 'server'
  /** A format or compression this parser doesn't read. */
  | 'unsupported'
  /** Files are missing or shorter than their headers say (a partial download). */
  | 'incomplete'
  /** The bytes don't parse. */
  | 'corrupt'
  /** A file changed while it was being read (Steam updating). */
  | 'busy'
  /** The browser refused access to the folder. */
  | 'permission'
  /** The data parsed but lacks pieces the planner needs (a game update renamed them). */
  | 'missingPieces'
  /** The remembered folder is gone (moved or deleted). */
  | 'moved'
  /** The parser's worker didn't start. */
  | 'workerFailed';

export class GameDataError extends Error {
  readonly code: GameDataErrorCode;
  readonly detail: string;

  constructor(code: GameDataErrorCode, detail = '') {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'GameDataError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Throws a `corrupt` error unless `condition` holds. Pass a function for a message
 * that needs formatting, so hot paths don't build strings that are never shown.
 */
export function check(condition: boolean, detail: string | (() => string)): asserts condition {
  if (!condition)
    throw new GameDataError('corrupt', typeof detail === 'string' ? detail : detail());
}
