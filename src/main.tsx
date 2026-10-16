import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { startInstall } from './install/loadInstall';
import { startAutosave } from './store/autosave';
import { pruneImages } from './store/imageStore';
import { planStorage, planStore } from './store/planInstance';
import { startSelectionSync } from './store/selection';
import { autosaveStatusAtom, sessionStore } from './store/session';
import { startThemeSync } from './store/theme';
import { InstallGate } from './ui/InstallGate/InstallGate';
import { useInstall } from './ui/shared/useInstall';

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
// Before the first render, so the scene starts with the resolved theme's colours.
const stopThemeSync = startThemeSync(sessionStore);
import.meta.hot?.dispose(stopThemeSync);

// The editor needs a catalogue from the user's install; the gate gets one first.
void startInstall();
const Root = () => (useInstall().loaded ? <App /> : <InstallGate />);

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
