import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useLayoutEffect, useMemo, useState } from 'react';
import { DynamicDrawUsage, Float32BufferAttribute, type BufferAttribute } from 'three/webgpu';

import { fromLocal } from '../../model/geometry/orient';
import type { PieceBox } from '../../model/pieceBoxes';
import { GhostBoxes } from '../../scene/view3d/GhostBoxes';
import { GhostModel } from '../../scene/view3d/GhostModel';
import {
  createLines,
  disposeLines,
  HIDDEN_RENDER_ORDER,
  setStyle,
  VISIBLE_RENDER_ORDER,
  type Lines,
} from '../../scene/view3d/lineObjects';
import { useRelease } from '../../scene/useRelease';
import { realLookAtom } from '../../store/modelView';
import { workDatumAtom } from '../../store/session';

import { useGhostShades, useRemovalShades, type GhostShades } from './buildColors';
import { buildGhostAtom, buildRemovalAtom } from './buildGhost';
import { armedSetAtom, keptPrefabsAtom } from './buildState';

const UNIT_EDGES: readonly (readonly [number, number, number, number, number, number])[] = [
  ...[-0.5, 0.5].flatMap((a) =>
    [-0.5, 0.5].flatMap((b) => [
      [-0.5, a, b, 0.5, a, b] as const,
      [a, -0.5, b, a, 0.5, b] as const,
      [a, b, -0.5, a, b, 0.5] as const,
    ])
  ),
];

/** Floats per box: 12 edges of two end points. */
const BOX_FLOATS = 12 * 2 * 3;

/** Writes the 12 edges of each box (its whole box, whatever shape it holds) as segment ends. */
const writeEdges = (attribute: BufferAttribute, boxes: readonly PieceBox[]): void => {
  const array = attribute.array as Float32Array;
  let k = 0;
  for (const box of boxes) {
    const solid = { ...box, shape: 'box' as const };
    for (const edge of UNIT_EDGES) {
      for (const end of [0, 3]) {
        const local = {
          x: edge[end]! * box.size.x,
          y: edge[end + 1]! * box.size.y,
          z: edge[end + 2]! * box.size.z,
        };
        const p = fromLocal(local, solid);
        array[k++] = p.x;
        array[k++] = p.y;
        array[k++] = p.z;
      }
    }
  }
  attribute.needsUpdate = true;
};

/** Puts the boxes' edges in the lines' (grown) buffer and draws that many. */
const showEdges = (pair: Lines, attribute: BufferAttribute, boxes: readonly PieceBox[]) => {
  if (pair.geometry.getAttribute('position') !== attribute) {
    pair.geometry.setAttribute('position', attribute);
  }
  writeEdges(attribute, boxes);
  pair.geometry.setDrawRange(0, boxes.length * 24);
};

/**
 * Box edges, at full strength where seen and faintly through the pieces in front (the
 * `PlaneLines` passes), so a ghost model reads as a ghost. A move rewrites the points in
 * place; the buffer only grows.
 */
const BoxEdges = ({ boxes, color }: { boxes: readonly PieceBox[]; color: string }) => {
  const invalidate = useThree((s) => s.invalidate);
  const [pair] = useState(() => createLines(false));
  const [capacity, setCapacity] = useState(4);
  if (boxes.length > capacity) setCapacity(boxes.length * 2);
  const attribute = useMemo(() => {
    const created = new Float32BufferAttribute(new Float32Array(capacity * BOX_FLOATS), 3);
    created.setUsage(DynamicDrawUsage);
    return created;
  }, [capacity]);
  useLayoutEffect(() => {
    showEdges(pair, attribute, boxes);
    invalidate();
  }, [pair, attribute, boxes, invalidate]);
  useLayoutEffect(() => {
    setStyle(pair, color, undefined);
    invalidate();
  }, [pair, color, invalidate]);
  useRelease(pair, disposeLines);
  return (
    <>
      <primitive object={pair.hidden} renderOrder={HIDDEN_RENDER_ORDER} frustumCulled={false} />
      <primitive object={pair.visible} renderOrder={VISIBLE_RENDER_ORDER} frustumCulled={false} />
    </>
  );
};

const NONE: readonly PieceBox[] = [];

const NO_COLOR = () => '#000000';
const NO_TINT = () => ({ color: '#000000', amount: 0 });

/** The ghost as models (boxes until loaded) or boxes, with its edges (none: all hidden). */
const Ghost = ({ boxes, shades }: { boxes: readonly PieceBox[]; shades: GhostShades | null }) => {
  const realLook = useAtomValue(realLookAtom);
  const kept = useAtomValue(keptPrefabsAtom);
  const colorOf = shades?.colorOf ?? NO_COLOR;
  return (
    <>
      {realLook ? (
        <GhostModel
          boxes={boxes}
          kept={kept}
          tintOf={shades?.tintOf ?? NO_TINT}
          colorOf={colorOf}
        />
      ) : (
        <GhostBoxes boxes={boxes} colorOf={colorOf} />
      )}
      <BoxEdges boxes={boxes} color={shades?.edge ?? NO_COLOR()} />
    </>
  );
};

/**
 * The Build ghost where a click would place it (M17 §2.5), or the piece Ctrl/⌘ + click
 * would remove. Mounted while the tool is armed, so its meshes outlive pointer leaves.
 * The ghost has absolute heights: it is drawn under the view's lift by the datum.
 */
export const BuildPreview3d = () => {
  const armed = useAtomValue(armedSetAtom);
  const ghost = useAtomValue(buildGhostAtom);
  const removal = useAtomValue(buildRemovalAtom);
  const datum = useAtomValue(workDatumAtom);
  const shades = useGhostShades(ghost);
  const removalShades = useRemovalShades(removal);
  const removed = useMemo(() => (removal ? [removal.box] : NONE), [removal]);
  return (
    <group position-y={-datum}>
      {armed && <Ghost boxes={ghost?.boxes ?? NONE} shades={shades} />}
      {removalShades && (
        <>
          <GhostBoxes boxes={removed} colorOf={removalShades.colorOf} />
          <BoxEdges boxes={removed} color={removalShades.edge} />
        </>
      )}
    </group>
  );
};
