/** Maps what the browser throws while reading files to the gate's error codes. */
import { GameDataError } from '../gameData/GameDataError';

export const asGameDataError = (error: unknown): GameDataError => {
  if (error instanceof GameDataError) return error;
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  switch (name) {
    case 'NotReadableError':
      return new GameDataError('busy', message);
    case 'NotAllowedError':
    case 'SecurityError':
      return new GameDataError('permission', message);
    case 'NotFoundError':
      return new GameDataError('moved', message);
    default:
      return new GameDataError('corrupt', message);
  }
};
