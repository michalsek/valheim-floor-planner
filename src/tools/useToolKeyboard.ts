import { useEffect } from 'react';

import { nextSnapStep } from '../model/geometry/snap';
import { planBounds } from '../model/planBounds';
import { openPlanFile, saveCurrentPlan } from '../store/fileActions';
import { getLibrary } from '../store/libraryInstance';
import {
  activeToolIdAtom,
  fitViewTo,
  resetModifiers,
  setModifier,
  snapStepAtom,
  viewportAtom,
  zoomViewportAt,
} from '../store/session';
import { requestOrbit, toggleViewMode, viewModeAtom } from '../store/view3d';
import { DEFAULT_VIEWPORT } from '../viewport/viewportMath';

import { isMod, isRedoKey, isUndoKey } from './keys';
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

const in3d = (ctx: ToolContext): boolean => ctx.get(viewModeAtom) === '3d';

/** Zooms the 2D view; the 3D view zooms with the wheel only. */
const zoomKey = (ctx: ToolContext, factor: number): void => {
  if (!in3d(ctx)) zoomViewportAt(ctx, null, factor);
};

const isPlainDigit = (e: KeyboardEvent, code: string): boolean =>
  e.code === code && !isMod(e) && !e.altKey && !e.shiftKey;

const KEYMAP: readonly KeyBinding[] = [
  ...TOOLS.map((tool): KeyBinding => ({
    keys: [tool.shortcut],
    run: (s) => setActiveTool(s, tool.id),
  })),
  {
    keys: ['+', '='],
    shift: true,
    repeat: true,
    run: (s) => zoomKey(s, KEY_ZOOM_FACTOR),
  },
  {
    keys: ['-', '_'],
    shift: true,
    repeat: true,
    run: (s) => zoomKey(s, 1 / KEY_ZOOM_FACTOR),
  },
  // 0 resets the 2D view, or the 3D camera's direction.
  {
    keys: ['0'],
    run: (s) => (in3d(s) ? requestOrbit(s, 'reset') : s.set(viewportAtom, DEFAULT_VIEWPORT)),
  },
  // Home or Shift+1 frames the whole plan (F is the wall tool's flip).
  {
    test: (e) =>
      !isMod(e) && !e.altKey && (e.key === 'Home' || (e.shiftKey && e.code === 'Digit1')),
    run: (s) =>
      in3d(s) ? requestOrbit(s, 'fit') : fitViewTo(s, planBounds(s.plan.getPlan(), getLibrary())),
  },
  // 3 toggles 2D/3D. By key position, so it also works where that key types another
  // character unshifted (AZERTY).
  { test: (e) => isPlainDigit(e, 'Digit3'), run: toggleViewMode },
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
