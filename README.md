# Valheim Floor Planner

A browser tool for prototyping Valheim buildings before you build them in the game: a 2D top-down planner with a 3D view of the same plan. Every piece size, snap rule, cost and build radius comes from the game's own files, so a plan here matches what you can build in the game.

An unofficial fan project, not affiliated with or endorsed by Iron Gate or Coffee Stain. No game data is shipped: it is all parsed in your browser from your own install.

The planner needs your own Valheim install. On first visit it asks for the game folder (Steam's `steamapps/common/Valheim`; pick it, or drag it onto the page from Finder or Explorer) and reads the building pieces from it in a Web Worker, in a few seconds. Nothing is uploaded. The result is cached in the browser (IndexedDB), so later visits open the editor at once; the status-strip menu (`398 pieces · Unity …`) re-scans after a game update or switches to another install. Chrome and Edge remember the folder; other browsers use an upload-style folder dialog and can reuse the cached catalogue.

```bash
pnpm install
pnpm dev            # http://localhost:5173  (append ?webgl to force the WebGL2 fallback)
pnpm verify         # typecheck, lint, tests, build
pnpm test:install   # parses the local Steam install and compares it with the fixtures
                    # (VALHEIM_DIR=/path/to/Valheim to point elsewhere)
VALHEIM_WORLD_TEST=/path/to/world pnpm test:world
                    # reads a real 1.0 world folder (golden numbers of the author's world)
```

Some test suites compare against data extracted from the game (`valheim-*.json`), which isn't published: they read it from `private/research/` (the author's private repo) and are skipped, with one note, when it is missing. `pnpm verify` passes either way; `test:install`, `test:assets` and `test:world` need the fixtures.

Stack: Vite, React 19 and TypeScript; three.js (WebGPU with a WebGL2 fallback) through react-three-fiber, TypeGPU for the grid shader, Jotai and Immer for state, Vitest, ESLint and Prettier.

## Tools

| Key | Tool                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V   | Select: click, Shift+click, box select, move, arrow keys to nudge, Delete, Mod+D, Mod+A, R to rotate items                                                                                                       |
| P   | Item: furniture, stations, stairs, poles and beams from the catalogue, with EN/PL search; R / Shift+R rotate; an item stands on the surface under the pointer; stairs place a whole flight up to the next storey |
| H   | Build: single game pieces from the palette, snapped to other pieces as the game does; the wheel or R turns them, Q / E pick the snap point, Shift places freely, Ctrl/⌘+click removes a piece or item            |
| D   | Dimension, at the height of the surface under its first point (Enter in the ruler pins the measurement)                                                                                                          |
| M   | Ruler, at the height of the surface under its first point                                                                                                                                                        |
| U   | Underlay: load a reference image, calibrate its scale, set its opacity                                                                                                                                           |

Other keys:

- Space+drag or middle-drag pans.
- The wheel zooms.
- Home or Shift+1 fits the plan to the view.
- G cycles the snap step.
- Alt turns snapping off.
- Mod+Z / Mod+Shift+Z undo and redo.
- Mod+S / Mod+O save and open a `.valheimplan.json` file.

## Cut height and support

Every piece, item and dimension stands at its own absolute height. One cut height, H, decides what you see: everything whose bottom is below H shows (a piece that straddles it shows whole), and everything shown can be edited. All (no cut) shows the whole plan. The Cut bar at the canvas edge has H as a field and a slider, All, the step (1 m, or 0.5 m for grausten floors) and the plan's storey stops ("+5.5 m · 41"), found from its floor tiles: cutting at a stop hides that storey's floor and everything above it.

- PageUp / PageDown move H a step; Shift jumps between stops; C toggles All and back.
- Mod+PageUp / PageDown move the selection a step. The Inspector has a Height field too.
- What you place or move stays shown: the cut rises to it.
- Tools work on the surface under the pointer. In 2D the ray comes straight down from above everything drawn, so it lands on the topmost shown surface (at All, roofs too), else the ground; Build in 2D always lands. The ground is the shown terrain, else the plane at 0.
- The bill of materials counts what is visible or all of it (Visible / All). A click on a problem in the Integrity list raises the cut to show it.
- Support colours every piece by the game's structural support: blue on the ground, green to red as it weakens, magenta where it would collapse. The bill of materials lists what would collapse.

## 3D view

Press 3 (or use 2D / 3D in the status strip) to see the plan in 3D: pieces and items as their collider boxes (roof pieces as roof shapes), everything below the cut at its height; Ghost in the Cut bar draws the rest as see-through boxes (they can't be picked), with a Ghost opacity slider. Every tool except the underlay works in 3D too, on the surfaces you point at: the same clicks, drags, snapping, Alt, keys and undo as in 2D, with ghost pieces and lines showing what a click would build, and selecting picks the piece you see. The underlay tool goes back to 2D.

- Left click and drag use the active tool.
- Right drag orbits.
- Middle drag, Shift/Ctrl/⌘ + right drag, or Space + drag pans along the ground.
- The wheel zooms towards the cursor; + and − move the camera in and out.
- Home or Shift+1 fits the plan; 0 resets the view direction.
- Boxes / Models in the status strip swaps the boxes for the game's own meshes and textures, read from your install the first time each piece is shown ("Loading models 12/20"). Selection, hover and support colours tint them; picking still uses the boxes. If the models need the game files and the browser no longer has them (an install opened by dragging the folder in, or the saved catalogue), the strip says "Drop your Valheim folder here to load models": drop it on the view and they load without a reload. With a remembered folder, "Reconnect folder" asks for access again. Pieces without a model stay boxes.

## Importing from a world save

World… in the status strip finds your builds in a Valheim world save and imports one as a new plan. Drop a world's folder (`_main.N.fwl2`, `.chunks` and `.chunk` files), a whole `worlds_local` / `worlds` folder, or an old `.db` onto the panel; on macOS they are in `~/Library/Application Support/IronGate/Valheim/worlds_local/` (Steam Cloud: `~/Library/Application Support/Steam/userdata/<id>/892970/remote/worlds/`), which Chrome's folder dialog refuses, so drag them from Finder. The save is read in a Web Worker and never changed or uploaded; only the built pieces (prefab, position, rotation) are kept, in this browser, until Forget. Player IDs and the world's player list are never read.

The panel shows the builds on a map (north up, as in the game) with their size, material and grid direction; builds under 5 pieces are hidden (adjustable). Import keeps the game's world axes (the plan grid on the world's 2 m lattice; "Align grid to the build" turns it onto the build's own grid instead, and the Grid button in the status strip switches later), puts the build's corner at the origin, and keeps every piece's height above the build's lowest piece; the plan opens with the cut at All. "With terrain" also brings the ground around the build, generated from the world's seed and the save's terrain edits in your browser (the plan keeps the finished ground, never the seed); Terrain in the status strip shows or hides it, with its opacity beside it. The pieces come in as raw pieces: drawn as their outline from above (roofs outlined only) in 2D and as boxes (roof pieces as M12's roof shapes) or the game models in 3D, counted in the bill of materials, movable, turnable (R) and deletable, and checked for support as pieces you build are. The Roofs toggle in the status strip hides the roof pieces in both views, to see and pick inside. A world folder dropped anywhere on the planner opens the World panel with it.

The planner shows the game the right way round: north (+z in the game) is up in 2D, and a build looks in the planner as it does in the game. (Before M13's fix round it showed a mirror image.) Plans saved earlier keep their positions; symmetric pieces look the same, while asymmetric ones (stairs, beds, stations, door models) show as their mirror, so turn them if they matter. Plans imported from a world before then should be imported again.

## Docs

- `research/README.md`: what we know about the game. The app parses the install itself (`src/gameData/`); the data extracted with UnityPy and the extraction scripts are kept privately as test fixtures (`private/research/`).
- `docs/Roadmap.md`: the stack, the architecture and the milestones (`docs/RoadmapV2.md` covers M8 onwards). The detailed milestone plans are private (`private/plans/`).
- `docs/Findings.md`: known issues and follow-ups that agents logged while building it.

## Licence

MIT, see [LICENSE](LICENSE). `Mathf.PerlinNoise` and `UnityEngine.Random` in `src/gameData/valheim/terrain/unityNatives.ts` are reimplemented from the constants in [ricosolana/Valhalla](https://github.com/ricosolana/Valhalla) (MIT licence, © its authors).
