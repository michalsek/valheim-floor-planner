# Valheim Floor Planner

A 2D top-down planner for Valheim builds, with a 3D view of the same plan. Every piece size, snap rule, cost and build radius comes from the game's own files, so a plan here matches what you can build in the game.

The planner needs your own Valheim install. On first visit it asks for the game folder (Steam's `steamapps/common/Valheim`; pick it, or drag it onto the page from Finder or Explorer) and reads the building pieces from it in a Web Worker, in a few seconds. Nothing is uploaded. The result is cached in the browser (IndexedDB), so later visits open the editor at once; the status-strip menu (`398 pieces · Unity …`) re-scans after a game update or switches to another install. Chrome and Edge remember the folder; other browsers use an upload-style folder dialog and can reuse the cached catalogue.

```bash
pnpm install
pnpm dev            # http://localhost:5173  (append ?webgl to force the WebGL2 fallback)
pnpm verify         # typecheck, lint, tests, build
pnpm test:install   # parses the local Steam install and compares it with research/*.json
                    # (VALHEIM_DIR=/path/to/Valheim to point elsewhere)
VALHEIM_WORLD_TEST=/path/to/world pnpm test:world
                    # reads a real 1.0 world folder (golden numbers of the author's world)
```

## Tools

| Key | Tool                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| V   | Select: click, Shift+click, box select, move, corner drag, arrow keys to nudge, Delete, Mod+D, Mod+A, R to rotate items                               |
| W   | Wall: click to add corners, Enter or double-click to finish, click the start point to close the loop, F to flip which side a stone wall's strip is on |
| B   | Floor: drag a rectangle                                                                                                                               |
| T   | Roof: click a room, Shift+click for its whole building, or drag a rectangle; family, pitch, kind, ridge, overhangs and gable walls in the bar         |
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

## Roofs

The roof tool covers a room, a building or a dragged rectangle with the game's roof pieces: thatch or darkwood shingle at 26°, 45° or 67°, and grausten at 45°. Gable and shed roofs need a rectangle (a shed slopes down to the side you pick); any other shape gets a hip roof, with hip corners at its outer corners and valley pieces where it turns. The roof plane passes through the wall tops, so with the default 1 m eave the roof reaches 1 m past the walls and k m below their top (0.5 m at 26°, 1 m at 45°), and a 1 m gable overhang carries it past the ends; the walls hold it at their top edge. Gable ends (and a shed's sides) can be filled with triangle walls. Where the roof passes above a wall it should rest on (the far wall of an odd span, whose eave grew 1 m to keep whole pieces, or a shed's high wall), the wall is raised to it with a filler course (log beams, half or full walls), counted like the rest. Grausten has no ridge, hip corner or valley pieces, so those cells stay open with a warning. Every piece counts in the bill of materials and in support, and a span too wide for wood shows where it would break (a ridge beam on log poles holds it). 2D draws each roof's eave line, ridges, hips, valleys and an arrow down each slope; the Roofs toggle in the status strip hides them in both views, to see and pick inside. Roofs don't follow wall edits: the Inspector's Re-fit reads the room again.

## 3D view

Press 3 (or use 2D / 3D in the status strip) to see the plan in 3D: walls by course, floors at their real thickness, doors and gates as see-through panels, and items as their collider boxes, every level at its height (the ones you aren't on faded). Every tool except the underlay works in 3D too, on the current level's plane: the same clicks, drags, snapping, Alt, keys and undo as in 2D, with ghost pieces and lines showing what a click would build. Pointing at a wall's face puts an opening on that wall, and selecting picks the piece you see. The underlay tool goes back to 2D.

- Left click and drag use the active tool.
- Right drag orbits.
- Middle drag, Shift/Ctrl/⌘ + right drag, or Space + drag pans along the ground.
- The wheel zooms towards the cursor; + and − move the camera in and out.
- Home or Shift+1 fits the plan; 0 resets the view direction.
- Boxes / Models in the status strip swaps the boxes for the game's own meshes and textures, read from your install the first time each piece is shown ("Loading models 12/20"). Selection, hover, support colours and the level fading tint them; picking still uses the boxes. If the models need the game files and the browser no longer has them (an install opened by dragging the folder in, or the saved catalogue), the strip says "Drop your Valheim folder here to load models": drop it on the view and they load without a reload. With a remembered folder, "Reconnect folder" asks for access again. Pieces without a model stay boxes; door and gate models are drawn solid.

## Importing from a world save

World… in the status strip finds your builds in a Valheim world save and imports one as a new plan. Drop a world's folder (`_main.N.fwl2`, `.chunks` and `.chunk` files), a whole `worlds_local` / `worlds` folder, or an old `.db` onto the panel; on macOS they are in `~/Library/Application Support/IronGate/Valheim/worlds_local/` (Steam Cloud: `~/Library/Application Support/Steam/userdata/<id>/892970/remote/worlds/`), which Chrome's folder dialog refuses, so drag them from Finder. The save is read in a Web Worker and never changed or uploaded; only the built pieces (prefab, position, rotation) are kept, in this browser, until Forget. Player IDs and the world's player list are never read.

The panel shows the builds on a map (north up, as in the game) with their size, material and grid direction; builds under 5 pieces are hidden (adjustable). Import turns the build onto its own grid, puts its corner at the origin and its lowest piece at 0, and gives each piece the level of the floor it stands on (roof pieces and gable walls share a roof level). The pieces come in as raw pieces: drawn as their outline from above (roofs outlined only) in 2D and as boxes (roof pieces as M12's roof shapes) or the game models in 3D, counted in the bill of materials, and movable, turnable (R) and deletable, but not reshaped into walls or floors yet. Support isn't checked for them; they hold up what you build on them. A world folder dropped anywhere on the planner opens the World panel with it.

The planner shows the game the right way round: north (+z in the game) is up in 2D, and a build looks in the planner as it does in the game. (Before M13's fix round it showed a mirror image.) Plans saved earlier keep their positions; symmetric pieces look the same, while asymmetric ones (stairs, beds, stations, door models) show as their mirror, so turn them if they matter. Plans imported from a world before then should be imported again.

## Docs

- `research/README.md`: what we know about the game, plus the extracted data (`valheim-pieces.json`, `valheim-items.json`) and the UnityPy scripts that extract it (`research/extract/`). The app parses the install itself (`src/gameData/`); the JSON is now the fixture for tests.
- `docs/Roadmap.md`: the stack, the architecture and the milestones. Each milestone has a plan in `docs/plans/` (M1–M11; `docs/RoadmapV2.md` covers M8 onwards).
- `docs/Findings.md`: known issues and follow-ups that agents logged while building it.
