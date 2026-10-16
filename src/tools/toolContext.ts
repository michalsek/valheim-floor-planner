import { useStore } from 'jotai';
import { useMemo } from 'react';

import { planStore } from '../store/planInstance';

import type { ToolContext } from './types';

/** The context tools receive: the session store's `get`/`set` and the plan store. */
export const useToolContext = (): ToolContext => {
  const store = useStore();
  return useMemo(() => ({ get: store.get, set: store.set, plan: planStore }), [store]);
};
