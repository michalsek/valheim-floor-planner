import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { startInstall } from './install/loadInstall';
import { openPlanStorage, startAutosave } from './store/autosave';
import { pruneImages } from './store/imageStore';
import { planStore } from './store/planInstance';
import { startSelectionSync } from './store/selection';
import { startSupportSync } from './store/supportSync';
import { autosaveStatusAtom, sessionStore } from './store/session';
import { startThemeSync } from './store/theme';
import { InstallGate } from './ui/InstallGate/InstallGate';
import { useInstall } from './ui/shared/useInstall';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// The editor needs a catalogue from the user's install; the gate gets one first.
void startInstall();
const Root = () => (useInstall().loaded ? <App /> : <InstallGate />);

/** Loads the autosaved plan (IndexedDB is asynchronous), then starts the app. */
const start = async () => {
  const { plan, saver } = await openPlanStorage();
  planStore.load(plan);
  // After the load, so the loaded plan isn't saved straight back.
  if (saver) {
    startAutosave(planStore, saver, {
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
  // Support is worked out when idle, only while something shows it.
  const stopSupportSync = startSupportSync(planStore, sessionStore);
  import.meta.hot?.dispose(stopSupportSync);
  // Before the first render, so the scene starts with the resolved theme's colours.
  const stopThemeSync = startThemeSync(sessionStore);
  import.meta.hot?.dispose(stopThemeSync);

  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
};
void start();
