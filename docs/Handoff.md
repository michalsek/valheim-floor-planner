# Handoff (2026-10-18)

This is where to start a new session on the Valheim Floor Planner. It covers the current state, how we work, how to test, and the next two goals.

## 1. Current state

`main` is at `2a4eafc` and later; every milestone is committed. Most recent first:

| Milestone | What it added | Plan |
|---|---|---|
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
- `research/README.md`: game knowledge. Covers piece sizes, support formula and constants (§4), and the world-save format (§7).

## 2. How we work (the user's preferences)

- **Workflow per milestone:**
  1. A detail planner agent writes the plan, saved to `docs/plans/Mx.md`.
  2. An implementation agent builds it.
  3. One combined QA and code-review agent checks it.
  4. The same implementer runs the fix round.
  5. The orchestrator commits the milestone to `main`. Commit and push are pre-authorised; there is no git remote.
- **Pause points:**
  - After each visual milestone, pause for the user's review, with screenshots.
  - Check weekly usage at every agent hand-off. Stop starting agents at about 95%, so the user can apply their reset.
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

## 4. Next goals (from the user)

### Goal A: terrain from the world save or seed
The user's aim: prototype buildings on the real ground, then recreate them in-game.

**Starting thoughts.** These are unverified; do a spike first, like M13 a0.
- **Base heightmap.**
  - Valheim's terrain is generated deterministically from the seed. The seed and `worldGenVersion` are in `.fwl2`, read only up to the seed; never read player history.
  - The generator is `WorldGenerator` in the game assembly: biome noise plus height functions built on Unity's `Mathf.PerlinNoise`.
  - Open-source world viewers reimplemented it. Check each one's licence, and that it is current for 1.0 (worldGenVersion 2, "altbiomes").
  - Prefer our own port, written from the IL with `ilDump.py`, verified against the game.
  - **Risk:** matching float maths bit-for-bit, including Unity's Perlin implementation.
- **Player edits.** Terrain changes made with the hoe and pickaxe live in the save as `TerrainComp` / `_TerrainCompiler` ZDOs (pokemanz has 3). They hold per-zone height and paint deltas. Decode them as well, otherwise flattened building sites won't match.
- **Scope.** Generate a local patch around the imported build, e.g. a 64–256 m radius at about 1 m resolution, rather than the whole world.
  - 3D: render it as a mesh.
  - 2D: shaded relief and contour lines.
  - Optionally use biome colours.
- **Planner impact.**
  - Integrity currently assumes flat ground at y = 0. It would need ground contact against the terrain height instead.
  - Imports would place their datum relative to the terrain.
  - Plans need a "site" anchor: world name, seed and origin. `importFrame` already holds part of this.
- **Cheaper fallback:** use only the terrain deltas and height samples from the save's zone data, if the format allows it, instead of generating terrain from the seed.

### Goal B: polish the vertical level tool (M11)
The problems the user reported:
1. It's hard to tell which buildings or parts are on the selected level.
2. It's hard to see where the grid is vertically relative to the models. Grid divisions often line up with several levels, which is confusing.

**Ideas to evaluate:**
- **A stronger split between the current level and the rest:**
  - an "isolate level" mode;
  - a Sims-style cut-away that hides everything above the work level in 3D;
  - outline-only or desaturated pieces off the level;
  - a colour per level.
- **Make the work plane explicit in 3D:**
  - a translucent level plane at the datum;
  - a height tag such as "+4 m" at the cursor and on the plane edge;
  - a vertical guide from the cursor down to the ground;
  - grid lines that fade the further they are from the datum.
- **Levels bar:** per-level highlight on hover, previewing what's on that level, and the selection's level marked.
- **2D:** clearer ghosting of the level below, and a label for the current level.

M11's own findings in `docs/Findings.md` list related issues: the grid at upper levels, ghosts, and stairs and levels.

**Suggested order:** B first. It's smaller, purely UX, and improves day-to-day use. Then an A spike, as a go/no-go on matching the world generator, before committing to full terrain.
