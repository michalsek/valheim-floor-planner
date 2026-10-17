import { useEffect, useMemo, useState } from 'react';
import { MeshBasicNodeMaterial } from 'three/webgpu';

import type { PieceBox } from '../../model/pieceBoxes';

import { useModels } from './assets/useModels';
import { ModelInstances } from './ModelInstances';
import type { PieceColorer, PieceTinter } from './pieceColors';
import { PieceInstances } from './PieceInstances';
import { createPieceMaterial } from './pieceMaterial';

/** Door and gate panels are see-through, so the gap they stand in still reads. */
const PANEL_OPACITY = 0.35;

/** Dev only: `?modelBoxes` draws every box's wireframe over the models. */
const SHOW_MODEL_BOXES =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('modelBoxes');

const createMaterials = () => ({
  solid: createPieceMaterial({ opacity: 1 }),
  panel: createPieceMaterial({ opacity: PANEL_OPACITY }),
});

interface BoxPiecesProps {
  boxes: readonly PieceBox[];
  colorOf: PieceColorer;
}

/** Boxes in plan colours: one instanced draw for walls, floors and props, one for panels. */
export const BoxPieces = ({ boxes, colorOf }: BoxPiecesProps) => {
  const [materials] = useState(createMaterials);
  useEffect(
    () => () => {
      materials.solid.dispose();
      materials.panel.dispose();
    },
    [materials]
  );
  const solid = useMemo(() => boxes.filter((b) => b.kind !== 'opening'), [boxes]);
  const panels = useMemo(() => boxes.filter((b) => b.kind === 'opening'), [boxes]);
  return (
    <>
      <PieceInstances boxes={solid} colorOf={colorOf} material={materials.solid} castShadow />
      <PieceInstances
        boxes={panels}
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

/**
 * The real game models, tinted like the boxes are coloured; pieces whose model isn't
 * loaded (or that draw nothing) stay boxes.
 */
export const ModelPieces = ({
  boxes,
  colorOf,
  tintOf,
}: BoxPiecesProps & { tintOf: PieceTinter }) => {
  const prefabs = useMemo(
    () => [...new Set(boxes.flatMap((b) => (b.prefab === null ? [] : [b.prefab])))].sort(),
    [boxes]
  );
  const models = useModels(prefabs, PANEL_OPACITY);
  const [modelled, rest] = useMemo(() => {
    const has = (b: PieceBox) => b.prefab !== null && models.has(b.prefab);
    return [boxes.filter(has), boxes.filter((b) => !has(b))];
  }, [boxes, models]);
  return (
    <>
      <ModelInstances boxes={modelled} models={models} tintOf={tintOf} />
      <BoxPieces boxes={rest} colorOf={colorOf} />
      {SHOW_MODEL_BOXES && <BoxWireframes boxes={boxes} colorOf={colorOf} />}
    </>
  );
};
