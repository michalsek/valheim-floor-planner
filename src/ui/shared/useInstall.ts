import { useSyncExternalStore } from 'react';

import { getInstallState, subscribeInstall, type InstallState } from '../../install/loadInstall';

/** The install gate's state (see `install/loadInstall.ts`). */
export const useInstall = (): InstallState =>
  useSyncExternalStore(subscribeInstall, getInstallState);
