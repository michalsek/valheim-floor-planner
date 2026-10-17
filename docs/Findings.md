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

## From M7 implementation

1. **Theme picker sits in the status strip**, not the plan header: the 260 px side
   panel can't fit New / Open / Save and a three-way control on one row, and M6 has
   landed, so the plan's reason to avoid the strip no longer holds.
2. **Selection has its own colour** (`--selection`: magenta, `#ff5ad2` dark /
   `#c2179b` light), no longer the amber accent, which collided with the crafting
   group. Selected outlines also get a halo (`--label-halo`, 5 px) under the 2 px
   line. Hover, handles, the select box and selected openings / dimensions use it too;
   the accent stays for UI chrome and tool drawing.
3. **Grid is quieter than planned**: `--grid-alpha-scale` is 0.8 (dark) and 0.55
   (light) instead of 1.15 / 0.8, which drew near-white / near-black 10 m lines.
   Level alphas are clamped to 1.
4. **The underlay multiplies onto the light canvas** (`--underlay-blend`), so a white
   image background vanishes instead of reading as a pale slab; dark keeps `normal`.
   No `--underlay-dim`: the opacity slider already covers dimming. Not yet checked with
   a real image.
5. **Only scene values go through `readThemeTokens`** (grid line and alpha scale,
   floor base / material share / opacity, `--mat-*`); prop groups, rings and every
   overlay colour stay pure CSS (`var()` in `style`/classes), so they need no parse.
   A missing `--mat-*` takes `--mat-fallback`; the parser keeps no palette copy. The
   parser test contains hex literals too (the only other `src` match).
6. **`PieceFootprints` takes `paint: 'fill' | 'solid' | 'none'`**: material fills are
   now inline `style` (to resolve `var()`), which would beat class fills, so the
   selection highlight passes `none`.
7. **Dev-only flash**: in `pnpm dev` the CSS is injected by JS, so the page shows the
   UA background (from `<meta name="color-scheme">`, i.e. the OS scheme) for a moment
   when the saved choice differs from the OS. Production links the CSS, so no flash.
8. **`ice` and null materials** (3 pieces in the data) use `--mat-fallback` (orchid);
   it is close-ish in hue to the selection magenta but far less saturated.
9. **Light-theme floor seams** are canvas-coloured, lighter than the tiles; they read
   as grout and look fine on wood and stone.
10. **The browser pane couldn't render while hidden** (no `requestAnimationFrame`, so
    WebGPU never initialised); screenshots came from a headless Chrome driven over CDP
    instead.
11. **Fix round:** light floors use `--floor-material-share: 0.7` and
    `--floor-opacity: 0.75` (dark keeps 0.4 / 0.6), so stone, black marble and iron
    floors differ; the grid shows less through light floors as a result. Hovered pinned
    dimensions use the selection colour at 60 %. `SegmentedControl` now requires a
    `label` (group name), so new uses can't miss it.

## From M8 implementation

1. **Step 0 (the picker spike) was skipped**: an agent can't drive the native picker.
   Still unverified: whether Chrome's `showDirectoryPicker` opens
   `~/Library/Application Support/Steam/…` on macOS. The gate copy covers both outcomes,
   and "Select with upload dialog" (`<input webkitdirectory>`) is always offered. The
   handle path was exercised with an OPFS directory handle instead (same code:
   `handleDir`, `queryPermission`, IndexedDB-stored handle, warm start).
2. **The LZ4 decoder was the cold-parse bottleneck** at first (57 MB/s, ~31 s per scan
   in node under load): a closure per byte and a template-literal message built on every
   `check()`. It is now one flat loop (~300 MB/s), `check()` takes lazy messages, and
   `ByteReader` uses prototype methods. Measured cold parse: 4.5–5.3 s in Chrome from
   real disk files, 16–18 s while Valheim itself was running; ~2 s in node.
3. **Block re-reads remain**: the walk decompresses ~10.3k blocks for ~2.7k distinct,
   because each sweep (one per transform level, then all GameObjects, colliders, meshes)
   touches more blocks than the 512-block (64 MB) LRU holds. A 4096-block LRU reads each
   block once (~3× faster) at ~340 MB peak worker memory; merging sweeps (reading level
   N's GameObjects with level N+1's transforms) is the cheaper-memory option.
4. **The hierarchy walk differs from the plan**: transforms are walked level by level
   (they hold the whole structure), then every GameObject, collider and mesh is read in
   one sweep each. Walking each level's GameObjects/colliders too took ~40 sweeps.
   Snap points come out breadth-first (the Python was depth-first); nothing depends on
   their order and the golden test compares them as multisets.
5. **The worker gets two files, not four**: the bundle and `resources.assets`. The main
   thread already reads `manifest_extended` (to find the bundle) and `boot.config` (for
   the fingerprint).
6. **Extra modules beyond the plan's table**: `install/directory.ts` (`DirLike` and the
   File System Access calls, which TypeScript's DOM lib doesn't type),
   `install/fileErrors.ts` (DOMException → error code), `gameData/unity/values.ts`
   (checked accessors for type-tree values), `ui/InstallGate/InstallPaths.tsx` and
   `ui/shared/{installCopy, useFolderInput, useInstall}` (shared with the status-strip
   menu). `installStore` has no `clear()`; `putHandle(null)` forgets the folder once a
   scan from the upload dialog succeeds. Two error codes were added beyond the plan's
   list: `moved` (the remembered folder is gone) and `workerFailed`.
7. **`STATION_MAX_UPGRADES` stays in `catalog/stations.ts`** (the plan listed it under
   `valheim/constants.ts`, whose header now points there).
8. **Small output differences from the Python**: a missing Polish item name falls back
   to English (Python wrote null, which `parseItems` rejects; never happens in 1.0.20);
   pieces without a `Piece` component are skipped; an unknown material enum becomes
   `material<N>`.
9. **Bug found in browser testing, fixed**: clearing the folder input's `value` empties
   its live `FileList`, so the files are copied to an array first.
10. **Upload-dialog users get one extra click per visit**: with no stored handle, the gate
    offers "Use the catalogue scanned on…" rather than opening it automatically (as the
    plan decided). Re-scan is hidden for them; Change folder opens the upload dialog,
    and the reload after it opens the new catalogue directly (a `sessionStorage` key
    names the catalogue to open, so this works only within the tab).
11. **Fix round**: the stored folder is replaced or forgotten only after a scan succeeds;
    a moved or deleted folder reports `moved` (the picked folder is listed when a file
    lookup misses); the dedicated-server check runs before the data-folder candidates; a
    cycle in `m_Children` throws `corrupt`; a new parse with other files cancels the
    running one, and a superseded scan no longer updates the gate. Scan dates are
    formatted in English (`en-GB`). The metadata reader now stops after the object table
    (scripts, externals and ref types were parsed but unused).
12. **`@types/node` is now a dev dependency**, for the golden test's `node:fs` source (a
    `/// <reference types="node" />` in that file only).
13. **Still unverified**: Windows/Linux layouts (`valheim_Data`) and bundle names,
    Safari's handling of `Valheim.app` in the upload dialog, and the dedicated-server
    check (it looks for `valheim_server_Data/boot.config` or a folder of that name).
14. **QA scripts**: in `pnpm dev`, modules updated by HMR load with `?t=` URLs, so a
    script that does `import('/src/install/loadInstall.ts')` from the page can get a
    second module instance; import the URL the page actually loaded.

## From M9 implementation

1. **Mouse map follows M10's plan, not M9's** (coordinator request): left click picks, right
   drag orbits, Shift/Ctrl/⌘ + right drag pans (built into OrbitControls), middle drag or
   Space + left drag pans, the wheel zooms to the cursor, and a right click without a drag
   does nothing. A left drag does nothing in M9 (it is M10's tool drag).
2. **Where the plan's responsibilities landed**: entering 3D (cancel the gesture, clear the
   pointer and hover, switch to Select unless the tool has `in3d`) is a `viewModeAtom`
   subscription in `ToolHost`; `setViewMode` only sets the atom (`toggleViewMode` and `resetOrbit` sit beside it). The
   depth planes are `orbitMath.clipPlanes`, applied by `OrbitRig` (`fitClipPlanes`) after
   every camera change. `OrbitRig` registers its controls as r3f's `controls`, and `Ground`
   reads the orbit target from there to fade the grid (3 × orbit distance, at least 30 m).
   `Plan2d.tsx` holds the old canvas children. `CameraRig` now sets the ortho frustum itself.
   Fit/reset requests are read with `useAtomValue` and handled in a layout effect after the
   render they arrive in (so Open/New in 3D frame the new plan); requests from before the
   mount are ignored. M10's dolly requests can use the same path.
3. **Instance capacity** is the next power of two of the box count, and the mesh remounts
   when it changes either way (the plan said "larger").
4. **Hover is not tracked during a drag** (an orbit moves everything under the pointer); it is
   re-picked on release, and on every camera change while the pointer rests on the canvas.
5. **Stairs are now green** (`--prop-stairs`, both themes): the old pink read like the
   selection tint in 3D.
6. **Props stand on the datum**: a collider reaching below the pivot (floor braziers,
   torches, the dvergr lantern pole) is clipped at y = 0, with a 0.1 m minimum height. M11 may
   give props a real base.
7. **Translucent panels are not sorted per instance**: where two door or gate panels overlap
   on screen, they may blend in the wrong order. Harmless at 0.35 opacity.
8. **Floors below the ground** show through the grid and the shadow catcher, darkened by the
   catcher where shadowed; a low angle shows stone floors 1 m deep and wood 0.13 m, but
   faintly. A stronger "below ground" treatment (e.g. a cut line at y = 0) could help.
9. **Perf (headless Chrome 155, WebGPU on an Apple Metal-3 adapter)**: a 64 × 64 m wood floor
   in 4 m stone walls is 1,176 boxes; one frame is 5 draw calls (pieces, shadow pass, grid,
   catcher) and ~28k triangles, and a forced render loop with orbiting takes ~3.6 ms per
   frame (≈280 fps equivalent) at 1288 × 827. Headless Chrome throttles rAF to ~20 Hz, so
   real on-screen fps wasn't measured; check on a headed window.
10. **Not exercised in the browser**: trackpad gestures and Safari. (Open and New in 3D were
   checked through CDP's file-chooser interception.)
11. From the plan's out-of-scope list, still open: room labels, dimensions and ring labels
    projected into 3D; the underlay as a ground texture; station rings as ground circles;
    a Mac trackpad's two-finger scroll zooms rather than pans in 3D; `+` / `−` do nothing in
    3D (M10 dollies); soft shadows on plans over ~200 m (cascaded shadow maps); mixed panel
    thickness within a family shows as uneven wall faces (true to the game);
    `PlacedPiece.base` is 0 for floors and means nothing there (M11 should define it).

## From the M8 drag-and-drop follow-up

1. **The macOS folder dialog failed in the user's test** (`~/Library` hidden or blocked,
   `Valheim.app` treated as a file), so the gate (and the editor's install menu) accept
   a dropped folder: `Valheim`, `Valheim.app`, `Contents`, `Resources` or `Data`.
   `install/dropFolder.ts` captures the item synchronously, then tries Chromium's
   `getAsFileSystemHandle()` (stored like a picked folder when it can be listed), else
   `webkitGetAsEntry()` (any browser, this visit only; files are looked up by path,
   never by listing the 4 GB folder).
2. **`getAsFileSystemHandle()` can stay pending forever**: it never settled for
   DevTools-synthesized drops in headless Chrome, which would leave the gate stuck. It
   is raced against a 2 s timeout, then the entry is used.
3. **A drop outside a drop target in the editor** (e.g. on the canvas) opens the folder
   in a new tab, as browsers do by default. Only the open install menu takes drops.
4. **Chrome's blocklist covers all of `~/Library`**, so on macOS the folder picker can
   never open Steam's default library (the user saw the "contains system files"
   dialog). In headed Chrome, a drop of the install path made `getAsFileSystemHandle()`
   reject with AbortError ("The user aborted a request.") after 4.5–6.5 s, while a drop
   from `~/Documents` resolved in 5 ms to a listable handle. So on macOS and Windows
   (Program Files) drops use the entry only and nothing is persisted; the gate leads
   with the drop zone on macOS and offers the cached catalogue first on return visits.
   A picker cancel (which is also how the blocklist refusal ends) shows a dismissible
   hint about dragging the folder in.

## From M10 implementation

1. **`in3d` now defaults to true**: only the underlay tool sets `in3d: false` (its image isn't
   drawn in 3D and calibration needs pixel-exact clicks). `worksIn3d(tool)` in `toolbox.ts`
   reads it; entering 3D with the underlay tool active switches to Select.
2. **Where the plan's pieces landed**: `ToolHost` takes every press in the capture phase, in
   both views, and never stops it, so window listeners (the install menu's outside click)
   still see it. In 3D it bumps `toolPressAtom` and `OrbitRig` turns the controls off until
   that event has been dispatched, so OrbitControls skips the press without capturing it.
   Non-left presses and Space + left go to OrbitControls as a `camera` gesture. A camera
   move under a still pointer (damping, wheel, fit, `+` / `−`) is replayed to the tool as a
   move, which replaces M9's hover re-pick. The theme carries the overlay ink colours
   (`ThemeTokens.ink`). The 3D view bar moved to the bottom of the canvas, since the tool
   options bar now shows in 3D too.
3. **Rays that miss the work plane**: a piece under the ray (a wall seen against the sky
   from a low camera) gives the tool its world point (the hit's plan position); with
   neither, moves drop the tool's hover, a press reaches the tool's new `onPointerMiss`
   (Select clears the selection) and a release cancels, unless it is still a click on a
   press that had a world point. The plane is ignored beyond 6 orbit distances.
4. **Moves drag along the grabbed point's plane**: Select keeps the height of the point it
   grabbed (a wall's face, a prop's top) and intersects that horizontal plane on every move,
   so the piece stays under the pointer. The 3D drag threshold is 6 px (3 in 2D).
5. **Tool lines show faintly where pieces hide them** (a depth-tested pass at full colour,
   and an untested pass at 35%), for previews, the snap cross and pinned dimensions.
   Handles, labels and the select box are SVG over everything; hidden handles stay
   grabbable.
6. **Box select in 3D is a screen rectangle**: an item is contained when all its pieces'
   projected corners are inside, touched when their projected bounds overlap it (items
   without pieces, i.e. dimensions, use their drawn lines). 2D is unchanged.
7. **The work datum is applied in one place per layer**: pieces stand at their own elevation
   (`getPieceBoxes(plan)`, 0 until M11); `View3d` lifts the previews, the snap cross and
   pinned dimensions in a `<group position-y={datum}>`, and `Overlay3d` gives its content the
   datum through `OverlayPlaneContext`. Besides those, the cursor, picking (handles, grab
   fallback), `pxToMetresAt` and `Ground` read it. Pinned dimensions are drawn at the datum,
   which M11 should revisit once dimensions carry an elevation.
8. **Floor ghosts are faint**: floors hang below the datum, so only their top shows at the
   grid; the outline and the size / tiles label (shared with 2D) carry the preview. The
   ruler's Δx / Δz isn't drawn in 3D (only lengths are).
9. **Ghost meshes** start with room for 64 boxes and grow ×4 when outgrown (never shrinking
   while shown), so a floor drag doesn't rebuild its instance buffers at every power of two.
10. **macOS Ctrl+click** reaches the page as button 0 with `ctrlKey`, so in 3D it acts as a
    tool click, not as OrbitControls' Ctrl + right pan; a two-finger click is button 2 and
    orbits. Not checked on a real trackpad (headless Chrome only).
11. **Not exercised in the browser**: releasing an orbit outside the window (CDP can't send
    that), trackpad gestures, Safari. Checked in headless Chrome 155 on WebGPU and `?webgl`.
12. From the plan's out-of-scope list, still open: orbiting about the picked point; trackpad
    two-finger scroll zooms in 3D; room labels, the "show all" rings and the underlay in 3D;
    touch input; snapping to wall tops and piece snap points; handles at wall tops when a
    floor covers their bases.

## From M11 implementation

1. **Support contacts are by collider overlap**, as recalled from the decompiled
   `WearNTear.UpdateSupport` (`Physics.OverlapBox`, then `ClosestPoint` on the other
   collider), not re-verified against the IL. The angle of a support uses the direction
   from the centre of mass to that closest point; the distance is centre to centre (+0.1).
   These reproduce every limit in the plan: a wood wall column holds 8 (16 m) and breaks
   the 9th, log poles hold 12 (24 m) and break the 13th, a wood floor cantilever off a wall
   top goes 70.6, 40.9, 23.7, 13.8 and breaks the 5th tile (8.0), and a stone tile beside a
   stone wall gets 0.
2. **A contact needs a face, not an edge** (fix round): two boxes touch when they come
   within 0.05 m of each other (each grown by it) *and* share at least 0.1 m in both
   directions across the contact. Without that, a stone tile beside a 2 m stone wall
   (1 m courses) edge-touched the lower course below its centre of mass, took mostly
   vertical loss and stayed up at 141. The face threshold is our choice; the game's
   `OverlapBox` would count an edge within its margin. Check against the IL.
3. **The pair rule** (two supports below, ≥ 100° apart on the plan) takes the mean of
   each support's own vertical-loss value, which is the game's form as recalled and equals
   the plan's `avg(s)·(1 − v·(avg(d) + 0.1))` when both distances match. A support counts
   as "below" for it only when its point is below the centre and the direction points down
   (the plan's rule). If the game only checks `point.y < com.y + 0.05`, level floor rows
   would prop each other up and cantilevers would reach further; check the IL.
4. **Perf** (production build, headless Chrome, on a machine with a load average of 5–7
   from other agents, so real numbers are lower). Support for 3,024 boxes (36 three-level
   houses) takes about 40 ms (contacts ~22 ms, propagation ~19 ms; about half that at low
   load). It is never on the commit path: it is worked out only while the support view is
   on or the Integrity list is open on screen, in an idle callback after the plan settles,
   and lands 30–50 ms after a nudge. A nudge of a ground-floor wall on that plan mostly has
   no long task; the occasional one is 54–72 ms, nearly all of it the nudged level's rooms
   (`findRooms` over its 36 houses, ~33 ms under load). Rooms per level are reused while a
   level's walls are the same objects, so only the edited level is recomputed; splitting
   rooms per connected component would take the rest off.
5. **Stairs and ladders connect levels**: they make no level rows, aren't the "nearest
   lower level" for ghosts, are skipped by Shift+PageUp / PageDown and by a flight's auto
   rise. Each piece belongs to the level its flight starts from (the highest level at or
   below it), so the whole flight draws, picks, selects (Mod+A) and moves with that level.
6. **A pole hanging from a supported deck stays up**: removing one lower pole of a 4-pole
   deck leaves the upper pole red, not magenta; it takes (horizontal) support from the deck
   tile it touches, as attached pieces do in the game. The plan's "column goes magenta"
   holds for a deck on a single column.
7. **The support view's selection tint is neutral** (white in dark themes, near-black in
   light ones), in both views, since the selection pink read as collapsing. In 2D a wall
   column shows magenta when any course would collapse, blue when its base course is
   grounded, else its weakest course; props show their band too.
8. **The 3D work-plane grid above the ground** is a see-through plane over the levels below,
   so off the ground it is drawn at 40% and only around the orbit target. The shadow
   catcher stays at the terrain (y = 0). Pinned dimensions on other levels are faded and
   hidden behind pieces; their labels are faded.
9. **2D ghosts**: the level below's walls and floors are faint slabs under the current
   level's (so its floors dim them), its items faint footprints (poles at their full
   standing height for the reach rule); dimensions and openings aren't ghosted.
10. **Poles and beams stand on their elevation with their whole collider**: a 0.4 m beam at
    elevation 2 spans 2–2.4 m. Placing a beam under a floor needs the elevation field (or a
    0.5 m step). Diagonal beams stay building pieces.
11. **A stone (1 m) floor at a wall-top datum hangs 1 m into the walls under it.** Laid
    beside a wall's strip it only touches the wall's face sideways and collapses
    (horizontal loss 1). A tile whose centre of mass lies inside the wall counts as resting
    on it straight down and stays up, but its neighbours that only touch the face don't. The Floor tool now
    says so for floors thicker than 0.5 m on a wall top, with a "+1 m" button that raises
    the level so the floor rests on the walls.
12. **Elevation editing for several items** is only Mod+PageUp / PageDown; the Inspector's
    Elevation field is per item, and the level follows it. Undo doesn't move the current
    level, except when it leaves the current level empty: then it follows the selection.
13. **Floor tops are lifted 1 mm** in their boxes, so a floor level with the wall top under
    it doesn't flicker; contacts and picking are unaffected at that scale.
14. From the plan's out-of-scope list, still open: level names, rippling when a lower wall's
    height changes, diagonal beams as wedges, uneven terrain, checking the angle mapping /
    pair distance / overlap growth / face threshold against the IL, furniture giving
    support (`m_supports`), and computing support in a worker. The optional "Hide above"
    toggle wasn't built.
15. Checked in headless Chrome 155 on WebGPU and `?webgl` (dark and light themes) with real
    mouse input; not on Safari or a trackpad.

## From M14 Phase A

1. **`wood_roof` draws 3 groups, not 2**: its `_Combined Mesh [high]` has 3 submeshes
   (660/6/72 indices) and its renderer 3 materials (`woodwall`, `straw_roof`,
   `straw_roof_alpha`, the last a cutout at 0.69). The plan's "2 materials" didn't hold on
   this install (Unity 6000.0.75f1), so the golden test asserts 3.
2. **LOD rule extended**: five pieces (blast furnace, artisan table, spinning wheel, eitr
   refinery, lava lantern) put a SkinnedMeshRenderer in LOD0 and a static `low`
   MeshRenderer in LOD1 only, so "drop what isn't in LOD0" drew nothing. Each LODGroup
   now shows its **first level with a drawable renderer**; renderers only in other levels
   are dropped. Stations that list a renderer in LOD0 and LOD1 (the forge, the iron fire
   pit) are unchanged. Only `piece_repair` and `artisan_ext1` draw nothing (stored as a `none`
   record, so they aren't extracted again). VikingShip has 18 parts.
3. **Golden data** (`research/valheim-models.json`, 211 KB, counts only): 398 prefabs, 406
   meshes (vertex/index counts, `.resS` or inline, normal format, sums of decoded
   positions, normals and UVs), per-material vertex/index contributions and baked bounds,
   and the 409 textures the materials use (97 BC1, 209 BC3, 103 BC7; the RGB24 noise
   texture isn't read, since `_NoiseTex` is ignored). `pnpm test:assets` matches it
   for every mesh, prefab and texture, independently of UnityPy's code. Bounds are
   compared only for the 385 prefabs without built-in primitives.
4. **Models sit inside their colliders**: 82 of 85 wall and floor pieces are within
   ± 0.3 m. The three outside are `wood_wall_log_4x0.5` (0.33 m), the dvergr stake wall
   (0.58 m) and the blackwood stake wall (0.39 m), whose logs and stakes reach past the
   collider. So the root-transform rule and the raw Unity axes line the models up with the
   catalogue's boxes.
5. **Timings**: in Node, opening the bundle plus the first model takes 0.23 s, a warm
   prefab 8 ms, and all 398 models 2.5 s plus 0.1–0.16 s for all textures. In headless
   Chrome 155 (dev server):
   - the cold first model, including the worker start and bundle open, takes 0.31 s;
   - a warm prefab takes 30 ms;
   - "Extract all", writing to OPFS, takes 7.4–8.1 s;
   - a cache hit (model and texture) takes 2 ms, and 1.9 ms after a reload from the cached
     catalogue without folder access.
6. **Cache size for all pieces: 41.2 MB** (398 models, 409 textures), above the plan's
   ~35 MB. Normals and tangents are stored as float32; quantizing them is the obvious cut
   if size matters.
7. **Where things landed**:
   - The piece-table helpers moved from `extractCatalogue.ts` to `pieceBundle.ts`, which
     keeps the bundle so `.resS` can be read.
   - Bake and merge are pure, in `bakeModel.ts`. `extractModels.ts` keeps the I/O.
   - `ModelSource` also has `models(names)` and `textures(ids)` for batching. The worker
     runs "Extract all" in batches of 20 prefabs, one bundle sweep per hierarchy level.
   - Group materials carry texture IDs as decimal strings (JSON-safe).
   - `MeshData` records `streamed` and `normalFormat`, for the golden test.
8. **Worker protocol additions**:
   - `{textures, ids}`: refetches a texture that is missing from OPFS.
   - `{storage, persistent: false, reason}`: switches the page to the memory fallback.
   - The worker posts texture buffers only in memory mode or when asked. With OPFS, the
     page reads them with `getFile()`.
   - Requests made in the same tick go to the worker as one batch.
   - Clearing the cache terminates the worker first, because it may hold sync handles.
9. **Files kept for extraction**: `loadInstall` keeps the located `InstallFiles` and the
   catalogue key (`getInstallFiles()`, `getCatalogueKey()`). A scan through the upload
   dialog or an entry-only drop starts "Extract all" in the background (checked: it
   finished, and models loaded from the cache after a reload). `connectAssetFiles()`
   re-grants the stored folder from a click and checks that its fingerprint still matches.
   The menu's "Extract all models" calls it first.
10. **Not exercised**: the memory fallback (Safari private mode, quota, two tabs), Firefox,
    and the "Reconnect" path with a stored handle (headless Chrome can't grant it).

## From M11.1

1. **Poles, beams, pillars, stairs and ladders snap by their snap points** (`PropDef.snap`):
   one snap point (the lowest x, then z) goes on the grid, so a pole's axis lands on a wall
   joint or corner and a beam's end on a grid point, its centre line on the wall line. They
   turn about the middle of their snap points (a pole about its axis). Grabbing one in a
   move, or nudging a selection led by one, lands that anchor on the grid; other items in
   the move keep their offsets. Furniture and stations keep the footprint-corner rule.
2. **Walls between poles were already in contact with them.** With the old placement
   (the pole 0.2 m off the line) and the new one alike, every course of a log wall touches
   the pole at its end. The poles add nothing because support distances are centre of mass
   to centre of mass, and that's what makes the known limits come out right (a 16 m wood
   column, a 4-tile cantilever). A 4 m log pole's centre is 2 m up, and a 4 m log beam's is
   2 m along the wall, so a pole's sideways offer (≤ 91) never beats what the log course
   below passes up (140, 131.6, 123.7 … 90.8 for 8 courses). Poles do win where they are
   close, e.g. 2 m logs level with a 4 m pole's middle (113.6 against 109.3 from below).
3. **The support colours follow the game's scale** (as recalled from
   `WearNTear.GetSupportColorValue`, not checked against the IL): blue at the material's
   maximum, which includes capped pieces such as wood on stone, and red → green from the
   minimum to *half* the maximum, all green above. Before, the ramp ran to the maximum, so
   a 4 m log wall's upper courses (~91 of 140) showed yellow where the game shows green.
   This is what the user's screenshot showed: the support values haven't changed, their
   colours have. A wood cantilever now shows 70.6 and 40.9 green, 23.7 orange, 13.8 red,
   and the 5th tile magenta.

## From M14 Phase B

1. **Pivots use a per-axis anchor, not the collider centre.** A box is centred on the
   middle of the prefab's snap points along each axis where the box spans them (lengths,
   wall and gate heights), else on the middle of its collider (thicknesses, floor depth,
   door panels). The collider centre put the hardwood gate 0.19 m sideways and 0.18 m
   too low (its collider reaches past its snap points); the ashwood door, whose pivot
   is its hinge, comes out right either way. No wall, floor or opening prefab has a
   collider whose z size matches its length better than its x size, so the plan's
   extra 90° turn wasn't needed and isn't implemented.
2. **Alignment check** (`?modelBoxes` in dev draws every box's wireframe over the
   models): wood, stone, grausten, ashwood and timber walls drawn both ways (block walls
   with their strip on either side), wood and stone floors on two levels, the wood and
   ashwood doors, the wood and hardwood gates, log poles (2 m and 4 m), wood and
   darkwood beams, workbench, forge, hearth, both chests, the dragon bed and wood stairs,
   at 0°, 90° and 210°. All line up with their boxes. Parts that stick out by design:
   the hardwood gate's posts above its box (its collider is 6.4 m tall, its snap points
   6 m), the bed's carved posts and the forge's handle.
3. **`_Metallic` is ignored**: the scene has no environment map, so grausten and the
   forge (`_Metallic` 1) rendered black. Metal reads as plain diffuse.
4. **Grausten looks like smooth dark grey**, not blocks: its 128 px texture is stretched
   across the wall by the mesh's UVs. Valheim's piece shader probably maps it in world
   space; not reproduced.
5. **Helper meshes**: the ships' `watermask` (a `Custom/Water` mesh that keeps the sea out
   of the hull) is skipped by name, or it shows as a white sheet. The shield
   generator's `invisible` material is a cutout with `_Color` alpha 0 and no texture;
   cutouts now test `_Color` alpha too, so it draws nothing. `blackhole` (under ship
   decks) draws black, as in the game.
6. **WebGL2 stalls when 3D opens with models**: 2–8 s of synchronous shader linking
   (`getProgramParameter`) on each entry, because the 3D view (and its materials) is
   rebuilt each time. three r186 builds one vertex program per instanced mesh (the
   instance matrices are a uniform buffer named per buffer): 118 vertex and 7 fragment
   programs for 58 prefabs. Materials keep their values in uniforms, so fragment programs
   are shared. WebGPU builds pipelines asynchronously: about 220 ms warm. Keeping the
   model resources alive across 2D/3D switches, or storage-buffer instance matrices,
   would help.
7. **The asset worker now serves on-demand requests between "Extract all" batches**.
   After a fallback scan, the background "all" made the first model wait 10.8 s; now
   the 20 prefabs of the check scene load in about 1 s while "all" continues
   (`install/assets.worker.ts`, a small change to Phase A code).
8. **Perf**, headless Chrome 155 on an Apple M4 Pro (Metal), 1400 × 900:
   - Scene: 58 prefabs (7 wall families with doors, 3 floor families, 40 props × 3).
   - 60 instanced meshes and 118 draw calls, including the shadow pass, so under the
     ~150 target. 255k triangles.
   - About 1.7 ms per forced frame. Headless rAF is throttled, so on-screen fps wasn't
     measured.
   - GPU memory for models: 1.1 MB of BC textures plus 1.6 MB of geometry.
   - Memory stays flat: after switching Boxes / Models 10 times, Boxes mode is back at
     its 5 textures and 5 geometries each time.
   - Warm load of the 20-prefab scene: about 220 ms on WebGPU. Cold from the install
     (cache cleared): about 1 s.
9. **B4 (software BC decoding) wasn't built**. On this Mac, Chrome exposes S3TC,
   S3TC-sRGB and BPTC on WebGL2, and BC on WebGPU, so every texture uploads as is. A
   format the renderer can't sample is left out, and the material shows its `_Color`.
   That path wasn't exercised (no stub).
10. **Box mode is unchanged**: a 1400 × 900 screenshot of the check scene in Boxes mode
    matches base 5712221 pixel for pixel in the canvas. Only the status strip differs
    (the new toggle).
11. **Doors and gates in Models mode use the panel opacity (0.35)**, as the plan asks.
    The door models look ghostly; drawing them opaque may read better.
12. **"Reconnect folder" can't help after a drop**: an install opened by dropping the
    folder has no stored handle, so the click fails. Its tooltip then says to open the
    folder again from the install menu, which reloads the page. The stored-handle path
    still isn't exercised: headless Chrome can't grant it.
13. **Tool previews stay boxes**, and picking uses the boxes, so parts of a model that
    stick out of its box (gate posts, bed posts) can't be picked.
14. **Support tint**: a band colour covers 80% of the texture, and pieces outside
    support keep their texture. Selection mixes 70% and hover 35%, as for boxes; the
    level fade (40% towards the canvas) is composed into the same per-instance tint.
    In the dark theme, faded models get quite dark but stay readable.
15. Checked in headless Chrome 155 on WebGPU and `?webgl`, in the light and dark themes,
    with real mouse picking and hover. Not checked in Safari, Firefox or a headed window.

## From the M14 fix round

1. **WebGL2 no longer freezes on entering 3D.** Model meshes are plain `Mesh`es drawn
   `count` times, with the instance matrices as four interleaved instanced attributes
   (`instanceColumn0..3`) that the material reads (`positionNode`, which the shadow pass
   copies; normals and tangents turned in `setupPosition`). r186's `InstancedMesh` puts
   its matrices in a uniform buffer named per mesh, so each mesh had its own vertex
   program. Now meshes of one material shape share one: 7 vertex programs in all for
   the 58-prefab scene (was 118). The model resources (meshes, materials, textures)
   live per renderer across 2D/3D switches (`useModels.ts`), so their pipelines stay
   linked; the plan dropping a prefab disposes its resources, and Boxes frees them all.
   `compileAsync` warm-up wasn't needed.
2. **Timings, 58-prefab scene, warm model cache, headless Chrome 155 (M4 Pro):**
   - `?webgl`, before: 2D→3D took 9–19 s until every model showed, with single long
     tasks of 4.9–8.9 s, on every switch.
   - `?webgl`, after: the first entry after a page load takes 0.7 s (longest task
     274 ms); with the GPU shader disk cache disabled and a fresh browser, 1.5 s
     (longest task 823 ms). Later entries take 145–340 ms (longest task 128–320 ms).
   - WebGPU, before 300–560 ms (longest task 150–250 ms); after 220–330 ms (longest
     task 200–230 ms).
   - Toggling Boxes / Models five times: Boxes mode is back at 5 textures and
     5 geometries each time.
3. **Tints mix in sRGB**, as the boxes' colours do: in linear, the canvas colour at 40%
   (pieces off the level) washed dark textures out to near white. The support tint went
   from 0.8 to 0.7, so the texture still shows under the band colour.
4. **Door and gate models are drawn solid.** Their boxes keep the 0.35 panel opacity.
5. **Getting the game files back without a reload**: opening (dropping, picking or
   uploading) the install already in use from the editor only keeps its files and
   retries the models; it no longer re-parses and reloads. While models wait for the
   files and there is no stored folder, the strip says "Drop your Valheim folder here
   to load models" and the canvas takes the drop (checked: 58 blocked models loaded,
   no reload). With a stored folder, "Reconnect folder" stays. When a dropped folder is
   another build, the models the 3D view last showed are stored into the new build's
   cache before the reload ("Storing the plan's models…"; 58 models and 32 textures in
   1.4 s); without a 3D visit there is nothing to store, and the drop hint covers it.
6. **"Extract all" takes 3.5 s (was 9.5–10.4 s here, 12–45 s in QA).** The worker
   profile showed 80% in re-reading and re-decompressing bundle blocks: the hierarchy
   objects of all 398 pieces are spread over 2,669 blocks (~340 MB unpacked), and the
   64 MB block LRU was swept once per batch and hierarchy level (19k block reads, 1.2 GB).
   Before extracting everything, the worker now reads every GameObject, Transform,
   renderer, filter, LODGroup and Material once and keeps their bytes (25 MB,
   `SerializedFile.preload`): 4.5k block reads. Streamed `.resS` data also has its own
   small LRU now, so it doesn't push object blocks out.
7. **Asset worker and client fixes**: "Extract all" marks itself in `onmessage`, so
   model requests sent while it waits behind `open` go first (the 58 models of a plan
   showed after 1.75 s while "all" ran 4.5 s); `index.json` is written before the last
   progress message, so "all pieces" shows straight away; clearing the cache re-asks
   for the models and textures still waited for (they used to stay boxes); only a full
   quota switches the worker to memory, a deleted folder is created again, and other
   write failures skip the file; `navigator.storage.persist()` is asked for once; a
   decode error rejects that request's waiters. One prefab, mesh, material or texture
   that fails to read no longer fails its batch (it comes out as null, a box).
8. **Strip**: failed models show "N models couldn't be read" (the reason in its
   tooltip); the memory-only notice shows once per visit; the menu shows one message
   for missing folder access.
9. **Not exercised**: the memory fallback, the pre-reload extraction through a real
   build change (exercised by calling it with another key), Safari and Firefox.
