# Handoff (2026-10-18)

This is where to start a new session on the Valheim Floor Planner. It covers the current state, how we work, how to test, and the next two goals.

## 1. Current state

`main` is at `5dcac2e` and later; every milestone is committed. Most recent first:

| Milestone | What it added | Plan |
|---|---|---|
| M16 Stage 1 | Real terrain under imported builds: a TS port of the 1.0 world generator (bit-identical to `research/extract/world/worldGen.py`, incl. rivers and streams), the save's TerrainComp edits, a worker with an OPFS river cache, import "With terrain" / Add terrain, a 3D terrain block and 2D hillshade and contours, terrain ground contact for integrity. Plans store the finished ground (plan v5), never the seed. | `docs/plans/M16.md` (§1–§7 the a0 spike, §8 Stage 1) |
| M15 | Level clarity: 3D cut-away above the work level (C), the frosted level plate with height tags and drop line, Levels-row hover preview and selection dot, neutral 2D ghosts | `docs/plans/M15.md` |
| M13 Stage 1 | World-save import: the chunked 1.0 format plus legacy `.db`, cluster overview, raw-piece import. Game data is unmirrored with a z flip at the catalogue, model and import boundaries. | `docs/plans/M13.md` (§6 has the format validation) |
| M14 | Real game meshes and textures, extracted into OPFS and rendered with instancing and a Boxes/Models toggle | `docs/plans/M14.md` |
| M12 | Parametric roofs: gable, hip and shed; overhangs; valleys; gable fill; odd-span filler courses | `docs/plans/M12.md` |
| M11 / M11.1 | Per-piece elevation, the Levels bar, stair flights, structural integrity, game-style pole snapping | `docs/plans/M11.md` |
| M9 / M10 | 3D viewer, then editing in 3D | `docs/plans/M9.md`, `docs/plans/M10.md` |
| M8 | Parses the game files in the browser from the user's own install, then gates the editor on it. On macOS, drag-and-drop is the primary path, because Chrome blocks `~/Library`. | `docs/plans/M8.md` |
| M1–M7 | v1 2D planner and themes | `docs/Roadmap.md` |

Other reference documents:
- `docs/RoadmapV2.md`: the v2 milestone plan, including the user's in-game building notes on overhangs and 1 m steps.
- `docs/Findings.md`: every known issue, deferred item and decision, by milestone. **Read the relevant section before changing an area.**
- `research/README.md`: game knowledge. Covers piece sizes, support formula and constants (§4), the world-save format (§7), and terrain generation and TerrainComp (§8).

## 2. How we work (the user's preferences)

- **Workflow per milestone:**
  1. A detail planner agent writes the plan, saved to `docs/plans/Mx.md`.
  2. An implementation agent builds it.
  3. One combined QA and code-review agent checks it.
  4. The same implementer runs the fix round.
  5. The orchestrator commits the milestone to `main`. Commit and push are pre-authorised; there is no git remote.
- **Pause points:**
  - After each visual milestone, pause for the user's review, with screenshots.
  - Weekly usage: since 2026-10-18 the user asked not to gate work on it.
  - For a large milestone, parallel implementer pairs in the same tree work well when each owns separate files (M16 passes 1 and 2).
- **Code:**
  - Clean, composable code. No perf micro-optimisation. Lean tests.
  - Never kebab-case. PascalCase for components and large modules, camelCase otherwise.
  - Files stay under about 400 lines.
  - `src/model` and `src/catalog` stay pure: no React, three.js or DOM.
- **Agent briefs must say:**
  - which files the agent may touch;
  - "don't commit" (the orchestrator commits);
  - a dedicated dev port, and to leave the user's own server on **5173** alone;
  - to stop the servers and browsers it starts.
- **Status updates:** keep them short and frequent, with screenshots of the tool. Use `SendUserFile` with `render`.

## 3. Testing recipe (no hands needed)

- **Gates:** `pnpm verify` (typecheck, lint, tests, build), `pnpm test:install`, `pnpm test:assets`, and `VALHEIM_WORLD_TEST=<world folder> pnpm test:world`.
- **Game install:** `~/Library/Application Support/Steam/steamapps/common/Valheim`, at v1.0.20 on Unity 6000.0.75f1.
- **Browser checks:**
  - Use headless Chrome (Chrome 155) over CDP. WebGPU uses the Metal adapter; also check `?webgl`.
  - Use a scratchpad profile and a random debugging port.
  - Run the dev server with `pnpm dev --port 52xx --strictPort`.
  - Load the install by dropping the folder: CDP `Input.dispatchDragEvent` with the real path. This goes through the gate's drop handler.
  - Load a world the same way, through the World panel.
- **Test world:**
  - `docs/testWorlds/pokemanz` is a copy of the user's real 1.0.20 world. It is **git-ignored and holds personal data**, so never commit it and never print player IDs or names.
  - It has 1,142 player pieces and one 1,140-piece build at a 22.5° yaw.
  - Steam Cloud worlds live in `~/Library/Application Support/Steam/userdata/<id>/892970/remote/worlds/`.
- **Research tooling:**
  - Recreate the Python venv in the scratchpad: `uv venv .venv --python 3.12`, then `uv pip install UnityPy numpy lz4 dnfile dncil`.
  - Scripts in `research/extract/`:
    - `extract_*.py`: catalogue, items and model goldens.
    - `world/ilDump.py`: dumps IL from `assembly_valheim.dll`, used to read game code for interoperability notes. Keep only paraphrased notes; never commit decompiled code.
    - `world/readWorld.py`, `world/stableHash.py`: the Python reference reader and prefab hash.
    - `world/worldGen.py`, `world/validateTerrain.py`, `world/terrainGoldens.py`: the terrain reference port, its validation against a world, and the synthetic-seed goldens (`research/terrainGoldens.json`).
- **Terrain privacy:** never write a world's seed, name, player names/IDs or build coordinates into the repo; `test:world` asserts aggregates only.

## 4. Next goals

Goals A (terrain, M16 Stage 1) and B (level clarity, M15) from the previous handoff are done and reviewed by the user. Options for next:
- **M16 Stage 2** (`docs/plans/M16.md` §5): terrain flattening built into location prefabs (ruins, dolmens; the only remaining height outliers, within 25 m of a location), Ashlands and Deep North height functions, seed-only sites (pick a spot on a world map without a build).
- **The roof-tool seating fix:** a roof drawn on a level with no walls under it now rests on lower walls whose tops reach that level. It is uncommitted on branch `claude/xenodochial-bhaskara-b9d105` (its own worktree); review and merge it.
- **M13 Stage 2:** orthogonal reconstruction of imported builds, and the PlanBuild `.blueprint` export idea.
- **The `docs/Findings.md` backlog**, including the M16 out-of-scope list (§8.10) and the open items in the M16 pass sections.
