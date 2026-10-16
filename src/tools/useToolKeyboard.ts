import { useStore } from 'jotai';
import { useEffect } from 'react';

import { nextSnapStep } from '../model/geometry/snap';
import {
  activeToolIdAtom,
  resetModifiers,
  setModifier,
  snapStepAtom,
  viewportAtom,
  zoomViewportAt,
  type SessionAccess,
} from '../store/session';
import { DEFAULT_VIEWPORT } from '../viewport/viewportMath';

import { getTool, setActiveTool, TOOLS } from './toolbox';

const KEY_ZOOM_FACTOR = 1.25;

interface KeyBinding {
  /** `KeyboardEvent.key` values, lower-case. */
  keys: readonly string[];
  /** Whether Ctrl/Cmd must be held (e.g. Mod+Z later). Alt never matches. */
  mod?: boolean;
  /** Allow Shift (for keys that need it, like `+`); otherwise Shift blocks the binding. */
  shift?: boolean;
  /** Fire on auto-repeat too. */
  repeat?: boolean;
  run(store: SessionAccess): void;
}

const KEYMAP: readonly KeyBinding[] = [
  ...TOOLS.map((tool): KeyBinding => ({
    keys: [tool.shortcut],
    run: (s) => setActiveTool(s, tool.id),
  })),
  {
    keys: ['+', '='],
    shift: true,
    repeat: true,
    run: (s) => zoomViewportAt(s, null, KEY_ZOOM_FACTOR),
  },
  {
    keys: ['-', '_'],
    shift: true,
    repeat: true,
    run: (s) => zoomViewportAt(s, null, 1 / KEY_ZOOM_FACTOR),
  },
  { keys: ['0'], run: (s) => s.set(viewportAtom, DEFAULT_VIEWPORT) },
  { keys: ['g'], run: (s) => s.set(snapStepAtom, nextSnapStep(s.get(snapStepAtom))) },
];

const matches = (binding: KeyBinding, e: KeyboardEvent): boolean =>
  binding.keys.includes(e.key.toLowerCase()) &&
  (e.ctrlKey || e.metaKey) === (binding.mod ?? false) &&
  !e.altKey &&
  (binding.shift || !e.shiftKey) &&
  (binding.repeat || !e.repeat);

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Window-level keyboard handling. Order: modifiers (Space, Alt), then the active
 * tool (every key, modified ones included), then `KEYMAP`.
 */
export const useToolKeyboard = (): void => {
  const store = useStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === ' ' || e.key === 'Alt') {
        // Space would scroll or re-click a focused button; Alt would focus the menu bar.
        e.preventDefault();
        setModifier(store, e.key === 'Alt' ? 'alt' : 'space', true);
        return;
      }
      if (getTool(store.get(activeToolIdAtom)).onKeyDown?.(e, store)) {
        e.preventDefault();
        return;
      }
      const binding = KEYMAP.find((b) => matches(b, e));
      if (binding) {
        e.preventDefault();
        binding.run(store);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setModifier(store, 'space', false);
      if (e.key === 'Alt') setModifier(store, 'alt', false);
    };

    // Keys released while the window is in the background never reach us.
    const onBlur = () => resetModifiers(store);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [store]);
};
