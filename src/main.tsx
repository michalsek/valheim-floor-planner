import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { startAutosave } from './store/autosave';
import { pruneImages } from './store/imageStore';
import { planStorage, planStore } from './store/planInstance';
import { startSelectionSync } from './store/selection';
import { autosaveStatusAtom, sessionStore } from './store/session';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

if (planStorage) {
  startAutosave(planStore, planStorage, {
    onResult: (saved) => sessionStore.set(autosaveStatusAtom, saved ? 'ok' : 'failed'),
  });
} else {
  sessionStore.set(autosaveStatusAtom, 'unavailable');
}

// Safe now only: history is empty, so no undo can bring back another underlay image.
const underlay = planStore.getPlan().underlay;
void pruneImages(new Set(underlay ? [underlay.imageId] : []));

// Before the first render, so the selection is pruned before React reads it.
startSelectionSync(planStore, sessionStore);

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
