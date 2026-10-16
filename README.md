# Valheim Floor Planner

A 2D top-down planner for Valheim builds, with a 3D view of the same plan. Every piece size, snap rule, cost and build radius comes from the game's own files, so a plan here matches what you can build in the game.

The planner needs your own Valheim install. On first visit it asks for the game folder (Steam's `steamapps/common/Valheim`) and reads the building pieces from it in a Web Worker, in a few seconds. Nothing is uploaded. The result is cached in the browser (IndexedDB), so later visits open the editor at once; the status-strip menu (`398 pieces · Unity …`) re-scans after a game update or switches to another install. Chrome and Edge remember the folder; other browsers use an upload-style folder dialog and can reuse the cached catalogue.

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
| P   | Item: furniture and crafting stations from the catalogue, with EN/PL search; R / Shift+R rotate                                                       |
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

## 3D view

Press 3 (or use 2D / 3D in the status strip) to see the plan in 3D: walls by course, floors at their real thickness, doors and gates as see-through panels, and items as their collider boxes. Editing stays in 2D, but the selection is shared: in 3D, click selects (Shift+click toggles, clicking empty ground clears) and Delete, arrows, Mod+A and undo work as in 2D. Any drawing tool's key goes back to 2D with that tool.

- Right drag orbits.
- Middle drag, Shift/Ctrl/⌘ + right drag, or Space + drag pans along the ground.
- The wheel zooms towards the cursor.
- Home or Shift+1 fits the plan; 0 resets the view direction.

## Docs

- `research/README.md`: what we know about the game, plus the extracted data (`valheim-pieces.json`, `valheim-items.json`) and the UnityPy scripts that extract it (`research/extract/`). The app parses the install itself (`src/gameData/`); the JSON is now the fixture for tests.
- `docs/Roadmap.md`: the stack, the architecture and the milestones. Each milestone has a plan in `docs/plans/` (M1–M8; `docs/RoadmapV2.md` covers M8 onwards).
- `docs/Findings.md`: known issues and follow-ups that agents logged while building it.
