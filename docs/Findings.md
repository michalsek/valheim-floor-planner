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
