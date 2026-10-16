import { useEffect } from 'react';

import { nextSnapStep } from '../model/geometry/snap';
import { openPlanFile, saveCurrentPlan } from '../store/fileActions';
import {
  activeToolIdAtom,
  resetModifiers,
  setModifier,
  snapStepAtom,
  viewportAtom,
  zoomViewportAt,
} from '../store/session';
import { DEFAULT_VIEWPORT } from '../viewport/viewportMath';

import { isRedoKey, isUndoKey } from './keys';
import { useToolContext } from './toolContext';
import { getTool, setActiveTool, TOOLS } from './toolbox';
import type { ToolContext } from './types';

const KEY_ZOOM_FACTOR = 1.25;

interface KeyBinding {
  /** `KeyboardEvent.key` values, lower-case. */
  keys?: readonly string[];
  /** A custom test for chords; replaces `keys`, `mod` and `shift`. */
  test?: (e: KeyboardEvent) => boolean;
  /** Whether Ctrl/Cmd must be held. Alt never matches. */
  mod?: boolean;
  /** Allow Shift (for keys that need it, like `+`); otherwise Shift blocks the binding. */
  shift?: boolean;
  /** Fire on auto-repeat too. */
  repeat?: boolean;
  run(ctx: ToolContext): void;
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
  { test: isUndoKey, repeat: true, run: (s) => s.plan.undo() },
  { test: isRedoKey, repeat: true, run: (s) => s.plan.redo() },
];

/** Checked before anything else, even in text fields, so the browser's own never open. */
const FILE_KEYMAP: readonly KeyBinding[] = [
  { keys: ['s'], mod: true, run: (s) => void saveCurrentPlan(s) },
  { keys: ['o'], mod: true, run: (s) => void openPlanFile(s) },
];

const matchesKeys = (binding: KeyBinding, e: KeyboardEvent): boolean =>
  (binding.keys ?? []).includes(e.key.toLowerCase()) &&
  (e.ctrlKey || e.metaKey) === (binding.mod ?? false) &&
  !e.altKey &&
  (binding.shift || !e.shiftKey);

const matches = (binding: KeyBinding, e: KeyboardEvent): boolean =>
  (binding.test ? binding.test(e) : matchesKeys(binding, e)) && (binding.repeat || !e.repeat);

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Window-level keyboard handling. Order: file keys (Mod+S, Mod+O), then, outside
 * text fields, modifiers (Space, Alt), the active tool (every key, modified ones
 * included) and `KEYMAP`.
 */
export const useToolKeyboard = (): void => {
  const ctx = useToolContext();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const fileBinding = FILE_KEYMAP.find((b) => matchesKeys(b, e));
      if (fileBinding) {
        // Repeats are swallowed too, or a held Mod+S would open the browser's dialog.
        e.preventDefault();
        if (!e.repeat) fileBinding.run(ctx);
        return;
      }
      if (isEditableTarget(e.target)) return;
      if (e.key === ' ' || e.key === 'Alt') {
        // Space would scroll or re-click a focused button; Alt would focus the menu bar.
        e.preventDefault();
        setModifier(ctx, e.key === 'Alt' ? 'alt' : 'space', true);
        return;
      }
      if (getTool(ctx.get(activeToolIdAtom)).onKeyDown?.(e, ctx)) {
        e.preventDefault();
        return;
      }
      const binding = KEYMAP.find((b) => matches(b, e));
      if (binding) {
        e.preventDefault();
        binding.run(ctx);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setModifier(ctx, 'space', false);
      if (e.key === 'Alt') setModifier(ctx, 'alt', false);
    };

    // Keys released while the window is in the background never reach us.
    const onBlur = () => resetModifiers(ctx);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [ctx]);
};
