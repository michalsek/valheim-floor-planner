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

## From M12 implementation

1. **Research §3 is wrong about 6 m and 10 m spans.** The half-run is measured from the
   eave to the ridge: R = span/2 + eave overhang. Any whole-metre R tiles with whole
   pieces: an odd R ends in a ridge row (the ridge piece adds 1 m of run each side), an
   even R meets at a seam with no ridge piece. What has to be whole is the number of
   2 m pieces across the eaves, so the eave span (span + 2 · eave) must be even. A 6 m
   room with 1 m eaves is fine (R = 4, a seam); the user's 8 m house with 1 m eaves has
   R = 5 (two straight rows and the ridge per side). The room badge now uses this rule
   (`roofSpan(w, d, eave)`, eave 0 for an unroofed room).
2. **Odd spans: the far wall gets a filler course** (fix round decision). With the ridge
   on whole pieces, the ridge moves 0.5 m towards the far side and the roof passes k
   above the far wall (0.5 m at 26°), so that wall is raised to the roof with a derived
   course: a 0.5 m log beam at 26°, a half wall at 45°, a full wall at 67°, from the far
   wall's family and falling back to wood, then log. It is in the bill of materials,
   in support (as boxes, with declared contacts for the eave cells resting on it) and
   in 3D. The same course raises a shed's high wall and edges off the 2 m grid; gable
   rectangles fall back to log beams, which closes the 0.5 m strip under the far
   triangle. A default 7 × 8 thatch house is all held up. Hiding roofs keeps gable
   walls and filler courses (they are walls). Open question for the user: whether the
   game builder would rather raise the far wall with real wall pieces (it's what this
   models) or build an asymmetric ridge.
3. **"Roof Cross" is decorative**, not a gable fill: its snap points are two boards
   crossing at (0, k) with ends at (±1, 0) and (±1, 2k). It is placed over the 2 m gable
   column across the ridge (odd wall half-span), crossing at the apex, with an info note.
   Ashwood has none, so that column is left open with a warning. Needs an in-game check.
4. **Grausten has no usable corner pieces.** Its two "corner" pieces are triangles with a
   2 m high edge at z = −0.5 and one low point at (±1, 1.5): a high edge and a low point,
   where a hip corner's halves have a high point and a low edge. They are no longer used:
   grausten hip corners, ridges and valleys stay open with warnings. Whether they make a
   valley (two mirrored halves) needs an in-game check.
5. **Roof tool shortcut is T** (F stays the wall tool's strip flip).
6. **Shed roofs have a low side** (`lowSide`: −x, +x, −z or +z; by default the long
   side's lower one), and get gable walls on their sides and a filler course on the high
   wall.
7. **A notch narrower than two eaves closes up** (the eave ring is the outline's L∞
   dilation) instead of clamping the eave; it gets an info note.
8. **Hip apex, ridge elbow and tee cells** have no matching game piece; a ridge piece is
   used with an info note ("2 hip apex cells…"). The note is info-level but shows in the
   bill of materials' Warnings list, as other info notes do.
9. **Support timing (after the fix round).** `roofContacts` is cached per roof (with its
   level's walls), declares only eave-on-wall (and filler) pairs, which an edge-only
   overlap can miss at 67°, and only looks at walls under the roof's eave ring; cells
   resting on each other are found by the overlap test. A 957-box scene with five roofs
   (Chrome, WebGPU): `computeSupport` 6–11 ms per commit, 8–11 ms after a roof edit;
   no long task (> 50 ms) while committing with the support view on.
10. **67° with a 1 m eave reaches the ground on 2 m walls** (the eave is 2 m below the
    wall top), so those eave pieces count as grounded. It's what the game would do too.
11. **Boxes mode**: roof corners, ridges and gable triangles are shapes drawn without the
    edge shader, from both sides; under the instance's non-uniform scale their normals
    are approximate, so their shading is slightly off. Slabs sit on the roof plane and
    shapes are lifted to meet their tops; the models use the cell geometry, unaffected.
12. **Not done (plan §12)**: cross-gables and dormers; optional 1 m log "starter"
    brackets in the bill of materials; grausten arched variants and inverted gable
    walls; adding the ridge beam and poles from the suggestion; roof cover % for
    stations and beds; roofs following wall edits and editing a roof outline by its
    vertices (Re-fit covers the common case).

## From M13 Stage 1

1. **Handedness: fixed in the fix round (below).** Stage 1 kept raw Unity axes, so imports
   showed the game mirrored like the rest of the planner; the checks that held then
   (neighbouring pieces stepping along their own axis, the off-grid roof pair, roofs
   meeting at their ridges) hold unchanged after the unmirror.
2. **Boxes mode:** raw roof pieces now take M12's roof shapes (fix round). Pieces that
   match nothing keep their collider's box.
3. **Pitch and roll**: raw pieces keep them; boxes tilt and roll, and models take the
   full turn (`PieceBox.modelTurn`). All 1,142 pieces of the real world were yaw-only.
4. **Levels of an import**: each piece gets the highest floor-top level at or below its
   bottom (floor tiles by their top), from levels with at least 2 tiles; roof-family
   pieces and gable walls go on one roof level (their lowest bottom, to 0.5 m). The real
   build: 0 / +3 (roof) / +4 / +5 / +7 / +8 m with 19 / 273 / 260 / 130 / 96 / 362
   pieces.
5. **Grid drift**: wall and floor pivots sit up to 2.7 cm off the 0.5 m lattice in the
   real build (the a0 note said ±2 cm for edges). The import puts the plan origin on the
   lattice's modal offset; c2 needs at least a 3 cm snap tolerance.
6. **The world cache** keeps the 6 most recently used reads, by key (folder name,
   generation, size and catalogue size), whatever the worlds are called. Without
   `createWritable` on the page (Safari) nothing is kept.
7. **Legacy `.db`** is read whole into the worker's memory (no `File.slice` refill), and
   only the synthetic v34 fixture exercised it; a real 300 MB+ `.db` is untested.
8. **Timings (headless Chrome 155, M4 Pro, 110,186 ZDOs / 1,142 pieces):** reading the
   world in the worker 42–75 ms (Node: 83–108 ms); reopening from the cache 3–13 ms;
   Import to the painted plan 0.6 s; 2D→3D (Boxes) 0.5 s on the first switch; a commit
   (turning a piece) to the second frame ~32 ms; support with the 1,140 raw pieces in
   it 12 ms.
9. **Not exercised:** the portal chunk and a real 2-byte section count (both in the
   synthetic fixture only), cloud `worlds/` and server save folders, the folder picker
   and upload-dialog paths (only drops), Safari and Firefox.
10. **Integrity shows "checking…" while it is scrolled off screen** (existing behaviour,
    support is only worked out when shown).
11. **Builder filter dropped** (privacy): creator IDs never leave the ZDO decoder, so
    there is nothing to filter by.

## From the M13 Stage 1 fix round

1. **The planner is no longer a mirror image of the game.** Unity is left-handed and the
   planner (three.js) right-handed; game data now enters mirrored in z, at three
   boundaries:
   - the catalogue, as it is parsed (`mirrorPiece`): snap points' z negated, collider
     z ranges swapped and negated. The extractor's output and `research/*.json` stay in
     Unity space (their goldens compare with UnityPy);
   - models, as they load (`mirrorGeometry`): positions, normals and tangents negate z,
     tangent w flips, triangle winding reverses. The OPFS cache keeps Unity data, so no
     cache version changed and nothing is extracted again;
   - world imports: a world point (x, z) is plan point (x, −z), so north is up in 2D.
     The game's yaw turns clockwise seen from above with north up, which is the plan's
     clockwise yaw: **plan yaw = game yaw − the build's grid yaw** (no sign flip). Pitch
     and roll mirror to three.js 'YXZ' (−pitch, −yaw, roll).
   - Planner code that assumed Unity's local axes follows: roof cells now have downhill
     on local −z (straight pieces, hip corners high at (−x, +z), valleys low at (+x, −z),
     the shapes mirrored to match, slabs tilt by −slope), and stairs climb along the side
     their snap points say (`PropDef.flight.towards`, +z in planner space) rather than a
     fixed −z, in the flight tool and the 2D glyph.
2. **Evidence on the user's world:** the L's arm now runs north from the east end of the
   main block, as on the game's map (north up, east right); before, it ran south. The
   golden test maps every imported pivot back through the import frame onto its world
   position (1,140 of 1,140), neighbouring pieces still step along their own axes (744
   along, 2 across), and the one off-grid roof pair still sits side by side along its
   eave, which a wrong yaw sign would turn across. In 3D the roofs meet at their ridges
   in Models and Boxes alike, and the default 3D view (from the south) agrees with 2D.
3. **What changes for existing plans:** positions don't (no migration). Walls, block-wall
   strips, floors, rooms, roofs, doors, poles and beams are symmetric and look the same;
   M12's roofs were checked at 26°, 45° (gable) and 67° (hip L) with `?modelBoxes`.
   Asymmetric pieces turn into their mirror: props whose collider is off-centre (a bed's
   footprint shifts 0.23 m), stairs (a flight now climbs the other way along its local
   z, so an existing flight's pieces sit as before but face the other way), door models
   (hinge side), stations. **Plans imported before the fix must be imported again**: their
   layout was computed mirrored.
4. **A stone-stair flight shows "would collapse"** for its upper pieces (exact −1…1
   colliders that only meet at an edge); wood stairs don't. Not checked whether this
   predates the unmirror.
5. **Raw pieces in support** hold up whatever rests on them as if grounded and aren't
   checked themselves (`SupportBody.fixed`): a wall drawn on an imported floor is held
   up; the Integrity list notes the raw pieces it left out.
6. **Diagonal raw beams** are thin boxes rolled up their rise; raw roof pieces with
   pitch or roll keep their collider box.

## From M15 implementation

1. **Tuned constants** (screenshots of the 1,140-piece import, WebGPU and `?webgl`,
   light and dark):
   - `CUT_ABOVE = 1` m and `PLATE_FROST = 0.4`, as planned. In the light theme a floor
     1 m under the plate reads pale but clearly there; in the dark one the frost is
     hardly visible, which is what the plan wanted (no murky models).
   - The plate's grid is the ground grid at **0.35** of its full 3D strength
     (`PLATE_GRID_STRENGTH`), not 1: at full strength, unfaded over the whole plate, it
     was the loudest thing in the dark theme.
   - **Deviation:** with the plate up, the ground grid keeps only its **10 m** lines at
     0.5 (the plan said 2 m and 10 m). Its 2 m lines, seen through the frost 1–8 m
     below, doubled the plate's grid with parallax.
   - Ghosts: slabs `--ghost` at 0.3; footprints no fill (props 0.08), dashed `4 3`,
     stroke opacity 0.6 (fix round: at 0.35 / 0.8 the dark theme's ghosts read close to
     the current level's grey stone).
2. **The previewed level is tinted in the selection colour** (neutral in the support
   view), at `HOVER_MIX`, as §3.1 says; §4 said accent. Accent over wood was hard to see
   in the light theme, and accent is already the current level's colour.
3. **The two corner tags** (the plate's and a previewed level's) sit at the lowest
   *visible* point of their outline (the plate corner nearest the viewer, or where an
   edge leaves the canvas, 72 px above its bottom for the 3D view bar): the nearest
   corner alone was often off-screen or under the bar. The plate's tag goes below that
   point and the preview's above it, since the two outlines' lowest points are close.
4. **Perf (the plan's §7.3, measured with a longtask observer and counting
   `linkProgram` / `createRenderPipeline*`):** the first cut made level steps cost
   70–150 ms in Boxes and create two WebGPU pipelines each time. Two causes:
   - The instanced box meshes of a shape (roof corners, gables) unmounted when the cut
     emptied them, and a new mesh is a new pipeline (`RenderObject` keys an
     `InstancedMesh` by its uuid). `PieceInstances` and `ModelInstances` now take the
     uncut boxes (`retain` / `retainBoxes`) for which meshes exist and how big they are,
     and draw the cut ones; an emptied mesh stays mounted.
   - Meshes only on hidden levels linked their program on the first step that showed
     them (87–97 ms on `?webgl` for models; 609 ms for box shapes when 3D opened at 0 and
     stepped to +3, found in the fix round). An empty instanced or model mesh now isn't
     frustum-culled, so it draws zero instances and links with the rest on entry. The
     plate, the preview outline and the drop line are collapsed to scale 0 rather than
     hidden (`Collapsed`), for the same reason.

   After: on the import, PageUp ×5 + PageDown ×5, C ×4 and two sweeps over all six rows,
   in Boxes and Models, on WebGPU and `?webgl`, and the first steps up from 0 after
   opening 3D: **no long task** (none over 50 ms), and **no new programs or pipelines**
   (switching Boxes ↔ Models still relinks, as before M15). Headless Chrome 155, M4 Pro.
5. **Where things landed:** the pure plate rectangle is `scene/view3d/plateRect.ts`, not
   `levelPlate.ts`: on a case-insensitive disk it clashed with `LevelPlate.tsx`. The 3D
   grid strengths (`strength3d`) moved to `scene/grid/gridLevels.ts`, so `Ground.tsx`
   exports only its component (Fast Refresh). Likewise the line objects shared by
   `PlaneLines` and `DropLine3d` are `lineObjects.ts`, the cursor marks
   `cursorShapes.ts` and `footprintStyle` its own module. Footprint and ghost styles
   moved to `overlay/Footprints.module.css` (their `.ghostLevel` descendant rules need
   one module); `Overlay.module.css` is still 422 lines (436 before M15) with no other
   natural seam. The 3D view and Pick share `getShownBoxes` (`planHooks.ts`): with
   roofs hidden, Pick now hits gable fills and filler courses, as drawn.
6. **Import landing level (fix round).** An import used to start on the level holding
   the most pieces (+8 here, a loft). With the cut on, that hid the main floor, and
   level 0 holds only 19 stray poles and beams (the import's datum is its lowest piece;
   the floor and walls start about 4 m up). It now starts on the **lowest level holding
   at least 10 % of the build's pieces besides roofs** (`LANDING_SHARE`,
   `importCluster.ts`): +4 on the import, its main floor, with the roof (level +3,
   from 3.8 m) cut down to its eaves below 5 m. A reload still starts at 0, as before.
7. **A hand-built two-storey plan** (stone walls at 0, a wood floor and wood walls at +2,
   a gable roof on them): at 0 the floor and roof are hidden; at +2 the stone walls are
   frosted under the plate and the roof, on the current level, is whole. A roof can't
   be stored at +4 with nothing under it (`base` must be above 0), so "a roof at +4"
   wasn't tried.
8. **Pick in 3D** uses the drawn boxes: at +4 on the import, Pick over the house goes to
   4 with the cut on (the floor) and to 15 with it off (the roof).
9. **Levels bar (fix round):** a previewed row is also cleared when it disappears (an
   undo while the pointer rests on it); the selection dot has screen-reader text.
10. **Not exercised:** 2D slab ghosts (`GhostMeshes`) on a hand-built plan in the
   screenshots (the import is all raw pieces, whose ghosts are SVG), Safari, Firefox, a
   headed window. In headless Chrome, opening a *remembered* world (World panel →
   Open), or dropping a world again in a profile that remembers one, hangs the page
   (likely the folder permission prompt); a fresh profile works. Not an M15 change.
11. From the plan's out-of-scope list, still open: a 2D preview of the hovered level, an
    adjustable cut height and a clip-plane cut with caps, hiding whole lower-level items,
    level names, a "y" readout, a camera-following walls cut-away.

## From the M15 QA follow-ups (roof models, raw roofs and the Roofs toggle)

1. **The "roof model floats above its walls" case is not a model or pivot bug.** In the
   QA's hand-built house, the roof was drawn on level +4 (the wall tops of the +2
   storey). The roof tool only looks at walls on the work level, found none, and gave the
   roof the 2 m default base, so its eave sat at 6 m on walls that top out at 4 m. Boxes
   were 2 m up too (Integrity: "37 pieces would collapse … edges don't rest on a wall").
   The QA's Boxes shot was taken from high above, so the gap didn't show. With the roof
   on +2 (base 2), Models and Boxes both sit on the walls. Measured pivots: the eave
   snap line is at 3.5 m, 0.5 m below the 4 m wall top, which is right for a 1 m eave
   at 26°. Not fixed: when no walls on the work level are under the outline, the roof
   tool could seat the roof on lower walls whose tops reach the work level (their
   elevation, base = their height), because `base` must stay above 0.
2. **Imported roof covers follow the Roofs toggle** (`isRawRoofCover`, `rawBoxes.ts`).
   This covers a roof family's straight, ridge and corner pieces at any tilt. In 3D they
   are dropped with derived roof covers (`roofCover`), so the 3D view and 3D Pick agree
   through `getShownBoxes`. In 2D their outlines are hidden and tools can't pick them
   (`levelView`). The Roofs button now also shows for a plan with only imported roofs;
   before, a pure import had no button at all. Gable walls stay shown, as they do for
   derived roofs, and that includes the Roof Cross (`wood_wall_roof_top*`, listed as
   "Wood Roof Cross"). So an import with roofs hidden keeps its crosses at the gable
   apexes.

## From M16 Stage 1 pass 1A (world generator port)

1. **The TS generator is bit-identical to `worldGen.py`.** `src/gameData/valheim/terrain/`
   ports it scalar and line by line, with `Math.fround` only where the Python rounds. On the
   two synthetic golden seeds every Perlin and Random value, biome, base height and
   `GetHeight` matches exactly (max error < 5e-7 m, which is the JSON's 9-digit rounding),
   as do the lake, river, stream and Deep North stream counts, hashes, render states and
   rendered cell entries. On the user's world (scratch check, not committed): pregeneration
   gives 119 / 157 / 2 037 with the same hashes and the same 696 646 cell entries as the
   Python. Locations: 9 402 checked (2 763 Ashlands / Deep North skipped), max error
   1.16 mm. Vegetation over 200 zones gives the same aggregates as `validateTerrain.py`
   (> 30 m from a location: 15 758 objects, max 7.7 cm, 100 % < 0.1 m). No bug was found in
   `worldGen.py`. It doesn't keep the Deep North streams, so `terrainGoldens.py` captures
   every pass through a hook on `_render`.
2. **Perf (Node 25, M-series):**
   - pregeneration without the Deep North pass takes ~0.28 s, and ~0.47 s with it
     (Python: ~90 s);
   - a 257 × 257 patch takes 80–260 ms (mountains cost most: tilt needs 4 extra base
     heights);
   - locations: 9 402 `GetHeight` calls in 25 ms.
3. **The river cache is larger than planned:** ~71 KB without the Deep North streams, and
   134 KB with them (§8.1 estimated 80–100 KB). `encodePregenerated` stores all 8 float32
   fields of each definition.
4. **API notes for pass 2.**
   - `pregenerate(gen, {deepNorth})` fills `gen.rivers`.
   - `withDeepNorth(gen, pre)` adds the skipped pass later, with a full re-render first,
     because the Deep North pass reads the rendered rivers and streams.
   - `restoreRivers(gen, pre, patchRiverCells(rect))` restores only the patch's cells. A
     patch built that way is equal to one built after a full render (tested).
   - The `DEEP_NORTH_MARGIN` decision is left to the terrain worker.
   - `getHeight` / `biomeHeight` give NaN for Ashlands and Deep North, so a patch whose
     zone corners (`patchCorners`) include them must be refused before `buildPatch`.
   - `decodeTerrainComp` accepts only data version 1; other versions throw `unsupported`.
     It keeps `level + smooth` as one float32 delta.
   - `applyTerrainComps` works in place and returns the number of vertices it changed.
5. **Goldens:** `research/terrainGoldens.json` (32 KB) is regenerated by
   `research/extract/world/terrainGoldens.py`, in ~3–4 min (two full Python
   pregenerations). The unit tests run both seeds, including the Deep North pass. On a
   quiet machine the terrain tests take ~4 s wall time.

## From M16 Stage 1 pass 1B (reader, site model, ground contact, contours)

1. **`GROUND_REACH = 0.15` m, from the IL** (research §8, "Ground contact").
   `WearNTear.SetupColliders` grows every collider's test box by 0.3 m in total per axis
   (0.15 m a side); `UpdateSupport` overlaps those boxes, and a hit on the `terrain`
   layer grounds the piece (a hit on a collider with no `WearNTear`, a rock or tree,
   gives full support at once). So a body rests on the ground when
   `bottom ≤ ground + 0.15`, where `ground` is the highest terrain under its footprint
   polygon (`groundUnder`). This replaces M11's flat `GROUND_HEIGHT = 0.05`: on flat
   ground a body with its bottom up to 0.15 m (was 0.05) now counts as grounded. No M11
   test sat on that boundary. **Not modelled:** the box also grows 0.15 m sideways, so on
   a slope the game also counts ground just beside the footprint (≤ slope × 0.15 m).
2. **Legacy terrain edits are not converted on load** (correcting M16 §2.4 (b) and the
   §8.1 notice text). `Heightmap.ApplyModifiers` still applies every pre-1.0 player
   `TerrainModifier` live; only the console command **`optterrain`** folds them into
   `TerrainComp`. The notice should say "run `optterrain` in the game's console", not
   "open the world once". Eight such prefabs exist; the reader counts the six that change
   height (`raise`, `digg`, `digg_v2`, `cultivate`, `mud_road`, `paved_road`; `path` and
   `replant` only paint).
3. **Plan format v5.** `ImportFrame.terrain: SiteTerrain | null` (the §8.2 shape;
   `SiteNotices` named). Heights are base64 of int16 little-endian centimetres;
   `encodeHeights` clamps beyond ±327.67 m and counts what it clamped. `parsePlan` reads
   1–5 (a v4 frame gets `terrain: null`) and checks whole-metre `x0`/`z0`, sides 2–385,
   the base64 length (without decoding), the biome grid and the notices
   (`terrain/siteCheck.ts`, shared with the command). `site.setTerrain` needs an import
   frame; its default label is "Set terrain", so callers name the gesture ("Add
   terrain"). `terrainGrid` decodes once per terrain object (WeakMap).
4. **Reader.** `readChunkedWorld` is now async (the `.db2` gunzip), and so is the world
   worker; every typed array is transferred. A `.db2` that doesn't parse gives
   `locations: null` and the pieces still import (it only feeds the self-check). A legacy
   `.db` has `site: null` and `locations: null`; its terrain comps and legacy edits are
   still collected. `.fwl2` reading stops at `worldGenVersion`; the fixture ends the
   file in bytes no reader could parse, so a read past it would fail the test. The real
   world (`test:world`): 3 terrain comps, 0 legacy edits, 12,165 locations, generator 2.
5. **World cache.** The binary layout moved to `install/worldCodec.ts` with
   `WORLD_FORMAT = 2` (section sizes in the JSON header; every section sliced, so none is
   aligned). Index entries carry `format`; older entries drop out of the "kept" list and
   their files are cleaned on the next save. The signature gains `|site1`.
6. **River cache layout (deviation, for 2A):** one folder per world,
   `valheimTerrain/<riverCacheName(site)>/` (a hash of `rivers|seed|worldGenVersion`),
   with a file per `GENERATOR_REVISION` inside. Forget removes the folder without
   needing the revision. `RIVER_CACHE_ROOT` and `riverCacheName` are exported from
   `worldCache.ts`; the "6 kept" rule then counts folders.
7. **Contours are marching triangles** on the collider's own triangles (each quad split
   along (x + 1, z)–(x, z + 1)), not marching squares: exact for the drawn ground and
   no saddle cases. `contourSegments(grid, step, except)` returns world-coordinate
   segments (float32, ~1 mm at 10 km) and leaves out the multiples of `except`, so the
   0.5 / 1 / 5 m sets don't double up. A level through a vertex counts that vertex as
   above, so a line along a shared edge is drawn once.
8. **Hillshade light** comes from the plan's screen upper left (plan (−1, −1)), turned
   into world axes through the frame (yaw, then the z mirror), not from world
   north-west: relief then reads the usual way round at any import yaw. Output is
   `[shade, water]` bytes per vertex; water is world y < 30 m (`SEA_LEVEL`).
9. **Support wiring.** `SupportShape.footprint` (box corners, or the hull of a tilted
   box's corners), `SupportBody.ground`, `planSupport(…, groundUnder)`;
   `computeSupport` passes the site's ground whether the Terrain toggle is on or not
   (`getSiteGround`), and uses 0 off the patch. Raw pieces stay fixed and now report
   `'grounded'` (blue) when they touch the ground; the Integrity note says so.
   `useSiteTerrain()` is the plan's ground, `useShownSiteTerrain()` the one the views
   draw (null with the toggle off).
10. **Patch size:** `MIN_SIDE` (128) equals 2 × `SITE_MARGIN`, so the minimum never binds;
    `patchRect` takes plan bounds (pass the build's box bounds, not `planBounds` with an
    underlay).
11. **Side notes from the IL, not modelled:** the support distance is the smaller of
    COM-to-COM and COM-to-the-other-pivot (each + 0.1 m) unless a piece forces the COM
    form.

## From M16 Stage 1 pass 2A (terrain pipeline, import UX)

1. **Pipeline.** `install/terrainJob.ts` is the worker's job as a plain function (the
   gated test runs it in Node): the biome gate, the rivers (kept, pregenerated, or the
   Deep North pass added), the patch, the save's comps, the self-check.
   `terrain.worker.ts` / `terrainClient.ts` run it in one worker per request (an
   `AbortSignal` terminates it). `siteGeneration.ts` picks the job's inputs (the comps of
   the patch's zones, the locations within `CHECK_RADIUS`) and turns the result into a
   `SiteTerrain` (plan heights, notices). `terrainCache.ts` keeps the rivers per
   `riverCacheName` folder as `r<GENERATOR_REVISION>.bin`, with its own `index.json` for
   the 6 most recently used worlds; `GENERATOR_REVISION = 1` lives there.
2. **`DEEP_NORTH_MARGIN` (600 m) decision:** the Deep North pass runs when any point of
   the patch grown by the margin, sampled every 50 m, is Deep North. Without that pass the
   self-check also leaves out locations within the margin of the Deep North, since their
   rivers would be missing. A warm restore renders the cells of the patch **and** of the
   check locations.
3. **Timings.** Headless Chrome 155 (M4 Pro), the 190 × 200 site: cold (no river cache)
   **281 ms** for the whole request, of which pregeneration 243 ms; warm **75 ms**
   (restore 28 ms, patch 21 ms, comps 3 ms, check 1 ms). Each request leaves a
   `performance.measure('terrain')` with the phases in `detail`. In Node (vitest) the same
   job is slower: cold 1.26 s, warm 154 ms. The only request during an import is the
   worker's own script (same origin).
4. **`test:world`** now also runs `terrain/realTerrain.test.ts`: 119 / 157 / 2 037 with the
   Python reference's lake, river and stream hashes; locations 9 402 of 12 165 checked,
   max 1.16 mm; vegetation in every 4th zone without comps (168 zones), > 30 m from a
   location: 12 848 objects, max 0.19 mm; the site's self-check 605 locations, max 0.46 mm;
   1 584 vertices changed by comps.
5. **Floors on the composed ground:** 237 floor tiles (221 `wood_floor`, 16 1×1), 122
   grounded. At every tile's centre its top is ≥ 0.098 m above the ground. Over the whole
   footprint, 4 tiles at the pad's edge have the ground rising up to 0.155 m above their
   top along an edge (the hillside meets them), so a few centimetres of ground may poke
   through there in 3D. The test asserts the centre (as the spike's pivot check did).
6. **UX.**
   - The World panel's import row: **Import as a new plan** with **With terrain** (on by
     default; disabled with "No terrain: …" for an old `.db`, another generator version,
     or Ashlands / Deep North under the site). The confirm comes first; then "Generating
     terrain… rivers (first time for this world)" (or ground, your terrain edits,
     checking) with **Skip terrain**, which imports without it. Still one
     `plan.replace` ("Import from …"). A failure to make the ground leaves the plan as it
     was and says why; unticking imports without.
   - **Terrain…** in the status strip for an import frame without terrain opens the
     panel; the panel's start says which world to open, and an open world that matches
     (name, a piece within 100 m of `origin`) shows the banner **Add terrain to the
     current plan** (one undoable "Add terrain", Cancel while it runs). There is no
     "Remove terrain" button; undo covers it.
   - The **Terrain** toggle (beside Roofs and Underlay) carries "!" when there are
     notices; its title lists them. The legacy-edit notice says the game still applies
     them live and to run `optterrain` (Findings 1B, 2). On the import, 8 locations are
     within 32 m of the patch (one notice).
   - The readout "ground +3.8 m" (plan height, 0.1 m) sits beside the cursor
     coordinates while terrain is shown, "ground —" off the patch.
   - The World panel's privacy note now says the browser keeps the seed, terrain edits and
     locations, and a plan the ground but never the seed.
7. **E2E (headless, fresh profile, port 5237):** cold import with terrain, a second
   import hitting the river cache, Undo / Redo of the import, reload (the autosave holds
   the terrain, ~276 KB), Skip during the rivers phase (imports without, then
   **Terrain…** → Add terrain → Undo / Redo). The saved-file round trip is covered by
   `parsePlan(serializePlan(plan))` in `test:world`, not clicked through File → Open.
8. **Not done:** int16 clamping beyond ±327.67 m has no notice field in `SiteNotices`, so
   it clamps silently (impossible within a 384 m patch in practice).
9. **Fix round.**
   - A zone whose terrain edits don't read (another data version, a damaged blob) is
     left out and counted (`decodeComps`) in the new `SiteNotices.unreadEdits`, listed by
     the Terrain toggle; the rest of the site still comes in. v5 plans saved before the
     field read it as 0.
   - Import and Add terrain exclude each other: the store runs one request at a time
     (the shared token is gone), and the panel shares one task, so the other button is
     disabled while one runs (checked in the browser).
   - `siteTerrainProblem` wants at least 2 × 2 biome corners that span the patch.
   - **Off-patch ground for support: the patch's nearest edge, carried on flat**
     (`groundUnderOrEdge`), not "not grounded" and no longer the datum. The patch reaches
     at least 64 m past the build, so off-patch pieces are hand-drawn far out. The datum
     is the build's lowest piece, which can sit metres above or below the ground there,
     and "never grounded" would collapse anything drawn there for no visible reason. The
     edge height keeps the ground continuous across the patch border, so a wall straddling
     it behaves the same on both sides. Drawing (3D, drop line) is unchanged.
   - `MISMATCH` moved to `model/terrain/siteCheck.ts`; the river-cache index updates are
     serialised through a promise chain; the legacy-edit notice says "import the build
     again".

## From M16 Stage 1 pass 2B (terrain rendering)

1. **Where things landed.** 3D: `scene/view3d/terrainGeometry.ts` (surface, skirt, sea
   quad), `terrainColors.ts` (biome tints blended between zone corners with the
   heightmap's smoothstep weights, rock from 40° to 55°, sand from 0.5 m above to 1 m
   under the sea), `Terrain3d.tsx`, `useGroundGrid.ts` (shared with `Ground`),
   `siteBounds.ts` (`withGround`, `siteReach`). `usePlateShown` (in `useLevelShading.ts`)
   is the one rule for "plate drawn": off the ground, or at any level over shown terrain.
   2D: `scene/Terrain2d.tsx` under `GridPlane`, `overlay/SiteMarks.tsx` mounted inside
   `Overlay` (the 2D overlay only; under every other world-layer mark). Tokens
   `--terrain-shade`, `--terrain-light`, `--contour`, `--water` → `ThemeTokens.terrain`.
2. **Deviations from §8.1.**
   - **The draped grid is always the coarse one** (10 m lines only), also at datum 0: with
     terrain the plate is drawn at every level, so the ground is never the work plane, and
     a full draped grid would cross the plate's grid wherever the ground passed through 0.
     Draped, it is also at 0.6 of the flat ground's strength (`DRAPED_STRENGTH`): the dark
     theme's light lines were loud on lit green ground.
   - `MeshLambertNodeMaterial` (as the pieces), not Standard.
   - Normals come from the height grid (central differences, as `hillshade`), turned into
     the plan, not `computeVertexNormals`; positions use the frame's affine map. The
     surface arrays are cached per site (`WeakMap`), so re-entering 3D only uploads them.
     A 385 × 377 patch builds in ~30 ms cold (it was ~45 ms plus a 15 ms normal pass).
   - The sea's colour in 3D is `--water` too (one token for both views).
   - `OrbitRig` takes `reach` (the patch diagonal), so the depth planes hold the whole
     patch when zoomed in on the build; the fit and the sun use the plan bounds grown to
     the ground's height range under them.
3. **Constants after the real-world pass:** `SKIRT = 4` m; skirt earth `#8a7058` (darker
   read as a black slab on the side away from the sun); water opacity 0.55; draped grid
   polygon offset (−1, −4) on both backends, no z-fighting seen and floors still cover it;
   no terrain shadow acne at the M14 `normalBias 0.03`, so nothing was changed there. 2D:
   relief at y −0.3 (under the −0.2 ghosts), water mixed at 0.6, contours 0.5 / 1 / 5 m
   from 12 / 3 / 0 px/m at 0.25 / 0.45 / 0.7 as planned. Theme: dark shade `#1a1b1e` →
   light `#4b4f55`, contour `#a89470`, water `#3d6f9a`; light `#a3a9b0` → `#f4f6f8`,
   `#7a5a32`, `#6fa3cf`.
4. **Perf** (headless Chrome 155, M4 Pro, the import with terrain; longtask observer plus
   counting `linkProgram` / `createRenderPipeline*`): PageUp/PageDown ×6, C ×4 and two
   sweeps over all six Levels rows, in Boxes and Models, on WebGPU and `?webgl`: **no long
   task and no new programs or pipelines.** Entering 3D on WebGPU: Boxes no long task,
   Models ~130–150 ms with or without terrain (the models' own cost). On a synthetic
   385 × 377 patch, WebGPU entering 3D was 142 ms before the cache and grid normals, then
   0–70 ms. `?webgl` entering 3D is 300–650 ms with or without terrain (program linking
   dominates; the run-to-run spread is larger than any terrain cost).
5. **The 4 edge floor tiles** with the hillside up to 0.155 m above their top (2A, 5): not
   visible at normal zoom, top-down or low; at most a sliver of green at a tile's outer
   edge. Acceptable.
6. **Level 0 on the import** shows mostly ground: the pad is ~4 m above the datum, so with
   the cut on the build is cut away and the plate at 0 is underground except near the
   water. Expected, and the landing level is +4 anyway.
7. **Open:** the opaque 2D relief hides an underlay under the patch. Ground outside the
   shadow camera's plan bounds is unshadowed, as planned. (The plate tag at 0 and the
   camera inside hills were fixed in the fix round, item 9.)
8. **Synthetic site** for work before the import existed: a scratchpad script built a v5
   plan from pass 1's generator with a made-up seed (not committed).
9. **Fix round.**
   - **Camera above the terrain:** `OrbitRig` takes the shown site (`ground`) and keeps
     the camera 0.5 m (`TERRAIN_CLEARANCE`) above the collider height under it, after
     every move (orbit, pan, zoom to the cursor, push-through); off the patch, or without
     terrain, the old y = 0.05 floor. The push-through levels out when the target would
     go under the ground ahead rather than under y = 0. Checked on the import with a low
     orbit all round the pad and wheel pushes towards the western hill: the camera stays
     on the hillside's surface, never inside it. The orbit target itself is not moved
     onto the ground (at level 0 it can sit under the pad; orbiting around it still works).
   - **The plate tag at 0:** `LevelTags3d` uses `usePlateShown`, so "0 m" shows at the
     plate's corner and the cursor at level 0 over terrain.
   - **Dev-only WebGPU validation errors** ("Buffer used in submit while destroyed",
     two per frame in 3D on the import): StrictMode's simulated unmount ran the
     `useEffect` cleanups that disposed `PieceInstances`' meshes (an M15 pattern, seen
     here by chance of timing) and the terrain's geometries, which stayed in use.
     `scene/useRelease.ts` counts holders and frees a resource a microtask after its
     last holder unmounts, so the immediate remount keeps it. It is used by
     `PieceInstances`, `Terrain3d` and `Terrain2d`. Other dispose-on-cleanup sites
     (lines, slabs, models) showed no errors and were left alone. Production builds
     have no StrictMode double mount.
