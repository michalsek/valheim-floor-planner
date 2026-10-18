import { useEffect, useMemo, useState } from 'react';
import { MeshBasicNodeMaterial } from 'three/webgpu';

import type { PieceBox } from '../../model/pieceBoxes';

import { useModels } from './assets/useModels';
import { ModelInstances } from './ModelInstances';
import type { PieceColorer, PieceTinter } from './pieceColors';
import { PieceInstances } from './PieceInstances';
import { createPieceMaterial } from './pieceMaterial';

/** Door and gate boxes are see-through, so the gap they stand in still reads. */
const PANEL_OPACITY = 0.35;

/** Dev only: `?modelBoxes` draws every box's wireframe over the models. */
const SHOW_MODEL_BOXES =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('modelBoxes');

const createMaterials = () => ({
  solid: createPieceMaterial({ opacity: 1 }),
  shaped: createPieceMaterial({ opacity: 1, edges: false }),
  panel: createPieceMaterial({ opacity: PANEL_OPACITY }),
});

interface BoxPiecesProps {
  /** The boxes drawn. */
  boxes: readonly PieceBox[];
  /**
   * Every box that may be drawn, a superset of `boxes` (default `boxes`): what the
   * instanced meshes (and models) are kept for, so the level view mode and level
   * changes remount and relink nothing.
   */
  retainBoxes?: readonly PieceBox[];
  colorOf: PieceColorer;
}

const isPanel = (b: PieceBox) => b.kind === 'opening';
const isSolid = (b: PieceBox) => b.kind !== 'opening';

/**
 * Boxes in plan colours: one instanced draw for walls, floors, props and roof slabs, one
 * per roof shape, one for panels.
 */
export const BoxPieces = ({ boxes, retainBoxes = boxes, colorOf }: BoxPiecesProps) => {
  const [materials] = useState(createMaterials);
  useEffect(
    () => () => {
      materials.solid.dispose();
      materials.shaped.dispose();
      materials.panel.dispose();
    },
    [materials]
  );
  const solid = useMemo(() => boxes.filter(isSolid), [boxes]);
  const panels = useMemo(() => boxes.filter(isPanel), [boxes]);
  const retainSolid = useMemo(() => retainBoxes.filter(isSolid), [retainBoxes]);
  const retainPanels = useMemo(() => retainBoxes.filter(isPanel), [retainBoxes]);
  return (
    <>
      <PieceInstances
        boxes={solid}
        retain={retainSolid}
        colorOf={colorOf}
        material={materials.solid}
        shapeMaterial={materials.shaped}
        castShadow
      />
      <PieceInstances
        boxes={panels}
        retain={retainPanels}
        colorOf={colorOf}
        material={materials.panel}
        castShadow={false}
      />
    </>
  );
};

/** Every box's edges, for checking that models line up with them. */
const BoxWireframes = ({ boxes, colorOf }: BoxPiecesProps) => {
  const [material] = useState(() => new MeshBasicNodeMaterial({ wireframe: true }));
  useEffect(() => () => material.dispose(), [material]);
  return <PieceInstances boxes={boxes} colorOf={colorOf} material={material} castShadow={false} />;
};

interface ModelPiecesProps extends BoxPiecesProps {
  /**
   * Every box whose model stays loaded: a prefab only on a level the view mode hides
   * keeps its resources, so stepping levels relinks nothing.
   */
  retainBoxes: readonly PieceBox[];
  tintOf: PieceTinter;
}

/**
 * The real game models, tinted like the boxes are coloured; pieces whose model isn't
 * loaded (or that draw nothing) stay boxes. Door and gate models are drawn solid: at
 * the boxes' panel opacity they looked like ghosts.
 */
export const ModelPieces = ({ boxes, retainBoxes, colorOf, tintOf }: ModelPiecesProps) => {
  const prefabs = useMemo(
    () => [...new Set(retainBoxes.flatMap((b) => (b.prefab === null ? [] : [b.prefab])))].sort(),
    [retainBoxes]
  );
  const { resources, ready } = useModels(prefabs);
  const split = useMemo(() => {
    const has = (b: PieceBox) => b.prefab !== null && ready.has(b.prefab);
    const [modelled, rest] = [boxes.filter(has), boxes.filter((b) => !has(b))];
    return {
      modelled,
      rest,
      retainModelled: retainBoxes.filter(has),
      retainRest: retainBoxes.filter((b) => !has(b)),
    };
  }, [boxes, retainBoxes, ready]);
  return (
    <>
      <ModelInstances
        boxes={split.modelled}
        retainBoxes={split.retainModelled}
        models={ready}
        resources={resources}
        tintOf={tintOf}
      />
      <BoxPieces boxes={split.rest} retainBoxes={split.retainRest} colorOf={colorOf} />
      {SHOW_MODEL_BOXES && <BoxWireframes boxes={boxes} colorOf={colorOf} />}
    </>
  );
};
