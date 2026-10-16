# Findings log

Out-of-scope issues and improvement ideas noted by agents during the v1 build.
(This repo has no issue tracker, so they're kept here.)

## From M1 planning

1. **`valheim-pieces.json` has some odd entries.**
   - `piece_repair` has a numeric `category: 100` (an unmapped enum in `extract_pieces.py`).
   - 8 pieces have a null `colliderSize`, including `piece_cauldron`, which is a station with a build radius. M6 footprints need a fallback for these.
   - `piece_hexagonal_door` has a snap-x extent of 0, and the cloth doors have no snap points at all.
2. **`blackmarble_2x2x2` is 2 m thick** (snap z ±1). A future marble block-wall family must not mix it with the 1 m blocks.
3. **Thickness varies within a family.** Ashwood is 0.25 / 0.28 / 0.30 and scalewood 0.21–0.28. We use the maximum per family for drawing and keep per-piece values.
4. **Collider lengths drift off grid** (e.g. `scale_wall_2x2` is 2.016 and `stave_wall_2x2` is 2.015). Use snap-point extents for lengths and heights instead.
5. **The snap-kind detection rule must only look at wall pieces.** `wood_door` has extra snap points at z ±0.264, which would misclassify the family.

## From M1 implementation

1. **TypeGPU grid works; TSL kept as an unused fallback.** `unplugin-typegpu` 0.12.5
   transforms `'use gpu'` functions under Vite 8 (rolldown), `toTSL` compiles on both
   WebGPU and the WebGL2 fallback (`@typegpu/gl`), and typecheck passes. The TSL variant
   was smoke-tested on WebGL2 too, so the swap in `gridMaterial.ts` is a one-line change.
2. **`darkwood_beam_67` has `namePl: null`.** `parseCatalog` falls back to the English
   name; the extractor could fill the gap instead.
3. **Timber's opening is a different material.** `stave_wall_2x2` is `timberwood`, but
   `stave_gate` is `hardwood`. The "no mixed materials" rule therefore checks wall pieces
   only. M5 cost/stability code must read the opening's own material.
4. **The Roadmap contradicts Findings #4.** `docs/Roadmap.md` ("Wall families…") still
   says lengths and heights come from collider sizes; the implementation (and the M1 plan)
   uses snap-point extents.
5. **Wheel heuristic is ambiguous in the plan.** "small or fractional |deltaY|<50" was
   implemented as `deltaX ≠ 0 || |deltaY| < 50` → pan. Large fractional deltas (e.g. a
   mouse wheel under Windows display scaling, 133.33 px) stay zoom.
6. **Ctrl + physical mouse wheel zooms hard.** Any ctrl+wheel is treated as a pinch
   (sensitivity 0.01), so one 100 px notch zooms by e^±1 (≈ 2.7×). Consider using pinch
   sensitivity only for small pixel deltas. *(Fixed in the M1 fix round: `isPinch`.)*
7. **Upstream console noise.** r3f 9.8.2 logs `THREE.Clock: This module has been
   deprecated` on start-up; nothing to do on our side. (r3f's default `PCFSoftShadowMap`
   warning is avoided with `shadows={{ enabled: false }}` in `PlanCanvas`.)
8. **The overlay's world layer is empty in M1.** All M1 overlay content (cursor, ruler)
   is screen-space; the world layer is there for M2 wall previews (`Tool.WorldPreview`).
9. **Bundle size.** three (WebGPU + TSL) + TypeGPU is a single ~2.2 MB chunk (600 kB
   gzip); the Vite warning limit was raised. Code-splitting is possible later if needed.
10. **Dependency notes.** TypeScript is pinned to 6.0.3 because typescript-eslint 8.71
    supports `<6.1`; jotai stays on 2.x per the plan although 3.0 is out;
    eslint-plugin-react 7.37.5 declares an ESLint `^9.7` peer but works with ESLint 10
    (as in yummies).
11. **Hidden Claude browser pane delays the first frame.** While the pane is hidden, r3f's
    size measurement (and so renderer creation) can wait until the page next renders,
    so the backend badge shows `…` for a while. Expected to be a pane artefact; QA in a
    visible tab should confirm.
12. **Crisp grid only at whole-number pans and zooms.** The viewport centre is drawn
    at a whole CSS px (`screenCentre`) and odd-width lines shift half a device pixel
    (`crispLineOffset`, mirrored in the shader). After a zoom-at-cursor, line spacing is
    fractional and lines are box-filtered (soft but the right ink), which is expected.
13. **No 50/100 m grid level.** At the minimum zoom (2 px/m) the 10 m lines are still
    20 px apart, which reads fine, and a fifth level would need a second uniform. Revisit
    if `MIN_ZOOM` drops.

## From M2 implementation

1. **Tools still see every key first, Cmd/Ctrl included.** The wall tool filters
   modified keys itself (only Mod+Z gets through, while drawing). A per-binding
   "tool may claim this" rule in `useToolKeyboard` would save each tool the check.
2. **Item labels are a hand-kept map** (`catalog/items.ts`). The extract has no item
   display names. `Blackwood` is shown as "Ashwood" (its in-game name, worth checking),
   and `Frostwood` (timber and scalewood) is shown as its raw id. The extractor could
   export item names.
3. **Alt gives off-grid wall points.** That's consistent with the rest of the app, and
   the leftover shows up as an unfilled-area warning. Decide whether walls should ignore
   Alt.
4. **Crossing walls and T-junctions are double-counted.** Each run is split on its own;
   that's the wall graph's job in M3. The L-house is drawn as one closed outline for now.
5. **Warnings say "Segment N" but not which wall.** There is no way to find the wall
   until selection exists (M4); the warning could then select or highlight it.
6. **Corrupt storage is re-reported on every reload until the next edit.** The bad value
   stays under the main key, and each start-up overwrites `KEY.corrupt` with it (same
   content, so nothing is lost). Could clear the main key after the backup.
7. **One mesh per ground-course piece.** Fine for house-sized plans (a 500 m wall is
   ~250 meshes). Switch `WallMeshes` to an `InstancedMesh` per material if big plans get
   slow.
8. **Seams are hard to see when zoomed out.** `SEAM = 0.06` m is 1.5 px at 26 px/m.
   *(Fix round: at ≤ 12 px/m `WallLines` now draws solid footprints with a 2 px stroke;
   seams disappear there by design. Between 12 and ~30 px/m they're still faint.)*
9. **QA tooling note:** the browser pane's `key "minus"` / `type "-"` did not reach the
   app's `+`/`-` zoom bindings (the app zooms fine on a real `-` keydown). Likely a tool
   artefact; worth a quick check with a real keyboard.
10. **Double-click guard after closing a loop.** A draft started by the click right after
    a loop was closed isn't cancelled by a double-click. Side effect: closing a loop, then
    double-clicking somewhere else much later leaves a 1-point draft (Esc clears it).
    Using the event time would remove that, but `ToolPointerEvent` has no timestamp.
11. **`plan.replace` now returns the replacement from `applyCommand`.** M4's preview
    recipe `d => cmds.forEach(c => applyCommand(d, c))` would drop that return value.
    Either reduce over the commands, or keep `plan.replace` out of gesture command lists.
12. **The side label after closing.** Closing an anticlockwise loop and flipping it to
    "inside" leaves the session side on `left`, so the bar then reads "Strip: left" for
    the next open run. That's correct but may surprise; a per-loop side reset is an option.
13. **Shared controls live in `src/controls/`.** Both `tools/` and `ui/` use them, which
    avoids a `tools` ↔ `ui` import cycle (`ui` already imports `tools`). The snap picker
    now uses `SegmentedControl` too, so its buttons got a 28 px minimum width.

## From M3 implementation

1. **Piece dedup is still per run.** Overlapping walls now get a "pieces counted twice"
   warning (on the later-drawn run), but the BOM still counts both, and block-wall
   T-junctions still double the shared 1 × 1 column. Fixing it needs graph-based
   splitting instead of `splitWall` per run.
2. **Roof span is per room.** A longhouse split by an inner wall shows two spans; the
   badge is really a building/wing property (needs rectangle decomposition). For block
   walls the bearing line also depends on the strip side; we use the grid span.
3. **Courtyards count as rooms.** An "outdoor" flag would come with M4's inspector.
   *(Fix round: clear floors are now exact region maths, the face minus every wall's
   strip, instead of an inset ring. A neck too narrow for its walls splits the clear
   floor into pieces (areas summed, label in the roomiest piece) rather than
   collapsing the whole room or self-intersecting.)*
4. **Footprint and outer sizes are exact unions** of the enclosed area and the wall
   strips (plus corner boxes), so pinch vertices and notches narrower than the walls'
   outward reach are no longer over- or under-counted. *(Fix round: replaces the
   outward ring offset.)*
5. **Only enclosures are buildings.** A free-standing wall or an open U adds no
   footprint (the plan's "per-component outer face" would have counted fences).
6. **Room labels are measured with canvas `measureText`** in the overlay's font
   (cached). The font sizes are duplicated between `RoomLabels.tsx` and the CSS.
7. **Label spot prefers wide rectangles** (depth weighted ×3), so an L's label sits in
   the wide arm rather than the deeper but narrow one.
8. **The clear outline is hard to see over the meshes**: it coincides with the walls'
   inner faces by definition. It's useful when zoomed far out (and in the stepped
   mixed-material case); a fill tint might read better.
9. **Diagonal walls** (only from hand-edited files) are skipped by the room logic with a
   warning.
10. **Dimension tool hover is stale after pan/zoom** until the pointer moves (the tool
    only hears pointer events); it is cleared on plan changes. M4's shared `hoverAtom`
    can recompute on viewport changes. Dimension selection and moving are left for M4.
11. **Region maths cost.** Clear floors subtract the whole plan's wall solid per room
    (O(slabs × intervals)). Fine at house scale; clip the solid to each room's box if
    big plans get slow.

## From M4 implementation

1. **Corner drags re-orient loops instead of flipping `side`.** A loop dragged inside
   out is stored clockwise again (points reversed, `side` unchanged), so "closed loops
   are clockwise, right = inside" stays true. The plan's "flip `side`" would have left an
   anticlockwise loop. Vertex numbering changes on inversion; the drag always works
   from the run as it was at press time, so that's invisible.
2. **The Inspector's height is the family's height buttons**, not a free number input:
   it reuses `WallSettingsFields`, whose heights are the ones the family can build. A
   hand-edited odd height shows no active button until one is picked.
3. **Open uses a fresh `<input type=file>` per pick** (`files.ts`), not a hidden input in
   the header, so Mod+O and the button share it and re-picking the same file works. A
   dismissed picker relies on the input's `cancel` event (Chrome 113+, Firefox 91+,
   Safari 16.4+); in an older browser a dismissed picker would leave the `opening` guard
   set, so Open would stay dead until reload.
4. **Hover is still stale after a wheel zoom or pan** until the pointer moves (M3
   finding 10 applies to the Select tool too). `hoverAtom` could be recomputed from
   `cursorAtom` in a derived atom instead of on pointer moves.
5. **The snap cursor crosshair shows in the Select tool.** It helps when aligning moves
   but is noisy while just selecting; it could hide unless a gesture is under way.
6. **No Save vs Save as.** Every Save opens the picker; remembering the
   `FileSystemFileHandle` would allow a silent re-save (see plan finding 4: no unsaved
   indicator or `beforeunload` prompt either).
7. **Nudges are one history entry per key press** (plan finding 7), holding an arrow key
   fills the 20-entry history list quickly.
8. **Box select tests drawn lines**, not footprints: a box that only touches a block
   wall's strip (not its face line) doesn't select it in crossing mode.
9. **Per-kind selection facts live in `model/itemKinds.ts`** (fix round): collection,
   noun, lines for box tests and highlights, translate, remove and duplicate. Hit tiers
   stay an ordered list in `model/hitTest.ts`, since their order isn't per kind
   (M6 splits props across two tiers).
10. **The right column order is PlanHeader, Inspector, BOM** (the plan had the Inspector
    first), so the name and file buttons don't jump when the selection empties.

## From M5 implementation

1. **No `geometry/rect.ts`.** Floors are `WorldBox`es (`min`/`max`), so `box.ts` gained
   `boxSize`, `boxArea`, `boxIntersection`, `boxOutline` and an exported `pointInBox`
   instead of a parallel `Rect` module.
2. **One `Library` object** (`catalog/library.ts`, `library` in `catalog/index.ts`)
   carries the catalogue, wall and floor families and opening defs. `derivePlan(plan,
   lib)` and the edit commands take it, instead of a growing list of maps.
3. **Item kinds get an `EditScope`** (`{ lib, items }`): an opening whose wall is in the
   same edit leaves translate/remove/duplicate to the wall (no double patch, no double
   remove). Duplicating an opening alone puts the copy right beside it (after, else
   before) or makes no copy; `duplicateCommands` only selects copies that were made.
4. **Picker family.** Hovering a wall switches the picker only when its family has
   openings of its own; stone, log, scalewood and grausten walls keep the last list, which
   is how a stone wall gets a wood door. The picker also has an explicit "For" family
   select. The Inspector's prefab select lists every opening.
5. **Opening slides keep their offset**: a slide moves the start by whole metres
   (rounded symmetrically, so ← and → match) rather than re-snapping it, so an
   Alt-placed opening stays off-grid; moves of a selection with openings go in steps of
   at least 1 m. Openings sliding together don't block each other; if any opening of a
   wall is refused, all of that wall's slides are, and a drag keeps their last valid
   positions (mixed selections too).
6. **Corner reserve follows corner ownership** (fix round): block walls keep `t` clear
   only at ends where the strips overlap, where the corner column is inside the segment.
7. **Warnings have `level` ('warning' | 'info') and `source`** (any item). The BOM panel
   lists info in muted text; selecting a warning's source from the panel is still left
   for later. The Inspector shows the warnings of the inspected item.
8. **Floor legibility** (fix round): floor tiles are tinted 40 % material towards a
   slightly lifted canvas tone (`#3a424d`, so black marble still shows) at 0.6 opacity,
   checkered ±8 %, with 1 px SVG seams masked off under walls. The seams are hidden
   below 8 px per tile.
9. **Floor selection inside a room**: clicking an empty room interior selects the floor
   under it (tier after walls). There is no way to box-select only walls of a floored
   room in "touch" mode without also catching the floor.
10. **The opening hover is stale after pan/zoom** until the pointer moves (as M3 finding
    10 and M4 finding 4), since placement needs the plan and isn't a derived atom.
11. **`stave_gate` (Timberwood Gate) is 6 m tall**, taller than any wall (max 4 m), so it
    always cuts the full height with an info note; its resources include `Frostwood`,
    which has no label in `items.ts`.
12. **Floor seams sit in the overlay**, above the canvas, so they are masked by the wall
    footprints; opening gaps are not masked, so seams show through a doorway (as they
    should: the floor is there).

## From M6 implementation

1. **No stair helper.** `Prop.flights`, the "up" arrow and the rise/run readout were
   skipped (optional); stairs are plain props in the Stairs chip. The plan's stair list
   is used as is, so the Dvergr spiral stairs (category `building`) are not props.
2. **`upgrades` is required on `Prop`** (files without it load as 0), rather than
   optional, to keep `exactOptionalPropertyTypes` noise out of every reader.
3. **Item kinds take the library in `lines`/`highlight`**, and may define `inBox`: a
   prop's footprint needs its def, and a rotated footprint uses a SAT box test (a box
   wholly inside a footprint still "touches" it). `itemsInBox` and `HitOptions` gained
   `lib`/`propDefs` accordingly.
4. **The underlay move and the opacity slider preview through `editPreviewAtom`**
   (an `underlay.patch`), so `useDisplayPlan` draws them and release commits one entry;
   no separate underlay preview atom.
5. **The ghost needs no `onPointerLeave`**: it is derived from `cursorAtom`, which is
   null once the pointer leaves the canvas.
6. **Approximate footprints are an Inspector note, not a plan warning**, so the BOM
   warning list isn't filled with every cauldron; unknown prefabs are plan warnings.
7. **Start-up prune is per browser profile, not per tab**: a second tab with another
   underlay would lose its image on the first tab's reload ("Image missing", relink).
8. **"Save image in file" lives in the Underlay tool's options bar** (session-only
   toggle, default off); the status strip has the Radii and Underlay visibility toggles.
9. **Labels skip narrow props**: at 20 px/m a workbench (1.1 m deep) and beds get no
   label (short side < 24 px or < 4 characters fit); room labels can sit on top of prop
   footprints and labels.
10. **Ring labels sit at the top of the ring**, often off-screen for 20–40 m rings at
    working zoom; a label nearer the pivot (or along the visible arc) would read better.
    Overlapping labels are hidden greedily (selected rings first).
11. **Snap 1 m makes adjacent props collide**: placing 1.2 m beds a metre apart
    overlaps them silently (by design, finding 7 of the plan); a prop-to-prop edge snap
    would help furnishing.
12. **Fix round:** commands now share `propProblem` / `underlayProblem` with
    `parsePlan` (and `MAX_PROPS`), so anything a command accepts reloads. Images over
    8 MB are re-encoded; a save whose embedded image would push the file past the 30 MB
    open cap is written without it, with a warning.
13. **The catalogue overlays the canvas's left edge** (outside `ToolHost`) instead of
    taking a grid column, so the view doesn't jump; it covers 260 px of the plan while
    the Prop tool is active.
14. **Home / Shift+1 fit the view to the plan** (walls, dimensions, floors, props,
    underlay), as Open does. `0` still resets to the origin.
15. **Upgrades stepper and opacity arrows add one history entry per click / key press**
    (not coalesced).
