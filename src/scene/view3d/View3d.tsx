import { useAtomValue } from 'jotai';
import { useMemo, useRef, useState, useEffect } from 'react';
import type { InstancedMesh } from 'three/webgpu';

import { boxesBounds, pieceBoxes } from '../../model/pieceBoxes';
import { useThemeTokens } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { useDisplayDerived, useDisplayPlan } from '../../store/planHooks';
import { hoverAtom, selectionAtom } from '../../store/selection';

import { Ground } from './Ground';
import { Lights } from './Lights';
import { OrbitRig } from './OrbitRig';
import { materialColorer, withHighlight } from './pieceColors';
import { PieceInstances } from './PieceInstances';
import { createPieceMaterial } from './pieceMaterial';
import { usePicking } from './usePicking';
import { useViewCamera } from './useViewCamera';

/** Door and gate panels are see-through, so the gap they stand in still reads. */
const PANEL_OPACITY = 0.35;

const createMaterials = () => ({
  solid: createPieceMaterial({ opacity: 1 }),
  panel: createPieceMaterial({ opacity: PANEL_OPACITY }),
});

/**
 * The 3D view of the plan (view only): a perspective camera with orbit controls,
 * lights and ground shadows, every piece and prop as a box at its real size, and
 * click / hover picking that shares the selection with 2D. Walls, floors and props are
 * one instanced draw; door and gate panels another.
 */
export const View3d = () => {
  const camera = useViewCamera();
  const plan = useDisplayPlan();
  const derived = useDisplayDerived();
  const tokens = useThemeTokens();
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const [materials] = useState(createMaterials);
  const solidRef = useRef<InstancedMesh>(null);
  const panelRef = useRef<InstancedMesh>(null);
  const [meshes] = useState(() => [solidRef, panelRef]);

  useEffect(
    () => () => {
      materials.solid.dispose();
      materials.panel.dispose();
    },
    [materials]
  );

  const boxes = useMemo(() => pieceBoxes(derived, plan, getLibrary()), [derived, plan]);
  const bounds = useMemo(() => boxesBounds(boxes), [boxes]);
  const solid = useMemo(() => boxes.filter((b) => b.kind !== 'opening'), [boxes]);
  const panels = useMemo(() => boxes.filter((b) => b.kind === 'opening'), [boxes]);
  const colorOf = useMemo(
    () => withHighlight(materialColorer(tokens), selection, hover, tokens),
    [tokens, selection, hover]
  );

  usePicking(meshes);

  return (
    <>
      <OrbitRig camera={camera} bounds={bounds} />
      <Lights bounds={bounds} />
      <Ground />
      <PieceInstances
        ref={solidRef}
        boxes={solid}
        colorOf={colorOf}
        material={materials.solid}
        castShadow
      />
      <PieceInstances
        ref={panelRef}
        boxes={panels}
        colorOf={colorOf}
        material={materials.panel}
        castShadow={false}
      />
    </>
  );
};
