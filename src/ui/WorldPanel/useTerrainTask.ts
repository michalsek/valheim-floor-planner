import { useEffect, useRef, useState } from 'react';

import type { TerrainPhase } from '../../install/terrainJob';
import type { ImportResult, TerrainOptions } from '../../store/worldImport';

/** Before the worker's first phase arrives. */
export type TaskPhase = TerrainPhase | 'starting';

/** What the request is for: importing a build, or adding ground to the current plan. */
export type TaskKind = 'import' | 'add';

/**
 * The World panel's terrain request, one at a time (an import and an Add terrain share
 * it, so each is disabled while the other runs), with its phase for the progress line:
 * `skip` stops the ground (an import goes on without it), `cancel` stops everything.
 * Leaving the panel (unmounting) cancels.
 */
export const useTerrainTask = () => {
  const [state, setState] = useState<{ kind: TaskKind; phase: TaskPhase } | null>(null);
  const running = useRef<{ cancel: AbortController; skip: AbortController } | null>(null);
  useEffect(() => () => running.current?.cancel.abort(), []);

  const start = async (
    kind: TaskKind,
    run: (opts: TerrainOptions) => Promise<ImportResult>
  ): Promise<ImportResult | null> => {
    if (running.current) return null;
    const task = { cancel: new AbortController(), skip: new AbortController() };
    running.current = task;
    setState({ kind, phase: 'starting' });
    const onPhase = (phase: TaskPhase) => setState({ kind, phase });
    try {
      return await run({ onPhase, signal: task.cancel.signal, skip: task.skip.signal });
    } finally {
      running.current = null;
      setState(null);
    }
  };

  return {
    /** The running request's kind, or null. */
    running: state?.kind ?? null,
    /** Its phase, for the progress line of `kind`. */
    phaseOf: (kind: TaskKind): TaskPhase | null => (state?.kind === kind ? state.phase : null),
    start,
    skip: () => running.current?.skip.abort(),
    cancel: () => running.current?.cancel.abort(),
  };
};

const PHASES: Record<TaskPhase, string> = {
  starting: 'Generating terrain…',
  rivers: 'Generating terrain… rivers (first time for this world)',
  deepNorth: 'Generating terrain… Deep North streams (first time near it)',
  ground: 'Generating terrain… ground',
  edits: 'Generating terrain… your terrain edits',
  check: 'Generating terrain… checking',
};

export const phaseText = (phase: TaskPhase): string => PHASES[phase];

export type TerrainTask = ReturnType<typeof useTerrainTask>;
