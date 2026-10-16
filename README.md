# Valheim Floor Planner

A 2D top-down planner for Valheim builds. Every piece size, snap rule, cost and build radius comes from the game's own files (v1.0.20), so a plan here matches what you can build in the game.

```bash
pnpm install
pnpm dev        # http://localhost:5173  (append ?webgl to force the WebGL2 fallback)
pnpm verify     # typecheck, lint, tests, build
```

## Tools

| Key | Tool |
|---|---|
| V | Select: click, Shift+click, box select, move, corner drag, arrow keys to nudge, Delete, Mod+D, Mod+A, R to rotate items |
| W | Wall: click to add corners, Enter or double-click to finish, click the start point to close the loop, F to flip which side a stone wall's strip is on |
| B | Floor: drag a rectangle |
| O | Door or gate, placed on a wall |
| P | Item: furniture and crafting stations from the catalogue, with EN/PL search; R / Shift+R rotate |
| D | Dimension (Enter in the ruler pins the measurement) |
| M | Ruler |
| U | Underlay: load a reference image, calibrate its scale, set its opacity |

Other keys:
- Space+drag or middle-drag pans.
- The wheel zooms.
- Home or Shift+1 fits the plan to the view.
- G cycles the snap step.
- Alt turns snapping off.
- Mod+Z / Mod+Shift+Z undo and redo.
- Mod+S / Mod+O save and open a `.valheimplan.json` file.

## Docs

- `research/README.md`: what we know about the game, plus the extracted data (`valheim-pieces.json`, `valheim-items.json`) and the scripts that extract it (`research/extract/`).
- `docs/Roadmap.md`: the stack, the architecture and the milestones. Each milestone has a plan in `docs/plans/M1–M7.md`.
- `docs/Findings.md`: known issues and follow-ups that agents logged while building it.
