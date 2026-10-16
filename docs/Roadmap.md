# Valheim Floor Planner: v1 roadmap

Game knowledge lives in [`research/README.md`](../research/README.md) and
[`research/valheim-pieces.json`](../research/valheim-pieces.json).

## Stack and principles

- **App:** Vite + React 19 + TypeScript (strict), pnpm, one app (no monorepo).
- **Rendering:** @react-three/fiber 9 on three.js `WebGPURenderer` (`three/webgpu`, with
  automatic WebGL2 fallback), using an orthographic top-down camera. The world plane is
  x/z, in metres.
  - TypeGPU (`typegpu` + `@typegpu/three` + `unplugin-typegpu`) is **optional**: use
    it where it fits naturally (the grid shader).
  - Avoid drei helpers that rely on WebGL shaders (`Grid`, `Line`). Use node
    materials instead.
- **Overlay:** an SVG/HTML layer handles labels, dimension lines and UI chrome. One
  viewport state `{center, zoom}` drives both the camera and the overlay; top-down
  ortho means world→screen is just scale + translate.
- **Pointer input:** pointer events go to the container div. Hit-testing is pure TS
  geometry, not r3f raycasting.
- **Layering:** `model/` and `catalog/` import neither React nor three. Pieces are
  **derived** (`derivePlan(plan, catalog)`), never stored.
- **State:** a document store with Immer patches, `transact` (one gesture = one undo
  entry) and labelled history. Patterned on yummies
  `packages/core/src/store/documentStore.ts`. Session state (tool, selection,
  viewport, previews) stays out of history.
- **Conventions (from yummies):**
  - No kebab-case file or dir names. PascalCase for components and large modules,
    camelCase otherwise.
  - Tests co-located as `<name>.test.ts`.
  - Split files over ~400 lines.
- **Home project:** clean, composable code; no perf micro-optimisation; only a few
  unit tests on pure model logic.
- **v1 limits:** walls are orthogonal only. Out of scope: 3D view, stability
  simulation, multiple storeys, PlanBuild export.

## Layout

```
src/
  catalog/   imports research/valheim-pieces.json, pieceDefs.ts, wallFamilies.ts, floorFamilies.ts, stations.ts
  model/     pure TS: types.ts, geometry/, splitWall.ts, splitFloor.ts, wallGraph.ts, rooms.ts,
             bom.ts, derivePlan.ts, serialize.ts (+ *.test.ts)
  store/     planStore.ts, commands.ts, hooks.ts, session.ts, autosave.ts
  viewport/  viewportMath.ts, useViewportControls.ts
  scene/     PlanCanvas.tsx, GridPlane.tsx, WallMeshes.tsx, FloorMeshes.tsx, PropMeshes.tsx, Underlay.tsx
  overlay/   Overlay.tsx, DimensionLine.tsx, RoomLabels.tsx, RadiusRings.tsx, SnapCursor.tsx
  tools/     types.ts, toolbox.ts, ToolHost.tsx, Select/, Wall/, Floor/, Opening/, Ruler/, Prop/
  ui/        ToolRail/, Inspector/, BomPanel/, CatalogBrowser/, StatusStrip/
```

## Core domain types (sketch)

```ts
type Vec2 = { x: number; z: number }
interface Plan { version: 1; walls; floors; openings; props; dimensions; underlay? }  // Record<Id, T>
interface WallRun { id; familyId; points: Vec2[]; closed: boolean; side: 'left' | 'right'; height: number }
interface Opening { id; wallId; segment: number; offset: number; prefab: string }
interface Floor { id; familyId; min: Vec2; max: Vec2 }
interface Prop { id; prefab: string; position: Vec2; rotation: number; upgrades?: number }
interface Dimension { id; a: Vec2; b: Vec2; offset: number }
interface WallFamily { id; label; snapKind: 'centerline' | 'face'; thickness; material; pieces; openings }
interface Derived { pieces: PlacedPiece[]; rooms: Room[]; bom; warnings }
```

Wall families are a short hand-written list (family → prefabs). Everything else comes
from the JSON:
- thickness: `colliderSize.z`;
- snap kind: snap-point z (0 = centre-line, ±0.5 = face);
- piece lengths and heights: collider sizes.

The wall splitter fills the face rectangle (length × height) in courses,
largest-first, around openings.

## Milestones

1. **M1: Canvas foundation and ruler.**
   - Scaffold; r3f with WebGPU; ortho camera; pan and zoom-to-cursor.
   - Multi-level grid (0.5 / 1 / 2 / 10 m) that fades with zoom.
   - SVG overlay, snap cursor, status strip, ruler tool.
   - Catalogue loader with wall families.
2. **M2: Walls, pieces, cost, undo.**
   - Plan store with undo/redo.
   - Wall polyline tool with a family picker and block-wall side flip (F).
   - `splitWall` → piece meshes with seams; bill of materials panel.
   - Autosave to localStorage.
3. **M3: Measurement.**
   - Wall graph and room detection.
   - Inner/outer polygons; room labels showing grid, outer and clear dimensions plus
     area.
   - Pinned dimension annotations.
   - Roof-span badge (4 / 8 / 12 / 16 m spans are clean).
4. **M4: Selection, editing, files.**
   - Select, move and delete, with box select and vertex drag.
   - Inspector panel.
   - Save/load `.valheimplan.json`; undo labels.
5. **M5: Floors and openings.**
   - Floor rectangle tool with tile split.
   - Doors and gates placed along walls at 1 m steps; gaps and costs.
6. **M6: Catalogue, footprints, radii, underlay.**
   - Catalogue browser (EN/PL search) and prop placement with rotation.
   - Station build-radius rings and the ward ring.
   - Optional: reference image underlay with two-point scale; stair helper.

## Reuse map

- **yummies:**
  - `packages/core/src/store/documentStore.ts` (history store)
  - `packages/core/src/commands/{commands,apply}.ts`
  - `packages/stateReact/src/store/hooks.ts` (`useDocumentSelector`)
  - `packages/stateReact/src/session/{tool,viewport}.ts`
  - `packages/stateReact/src/interaction/{reducer,applyEffects}.ts` (principle only)
  - `packages/stateReact/src/selection/selectionModel.ts`
  - `packages/canvas/src/overlay/Overlay.tsx`
  - `packages/canvas/src/viewport/transforms.ts`
  - `packages/math/src/workspaceGridMath.ts`
  - `apps/studio/.../ToolRail/toolbox.ts`
  - `packages/ui` (Radix + Tailwind)
- **anatomy v4:**
  - `packages/engine/src/shading/lines.ts` (TypeGPU `'use gpu'` line coverage with
    `fwidth`)
  - `packages/engine/tests/shaders.test.ts`
  - version pins in `packages/engine/package.json`
  - the "engine has no DOM/React" layering rule
