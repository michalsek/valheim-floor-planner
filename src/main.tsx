import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { startAutosave } from './store/autosave';
import { planStorage, planStore } from './store/planInstance';
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

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
