# Valheim Floor Planner

A 2D top-down planner for Valheim builds, with a 3D view of the same plan. Every piece size, snap rule, cost and build radius comes from the game's own files, so a plan here matches what you can build in the game.

The planner needs your own Valheim install. On first visit it asks for the game folder (Steam's `steamapps/common/Valheim`; pick it, or drag it onto the page from Finder or Explorer) and reads the building pieces from it in a Web Worker, in a few seconds. Nothing is uploaded. The result is cached in the browser (IndexedDB), so later visits open the editor at once; the status-strip menu (`398 pieces · Unity …`) re-scans after a game update or switches to another install. Chrome and Edge remember the folder; other browsers use an upload-style folder dialog and can reuse the cached catalogue.

```bash
pnpm install
pnpm dev            # http://localhost:5173  (append ?webgl to force the WebGL2 fallback)
pnpm verify         # typecheck, lint, tests, build
pnpm test:install   # parses the local Steam install and compares it with research/*.json
                    # (VALHEIM_DIR=/path/to/Valheim to point elsewhere)
```

## Tools

| Key | Tool                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| V   | Select: click, Shift+click, box select, move, corner drag, arrow keys to nudge, Delete, Mod+D, Mod+A, R to rotate items                               |
| W   | Wall: click to add corners, Enter or double-click to finish, click the start point to close the loop, F to flip which side a stone wall's strip is on |
| B   | Floor: drag a rectangle                                                                                                                               |
| O   | Door or gate, placed on a wall                                                                                                                        |
| P   | Item: furniture, stations, stairs, poles and beams from the catalogue, with EN/PL search; R / Shift+R rotate; stairs place a whole flight up a rise   |
| D   | Dimension (Enter in the ruler pins the measurement)                                                                                                   |
| M   | Ruler                                                                                                                                                 |
| U   | Underlay: load a reference image, calibrate its scale, set its opacity                                                                                |

Other keys:

- Space+drag or middle-drag pans.
- The wheel zooms.
- Home or Shift+1 fits the plan to the view.
- G cycles the snap step.
- Alt turns snapping off.
- Mod+Z / Mod+Shift+Z undo and redo.
- Mod+S / Mod+O save and open a `.valheimplan.json` file.

## Levels and support

Every wall, floor, item and dimension stands at its own elevation, and the levels are simply the elevations in use. You always work on one level: the Levels bar at the canvas edge lists them ("+2 m · 41"), and new objects go on the current one. 2D shows that level with the one below faintly under it; tools and Mod+A only see the current level; rooms and the bill of materials (This level / All) are per level.

- PageUp / PageDown step the level (1 m, or 0.5 m for grausten floors); Shift jumps to the next level with something on it.
- Mod+PageUp / PageDown move the selection a step, and the level follows (Mod+Shift: everything from this level up). The Inspector has an Elevation field too.
- Tops goes up to the highest wall top on this level (where the next floor goes); Pick, then a click on a piece, goes to its top.
- Support colours every piece by the game's structural support: blue on the ground, green to red as it weakens, magenta where it would collapse. The bill of materials lists what would collapse.

## 3D view

Press 3 (or use 2D / 3D in the status strip) to see the plan in 3D: walls by course, floors at their real thickness, doors and gates as see-through panels, and items as their collider boxes, every level at its height (the ones you aren't on faded). Every tool except the underlay works in 3D too, on the current level's plane: the same clicks, drags, snapping, Alt, keys and undo as in 2D, with ghost pieces and lines showing what a click would build. Pointing at a wall's face puts an opening on that wall, and selecting picks the piece you see. The underlay tool goes back to 2D.

- Left click and drag use the active tool.
- Right drag orbits.
- Middle drag, Shift/Ctrl/⌘ + right drag, or Space + drag pans along the ground.
- The wheel zooms towards the cursor; + and − move the camera in and out.
- Home or Shift+1 fits the plan; 0 resets the view direction.
- Boxes / Models in the status strip swaps the boxes for the game's own meshes and textures, read from your install the first time each piece is shown ("Loading models 12/20"). Selection, hover, support colours and the level fading tint them; picking still uses the boxes. If the browser lost access to the folder, "Reconnect folder" asks for it again; pieces without a model stay boxes.

## Docs

- `research/README.md`: what we know about the game, plus the extracted data (`valheim-pieces.json`, `valheim-items.json`) and the UnityPy scripts that extract it (`research/extract/`). The app parses the install itself (`src/gameData/`); the JSON is now the fixture for tests.
- `docs/Roadmap.md`: the stack, the architecture and the milestones. Each milestone has a plan in `docs/plans/` (M1–M11; `docs/RoadmapV2.md` covers M8 onwards).
- `docs/Findings.md`: known issues and follow-ups that agents logged while building it.
