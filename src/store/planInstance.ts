import { emptyPlan } from '../model/types';

import { createPlanStore } from './planStore';

/** The app's one plan store; start-up loads the autosaved plan into it (`main.tsx`). */
export const planStore = createPlanStore(emptyPlan());
