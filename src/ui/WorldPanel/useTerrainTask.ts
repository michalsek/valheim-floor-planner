import { useEffect, useRef, useState } from 'react';

import type { TerrainPhase } from '../../install/terrainJob';
import type { ImportResult, TerrainOptions } from '../../store/worldImport';

/** Before the worker's first phase arrives. */
export type TaskPhase = TerrainPhase | 'starting';

/**
 * One terrain request at a time, with its phase for the progress line: `skip` stops the
 * ground (an import goes on without it), `cancel` stops everything. Leaving the panel
 * (unmounting) cancels.
 */
export const useTerrainTask = () => {
  const [phase, setPhase] = useState<TaskPhase | null>(null);
  const running = useRef<{ cancel: AbortController; skip: AbortController } | null>(null);
  useEffect(() => () => running.current?.cancel.abort(), []);

  const start = async (
    run: (opts: TerrainOptions) => Promise<ImportResult>
  ): Promise<ImportResult> => {
    running.current?.cancel.abort();
    const task = { cancel: new AbortController(), skip: new AbortController() };
    running.current = task;
    setPhase('starting');
    try {
      return await run({ onPhase: setPhase, signal: task.cancel.signal, skip: task.skip.signal });
    } finally {
      if (running.current === task) {
        running.current = null;
        setPhase(null);
      }
    }
  };

  return {
    phase,
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
