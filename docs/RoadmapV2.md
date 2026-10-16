# Valheim Floor Planner: v2 roadmap

This builds on v1 (M1–M7, see [Roadmap.md](Roadmap.md)). The stack and principles stay the same:
- `model/` and `catalog/` stay pure.
- No kebab-case file or directory names.
- Files stay under ~400 lines.
- Tests stay lean.
- Each milestone gets one commit on `main`.

**Workflow per milestone:** a detail planner, then an implementer, then one combined QA + code-review agent, then a fix round by the same implementer. This is leaner than v1's separate QA and review agents.

**Review rule:** after each visual milestone (M9, M10, M11), pause for the user's visual review before the next milestone's implementation.

**Budget rule:** check weekly usage at every agent hand-off. Stop starting new agents at about 90% so the user can apply their reset.

## M8: Game files parsed in the browser, editor gated on a real install

- The user picks their Valheim install with `showDirectoryPicker`.
  - The handle is stored in IndexedDB, so later visits only need a permission click.
  - Fallback: a `<input webkitdirectory>` folder input, for browsers without the API or folders Chrome refuses. Example: Windows `Program Files`, which is likely blocked.
- **The editor does not load without a valid install.** There are no placeholder assets. The gate screen explains what to pick and why.
- The game data folder is found automatically from the picked folder:
  - macOS: `Valheim.app/Contents/Resources/Data`
  - Windows/Linux: `valheim_Data`
- A TypeScript parser runs in a Web Worker and reads lazily from the files with `File.slice`:
  - the UnityFS bundle reader;
  - the serialized-file reader with type trees;
  - the objects we need: GameObject, Transform, colliders, Piece/WearNTear/CraftingStation/ItemDrop data, and the localization TextAsset in `resources.assets`.
- The parser builds the same catalogue the app gets today from `research/valheim-pieces.json`, plus item names.
  - The result is cached in OPFS, keyed by bundle size and last-modified date.
  - The research JSON stays in the repo only as a fixture for tests.
- **Already verified:** the main bundle (`c4210710`, 745 MB) is UnityFS v8 with 8,062 blocks of 128 KB or less, compressed with LZ4HC or stored raw. Random access to individual blocks works.
- The material support constants come from game code (`assembly_valheim.dll`), not asset data. They stay hard-coded, with a version note.

## M9: 3D viewer (one floor, view only)

- A 2D/3D toggle. 3D uses a perspective camera with orbit controls, lighting and shadows.
- Pieces are extruded to their real heights:
  - walls by course;
  - floors by thickness;
  - doors and gates cut out of walls;
  - items as collider boxes. Real meshes are deferred.
- Editing stays in 2D. Selection is shared, so the 3D view highlights what is selected.

## M10: Editing in 3D

- Pick and hit-test with raycasts against the derived pieces.
- The existing tools work on a ground work plane in 3D: wall, floor, opening, item, select/move.
- Gizmo-free moves on the work plane, snapping, and the same commands and undo as 2D.

## M11: Verticality and structural integrity

- **Levels:** elevation steps via level up/down controls. The user says 1 m is the smallest practical step without free placement, so plan **1 m by default**. Note that 0.5 m-tall pieces exist (log beam 2×0.5 m, grausten floors 0.5 m thick); the planner decides whether 0.5 m stays as an option.
  - Each entity gets an elevation or level.
  - Editing happens on a work plane at the current level, and the levels below are shown as ghosts.
  - Rooms and the bill of materials are worked out per level.
  - The planner should **challenge** this UX against the editing complexity and propose the simplest model that works.
- **Stairs and ladders** connect levels. Game stairs rise 1 m over 2 m of run.
- **Structural integrity** follows the game's formula, decoded in `research/README.md` §4:
  - pieces connect through 3D snap-point contacts;
  - support propagates from ground contact;
  - each piece is coloured by its support level;
  - pieces that would collapse show a warning.

## M12: Roofs

- Roof tools for thatch, darkwood shingle and grausten, at 26°, 45° and 67°, using the extracted roof pieces: straight, inner and outer corners, ridges.
- Simple gable and hip roofs over a selected room or building.
- Overhangs are supported. This is how the user builds them in-game:
  - **Framing:** with **1 m log beams** (`wood_beam_1` / log pieces). 1 m is the smallest step without free placement.
  - **26° roof:** the eave sits **1 m out from the wall**, measured perpendicular to it, and the roof also runs **1 m past the building's end**, so the gable overhangs too.
  - **45° roof:** the eave sits **1 m out, 1 m down** from the top edge of the wall, and also **1 m past the building's end**. So the corner gets a 1 × 1 × 1 m bracket: one horizontal log out from the corner and one vertical log down.
  - Reference screenshot: the user's `images/4.webp`, kept in the session (a red bracket sketch on an in-game roof corner).
  - **Correction from the user:** with this geometry, the roof piece rests directly on the wall's top edge, especially on 45° roofs. So the 1 m logs are only needed to *start* the overhang, not to hold it up. The roof itself is placed 1 m out, resting on the wall's top edge, and needs no log under it.
- Roof pieces past the walls count toward the bill of materials. For support, they take it from their contact with the wall's top edge, not from logs. M11's integrity check must therefore treat a roof touching a wall edge as a support contact.
- Roof pieces count toward the bill of materials and toward support.

## M13 (optional, plan only): Loading game world saves

- Stop after a plan and estimates. The user will decide whether to cut it.
- The idea: load a `.db` world save, find player-built structures on the map, import them into the editor, and edit them.
