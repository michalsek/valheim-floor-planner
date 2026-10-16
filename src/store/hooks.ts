import { useAtomValue } from 'jotai';

import {
  activeToolIdAtom,
  autosaveStatusAtom,
  cursorAtom,
  modifiersAtom,
  rendererBackendAtom,
  snapStepAtom,
  viewportAtom,
  viewportSizeAtom,
} from './session';
import { themeTokensAtom } from './theme';

export const useViewport = () => useAtomValue(viewportAtom);
export const useViewportSize = () => useAtomValue(viewportSizeAtom);
export const useSnapStep = () => useAtomValue(snapStepAtom);
export const useModifiers = () => useAtomValue(modifiersAtom);
export const useCursor = () => useAtomValue(cursorAtom);
export const useActiveToolId = () => useAtomValue(activeToolIdAtom);
export const useRendererBackend = () => useAtomValue(rendererBackendAtom);
export const useAutosaveStatus = () => useAtomValue(autosaveStatusAtom);
export const useThemeTokens = () => useAtomValue(themeTokensAtom);
