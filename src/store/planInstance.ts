import { emptyPlan } from '../model/types';

import { loadSavedPlan } from './autosave';
import { getLocalStorage } from './browserStorage';
import { createPlanStore } from './planStore';

/** Where the plan is autosaved; null when the browser blocks storage. */
export const planStorage = getLocalStorage();

/** The app's one plan store, started from the autosaved plan. */
export const planStore = createPlanStore(planStorage ? loadSavedPlan(planStorage) : emptyPlan());
