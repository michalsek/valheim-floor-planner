# Valheim building reference (for the floor planner)

Source of truth: the installed game, **Valheim 1.0.20** (network v41, macOS build),
extracted from the Hammer's piece table with UnityPy (`extract/extract_pieces.py`).
Full machine-readable catalogue: [`valheim-pieces.json`](valheim-pieces.json)
(398 hammer pieces: names EN/PL, category, crafting station, material, HP, cost,
snap points, collider bounds).

Since M8 the app no longer ships this JSON: it parses the same data from the user's
install in the browser (`src/gameData/`, a TypeScript port of `extract/*.py`). The
JSON files stay as the fixture for tests, and `pnpm test:install` checks the parser
against them on a real install.

Axes in the data are Unity local space, metres: `x` = length along the piece,
`y` = up, `z` = thickness/depth. In a top-down plan we use `x` and `z`.

---

## 1. Units and grid: the short version

- **1 Unity unit = 1 m.** Characters are ~1.8 m tall.
- The "core" module is **2 m**: wood wall 2×2, floor 2×2, beam 2 m, roof piece 2 m run.
- Every material also has **1 m** pieces (quarter walls 1×1, floor 1×1, beam/pole 1 m),
  so **1 m is the smallest planar step you get while snapping.**
- **0.5 m appears in two places:** vertically (log beams 0.5 m tall, grausten floors
  0.5 m thick), and horizontally as the **centre line of a 1 m-thick stone wall** whose
  face sits on a grid line. That makes **0.5 m the right base grid for the planner**,
  with 1 m and 2 m as the main snap levels.
- Snapping is point-to-point: every piece has snap points (corners/ends), and the game
  joins a snap point of the piece you're placing to the nearest snap point on an
  existing piece. There is no global world grid. "Grid" only exists because pieces
  have regular sizes.

## 2. Wall families: the important difference

There are **two kinds of wall**, and they behave differently on a plan:

| Kind | Snap points | Effect on a plan |
|---|---|---|
| **Panel walls** (wood, ashwood, scalewood, timber, grausten, iron cage, dvergr metal) | 4 corners **on the centre plane** (z = 0) | The wall *is a line*. It sits **centred on the grid line**, half its thickness inside and half outside. |
| **Block walls** (stone, black marble) | 8 corners of the **whole box** (z = ±0.5) | The wall *is a 1 m-thick volume*. Its **face** snaps to the grid line, so it eats a full 1 m strip either inside or outside the line. Its centre line is offset by 0.5 m. |

### Panel walls (centre-line walls)

| Piece (prefab) | L × H (m) | Thickness | Material | Station |
|---|---|---|---|---|
| Wood Wall (`woodwall`) | 2 × 2 | 0.30 | wood | workbench |
| Wood Wall Half (`wood_wall_half`) | 2 × 1 | 0.30 | wood | workbench |
| Wood Wall 1x1 (`wood_wall_quarter`) | 1 × 1 | 0.30 | wood | workbench |
| Log Beam 2 m / 4 m (`wood_wall_log`, `wood_wall_log_4x0.5`) | 2 / 4 × 0.5 | 0.50 | hardwood (core wood) | workbench |
| Ashwood Wall / Half / Quarter | 2×2 / 2×1 / 1×1 | 0.25–0.30 | wood | workbench |
| Scalewood Wall / Half / Quarter | 2×2 / 2×1 / 1×1 | 0.21–0.28 | wood | workbench |
| Timber Wall (`stave_wall_2x2`) *(Deep North)* | 2 × 2 | **0.67** | timberwood | workbench |
| Grausten Wall 1x2 / 2x2 / 4x2 | 1 / 2 / 4 × 2 | **0.40** | ashstone | stonecutter |
| Cage Wall 1x1 / 2x2 | 1 / 2 × 1 / 2 | 0.10 | iron | forge |
| Dvergr Metal Wall | 2 × 2 | 0.10 | iron | black forge |
| Wood Door | 2 × 2 (fills a 2 m gap) | 0.50 | wood | workbench |
| Ashwood Door | 2 × 2 snap (3 m tall model) | 0.26 | wood | workbench |
| Wood Gate / Iron Gate | 2 × 3 | 0.50 / 0.20 | wood / iron | workbench / forge |
| Darkwood Gate | 2 × 4 | 0.45 | hardwood | forge |
| Timberwood Gate | 2 × 6 | 0.77 | hardwood | forge |

Grausten walls are stone you'd *think* of as blocks, but they're thin panels with
centre-line snapping, like wood.

### Block walls (face-aligned, 1 m thick)

| Piece | X × Y × Z (m) | Material | Station |
|---|---|---|---|
| Stone Wall 1x1 | 1 × 1 × 1 | stone | stonecutter |
| Stone Wall 2x1 | 2 × 1 × 1 | stone | stonecutter |
| Stone Wall 4x2 | 4 × 2 × 1 | stone | stonecutter |
| Stone Pillar | 1 × 2 × 1 | stone | stonecutter |
| Stone Arch | 2 × 1 × 1 | stone | stonecutter |
| Black Marble 1x1x1 / 2x1x1 / 2x2x2 | as named | marble | stonecutter |
| Black Marble Plinth / Cornice / Arch | 2 × 2 × 1 | marble | stonecutter |

**What this means for a plan.** An 8 m room drawn on grid lines gives:
- **wood:** about 7.7 m clear inside (8 − 2 × 0.15);
- **stone, faces on the outer grid lines:** 6 m clear inside (8 − 2 × 1);
- **stone, faces on the inner grid lines:** 8 m clear inside, but a 10 m outer footprint.

The planner has to show **grid-line, outer and clear-inside dimensions** separately.

## 3. Floors, beams, poles, stairs, roofs

| Piece | Footprint (m) | Height / thickness | Notes |
|---|---|---|---|
| Wood Floor 2x2 / 1x1 | 2×2 / 1×1 | 0.13 | snap at top-surface corners |
| Ashwood Floor 2x2 / 1x1 | 2×2 / 1×1 | 0.13 | |
| Stone Floor 2x2 | 2×2 | **1.0** thick | block, snaps top and bottom |
| Black Marble Floor (and Triangle) | 2×2 | 1.0 thick | |
| Grausten Floor 1x1 / 2x2 / 4x4 | 1 / 2 / 4 square | 0.5 thick | |
| Cage Floor 1x1 / 2x2 | 1 / 2 square | 0.1 | |
| Wood Beam / Pole 1 m, 2 m | 0.4 section | | |
| Darkwood Beam / Pole 4 m | 0.4 section | | longer span per support step |
| Log Pole 2 m / 4 m | 0.4 section | | hardwood (core wood) |
| Timber Beam / Pole 2 m, 4 m | ~0.65 section | | timberwood |
| Wood Iron Beam / Pole 2 m | 0.3 section | | iron |
| Grausten Small / Medium Pillar | 0.5 / 1.0 section | 1 m tall | |
| **Wood Stairs** | **2 × 2** | rises **1 m** | climbing 2 m takes 2 × 4 m of floor |
| **Stone / Black Marble / Grausten Stairs** | 2 × 2 | rises 1 m | |
| Wood Ladder | 1 × 2 | rises 2 m | the compact option |
| Grausten Steep Stairs | 1 × 2 | rises 2 m | |
| Ashwood Stair | 0.5 × 2 snap (≈1.1 wide) | rises 1 m | |
| Dvergr Spiral Staircase L/R | ~2.3 × 2.3 | rises 1 m per piece | |

**Roof pitches.** Every roof piece covers **2 m of horizontal run**:

| Label | Rise per 2 m run | Real angle |
|---|---|---|
| 26° | 1 m | 26.6° |
| 45° | 2 m | 45° |
| "67°" *(Deep North)* | 4 m | 63.4° |

A symmetric gable built from whole pieces needs a **half-span that's a multiple of 2 m**.
So building widths of **4, 8, 12, 16 m** give a ridge that lands on the grid. Widths of
6 or 10 m force an off-grid ridge, an asymmetric roof, or 1 m filler pieces.

Ridge height above the wall top for width W:
- 26°: W/4
- 45°: W/2
- 67°: W

For example, an 8 m hall gets 2 m (26°) or 4 m (45°) of extra height.

Roof families: Thatch (wood) 26/45/67°, Shingle (darkwood) 26/45/67°,
Grausten roof 45° only. Each family has a straight piece, inner corner, outer corner
and ridge.

## 4. Structural integrity (from `WearNTear.GetMaterialProperties`)

| Material | Pieces | maxSupport | minSupport | vertical loss | horizontal loss |
|---|---|---|---|---|---|
| wood | wood, darkwood, ashwood, scalewood | 100 | 10 | 0.125 | 0.20 |
| hardwood | core wood: log beams/poles, darkwood/timber gates | 140 | 10 | 0.10 | 0.167 |
| timberwood | Timber walls/beams/poles *(Deep North)* | 200 | 10 | 0.077 | 0.20 |
| stone | stone walls, floors, pillars | 1000 | 100 | 0.125 | **1.0** |
| marble | black marble | 1500 | 100 | 0.125 | 0.50 |
| ashstone | grausten | 2000 | 100 | 0.10 | 0.333 |
| iron | wood-iron beams, cage, dvergr metal, flametal | 1500 | 20 | 0.077 | 0.077 |
| ancient | (not on the hammer; world pieces) | 5000 | 100 | 0.067 | 0.25 |
| ice | Ice Block | 1000 | 100 | 0.125 | 0.333 |

**Propagation.** This was checked against the IL of `WearNTear.UpdateSupport`:

- A piece touching terrain (or rocks/trees) gets its material's `maxSupport`.
- Otherwise it takes the best value over its supporting neighbours:
  `support ≈ parentSupport × (1 − loss × (distance + 0.1))`
  - `distance` is the centre-of-mass to centre-of-mass distance in metres.
  - `loss = lerp(horizontalLoss, verticalLoss, angle)`, where `angle` is 0 for a
    sideways neighbour and 1 for one straight below.
  - The result is capped at the piece's own `maxSupport`. So wood resting on stone
    still caps at 100.
- If two supports below the piece are more than 100° apart (opposite sides), their
  values are averaged and only vertical loss applies. That's how floors can bridge
  between two walls or columns.
- The piece breaks at or below `minSupport`.

Rough reach with 2 m pieces:

| Material | Straight up | Cantilever off one post |
|---|---|---|
| Wood | ~7–8 pieces (wiki: 16 m column) | ~4 pieces (~8 m) |
| Core wood | wiki: ~24 m | ~6 pieces |
| Stone | about the same as wood (same max/min ratio) | **0**: horizontal loss of 1.0 means it must sit on something, though it can bridge between two supports |
| Wood-iron pole | wiki: 50 m | |

Loss is per metre, so long pieces mainly save the +0.1 m per joint. Their real benefit
is fewer pieces to place.

## 5. Crafting stations and space-relevant footprints

Build radius (from the `CraftingStation` component):

| Station | Base radius | Extra per upgrade | Needs roof to craft |
|---|---|---|---|
| Workbench | 20 m | +4 m | yes |
| Forge | 20 m | +3 m | yes |
| Stonecutter | 20 m | — | yes |
| Artisan Table | 40 m | +3 m | yes |
| Black Forge | 20 m | +3 m | yes |
| Galdr Table | 20 m | +3 m | yes |
| Cauldron | 20 m | +3 m | no (needs fire) |
| Food Prep Table | 20 m | — | yes |

Ward (`guard_stone`) protection radius: **32 m**.

Approximate floor footprints (collider X × Z, m) worth reserving:

| Group | Footprints (X × Z, m) |
|---|---|
| Stations | Workbench 3.0×1.1, Forge 1.8×1.0, Black Forge 3.6×1.0, Stonecutter 3.2×1.5, Artisan Table 2.7×1.2, Galdr Table 2.6×2.2, Cartography Table 3.9×2.0, Stone Oven 3.0×2.0, Fermenter 1.6×1.6, Spinning Wheel 1.7×2.7 |
| Industry (usually outdoors) | Smelter 3.0×2.6, Charcoal Kiln 4.7×4.9, Blast Furnace 3.6×3.5, Eitr Refinery 5.6×2.9, Windmill 5.7×5.6, Frost Foundry 3.5×5.5, Frigid Kiln 7.1×9.1 |
| Living | Hearth **4.0×3.0** (comfort 2), Bed 1.2×2.8, Dragon Bed 2.3×3.4, Long Heavy Table 6.5×1.9, Table 2.5×1.2, Round Table 2.5×2.5, Hot Tub 3.2×3.6 |
| Storage | Chest 1.6×0.8, Reinforced Chest 1.8×1.0, Black Metal Chest 2.1×1.4, Barrel 0.8×0.8, Wardrobe 1.4×0.9 |
| Portals | Portal 4.2×1.2 (3.3 m tall), Stone Portal 8.6×4.3 (6.9 m tall) |
| Ships (for docks/boathouses) | Karve 7.7×10.1, Longship 9.2×21.6, Drakkar 15.3×35.1 |

Collider sizes approximate the visible model. They're good for space planning, but
not exact.

## 6. Reference images: what they say and where they go wrong

All three are GPT renderings of the same 3D concept. They disagree on topology, and
two of them disagree with themselves.

### Image 1: "Nordic Longhouse", cross plan, units "u"

- **Layout:** a N–S main hall (7 × 18) with two 9 × 9 side wings at mid-length, a
  7 × 4 front entry porch with steps to the south, and a gable to the north.
  Overall 25 × 27.
- **Doesn't add up:**
  - The left axis is 5 + 9 + 9 + 4 = 27, but hall + entry = 18 + 4 = 22.
  - The wing ticks don't line up with the drawn wings.
  - The drawn wing width is ~43 % of total width, against a stated 36 %.
- **Unit problem:**
  - If 1 u = 1 m, the hall's **7 m** width needs 1 m filler walls, and the 3.5 m
    half-span breaks whole-piece roofs.
  - If 1 u = 2 m, the house is 50 × 54 m, which is not what the concept shows.
- **Takeaway:** the cross/T topology is a real option. The numbers should be
  re-based to even metres, e.g. hall 8 × 18, wings 8 × 8 or 10 × 8, porch 8 × 4.

### Image 2: courtyard compound, 2 m grid, 22 × 16 m

- **Layout:**
  - main hall 8 × 8 with interior posts;
  - a **stone chimney core** between the hall and the right wing;
  - right wing 10 × 6, entry wing 4 × 4 with steps, front wing 10 × 4;
  - an open central courtyard.
- **Doesn't add up:**
  - The right axis is 6 + 6 + 4 = 16, but the right wing starts ~2 m below the top
    edge, so the right side is really ~18 m.
  - On the left axis the entry wing and front wing are stacked, but on the drawing
    they sit side by side at different depths.
- **Interior posts** split the 8 m hall into thirds (≈2.67 m), which is **off the
  2 m module**. On a 2 m grid you'd put one post line at 4 m or posts every 2 m.
- **Right wing span:** at 6 m it gives a 3 m half-span, which is awkward for gable
  roofs (see §3).
- **Chimney:** the stone core is 1 m-thick block material, so it shifts the
  neighbouring wall lines by 0.5–1 m against the wood grid. This is exactly the
  wood/stone mismatch the planner should make visible.
- **Takeaway:** the richest program (hall + hearth/chimney + several wings around a
  yard). The proportions need fixing before building.

### Image 3: L-shaped corner longhouse, 24 × 24 m

- **Layout:** long wing 8 × 24 (W side), side wing 16 × 8 off its north end (8 m
  wide), and a 16 × 16 open courtyard in the SE.
- **Consistent and buildable:** every edge is a multiple of 2 m, and the 8 m wing
  width gives clean 26°/45° gables (2 m / 4 m rise).
- **What's missing:** entrances, the chimney/hearth, interior partitions, and how the
  two roofs meet at the L corner. That corner needs inner/outer roof corner pieces,
  and both wings must be the same width (they are: 8 m).
- **Takeaway:** the best starting point, and the natural first test case for the tool.

**Common thread:** the concept is a longhouse with one or more wings around a yard.
The open questions are really about proportions:
- wing widths: 6, 8 or 10 m;
- wing lengths;
- where the stone hearth/chimney goes;
- how much clear interior space remains once wall thickness is counted.

That's exactly what the planner should answer quickly.

## 7. Valheim 1.0 world save format (chunked)

Source: IL of the installed `assembly_valheim.dll` and `assembly_utils.dll` (1.0.20, Oct 15),
disassembled with `dnfile` + `dncil` for interoperability notes (M13 a0). Only the layout
is recorded here; no game code was copied. **Confidence:** **IL** = read directly in the
save/load IL; **inf** = inferred from IL around it, not exercised against a real save.
**No real chunked world has been parsed yet** (see open questions).

### Summary
- **Not encrypted, and the ZDO files are not compressed.** `.chunk` and `.chunks` are
  raw .NET `BinaryWriter` output (`FileWriter` → `BufferedStream` → `BinaryWriter`).
  There's no hash, no trailer and no magic. **IL**
- **Little-endian** everywhere. Strings are .NET `BinaryWriter` strings: a 7-bit varint
  byte length, then UTF-8. **IL**
- **Version gate:** world version **42** (`Version.c_WorldVersion`). The game accepts
  9–42 (`IsWorldVersionCompatible`). Named versions:
  - 31 `NewSaveFormat`: the current ZDO encoding starts here;
  - 33 `NumItems`: varint item counts;
  - 38/39 `DeepNorthNoChunk*`;
  - **40 `ChunkedSave`**;
  - 41 `DeepNorth`;
  - 42 `CheatCleanSlate`.
  **IL**
- **Compression in a world:**
  - **gzip** (`Utils.Compress`): the `ZoneSystem` blob in `.db2`, and `TerrainComp` byte
    arrays inside terrain ZDOs.
  - **Brotli** (`BrotliCompressor`, .NET `BrotliStream`): only the `PersistentEventSystem`
    blob in `.db2`.
  - **The piece reader needs neither.** **IL**

### World folder
Path: `<save root>/worlds_local/<WorldName>/`. On macOS the save root is
`~/Library/Application Support/IronGate/Valheim/`. Cloud-source worlds use `worlds/`
instead of `worlds_local/`. **IL** (strings), except the macOS root, which is known from M13 §1.

| File | Written by | Content |
|---|---|---|
| `_main.N.fwl2` | `World.SaveWorldFWLData` | World metadata (below). |
| `_main.N.db2` | `ZNet.SaveWorldThread` | Net time, zones, events. **No ZDOs.** |
| `_main.N.chunks` | `ChunkSaveMapping.Save` | The chunk manifest. |
| `YY_XX__S_V.chunk` | `ZDOMan.SaveChunk` | The ZDOs of one chunk. |
| `_main.N.ok` | `ZNet.SaveWorldThread` | Commit marker: `int32 42`. |

**Save order and `.ok` semantics:**
- During a save, `N` = the previous number + 1.
- The game writes, in order: the changed `.chunk` files and the `.chunks` manifest, then
  `.db2`, then `.fwl2`.
- Only if the chunks, `.db2` and `.fwl2` all succeed does it write `_main.N.ok`. It then
  deletes the four `_main.(N-1).*` files and, for every chunk it rewrote, the superseded
  file with the older `chunkVersion`.
- On failure, it deletes generation `N` and reverts the chunk versions.

**IL**

**Choosing the generation to read:**
- Take the **highest `N` for which all four `_main.N.{fwl2,db2,chunks,ok}` exist.** **inf**
  `SaveCollection.KeepOnlyNewest` keeps the newest group of 4, or a lone `_main.0.fwl2`
  for a fresh world, and treats the rest as orphans.
- Chunk files are **not** tied to `N`. Unchanged chunks keep their old files, so the
  manifest is the only index.
- On load, the game deletes `*.chunk` files that aren't in the manifest ("orphan CHUNK").

### `.fwl2` (world metadata)
`int32 len`, then a `len`-byte ZPackage containing:

| Field | Type | Conf. |
|---|---|---|
| version | int32 (42) | IL |
| name | string | IL |
| seedName | string | IL |
| seed | int32 | IL |
| uid | int64 | IL |
| worldGenVersion | int32 | IL |
| needsDB | bool | IL |
| startingGlobalKeys | int32 n + n strings | IL |
| playerHistory | int32 n + n × `CrossNetworkUserInfo` | IL (entry layout not read) |

**Privacy:** `playerHistory` holds platform user IDs and display names. The reader stops
after `worldGenVersion` and never parses it.

### `.db2`
| Field | Type | Conf. |
|---|---|---|
| version | int32 (42) | IL |
| netTime | double | IL |
| ZoneSystem | int32 len + **gzip** ZPackage: `int32 n` + n × Vector2s generated zones, `int32 locationVersion`, `int32 n` + n global-key strings, `bool locationsGenerated`, `int32 n` + n × (`int32 locationHash`, `float x,y,z`, `bool placed`) | IL |
| RandEventSystem | float timer, string event, float time, float x,y,z | IL |
| PersistentEventSystem | int32 len + **Brotli** bytes (content not decoded) | IL |

The planner can skip `.db2`. The legacy `.db` had the same tail, after the ZDOs.

### `.chunks` (manifest)
| Field | Type | Conf. |
|---|---|---|
| version | uint16 (42) | IL |
| totalZDOs | int32 (sum over all chunks) | IL |
| count | int32 | IL |
| entries ×count | `uint16 chunk`, `uint8 size`, `uint32 chunkVersion`, `int32 numZDOs` | IL |

**Chunk index:**
- `chunk = cx | cy << 8`, where `cx = (zoneX + 256) / 8` and `cy = (zoneZ + 256) / 8`.
- `zone = floor((pos + 32) / 64)`, so a base chunk (`size` 0) is 8 × 8 zones = 512 m square,
  and the grid is 64 × 64 chunks.
- `c_ZonesPerChunk = 8`. **IL**

**Bigger chunks:**
- Sparse areas are merged into chunks of `size` 1/2/3: 2×2, 4×4 or 8×8 base chunks.
- The merge applies while the combined count is below `c_MaxNumberOfZDOsPerBiggerChunks`
  = 100 000.
- `cx` and `cy` are aligned with masks `0xFEFE`/`0xFCFC`/`0xF8F8`.
- **IL** (`DecideChunkSize`, `s_sizeFilters`); the merge policy itself is **inf**.

**Special chunks:**
- **Portals** (`Game.PortalPrefabHash`) are saved in the special chunk
  `ChunkPortal = (chunk 1, size 0)`, i.e. file `00_01__0_V.chunk`.
- That index would be a real chunk at x ≈ −15.9 km, outside the world. **IL**

**Contents:** only **persistent** ZDOs are saved. **IL**

**A reader can ignore all the geometry.** It walks the manifest, opens each file and reads
its ZDOs. Positions are absolute world coordinates.

### `.chunk` file
- **Name:** `sprintf("%02x_%02x__%d_%d.chunk", chunk >> 8, chunk & 0xFF, size, chunkVersion)`.
  The hex is lower-case, and **the high byte (z/cy) comes first**.
- `chunkVersion` is per chunk and goes up each time that chunk is rewritten. It is not
  the world version. **IL**

| Field | Type | Conf. |
|---|---|---|
| version | **int16** (world version the chunk was written with) | IL |
| count | int32 (= manifest `numZDOs`) | IL |
| ZDOs ×count | see below, decoded with **this chunk's** version | IL |

### Per-ZDO encoding (`ZDO.Save` / `ZDO.Load`)
There's still **no per-ZDO length** and **no ZDOID**: IDs are reassigned sequentially on
load. So every ZDO must be walked.

| # | Field | v31–39 (`.db`) | **v40+ (`.chunk`)** | Conf. |
|---|---|---|---|---|
| 1 | flags | uint16 | uint16 | IL |
| 2 | sector | int16 × 2 (discarded) | **removed** | IL |
| 3 | position | float32 × 3 (or int16 × 2 if bit 13) | float32 × 3, **or int16 x, int16 z with y = 0 if bit 13** | IL |
| 4 | prefab | int32 stable hash | int32 stable hash | IL |
| 5 | rotation (bit 12) | float32 × 3 Euler degrees | **`SmallRotation`**: 2 or 4 bytes (below) | IL |
| 6 | (if `flags & 0xFF` = 0, the ZDO ends here) | | | IL |
| 7 | connection (bit 0) | uint8 type, int32 hash | same | IL |
| 8 | data sections, in bit order 1–7 | count + (int32 key, value) pairs | same | IL |

**Flag bits** (`ZDO.ExtraDataFlags`):

| Bit | Mask | Meaning |
|---|---|---|
| 0 | 1 | Connection |
| 1 | 2 | Floats (f32) |
| 2 | 4 | Vec3 (3 × f32) |
| 3 | 8 | Quaternions (4 × f32) |
| 4 | 16 | Ints (i32) |
| 5 | 32 | Longs (i64) |
| 6 | 64 | Strings |
| 7 | 128 | Byte arrays (int32 len + bytes) |
| 8 | 256 | Persistent |
| 9 | 512 | Distant |
| 10–11 | 3072 | Type: 0 Default, 1 Prioritized, 2 Solid, 3 Terrain |
| 12 | 4096 | Has rotation |
| 13 | 8192 | **SmallPosition (new)** |

All **IL**.

**Section count:**
- From v33: one byte `c`; if `c & 0x80`, the count is `((c & 0x7F) << 8) | nextByte`.
  The count is big-endian in the 2-byte form.
- Before v33: a single byte.
- **IL**

**Connection:** the type is 1 Portal, 2 SyncTransform, 3 Spawned or 16 Target. The hash is
a *connection hash*, not a ZDOID. **IL**

**SmallPosition:**
- The writer uses it only when `y == 0` and x and z are exact integers (clamped to ±20000).
- So build pieces will almost always use the full `vec3`.
- **IL** (`Utils.SmallPosition`). Any use in v31–39 files is **inf** (unlikely).

**Rotation:**
- Stored as Unity **Euler angles in degrees, [0, 360)** (`ZDO.SetRotation` keeps
  `quaternion.eulerAngles`). It is omitted when every component is below 0.5°.
- `SmallRotation` (v40+): read `uint16 a`.
  - If `a & 0x8000`, it is **yaw only**: `y = (a & 0x7FFF) × 0.5`, x = z = 0.
  - Otherwise `p = a << 16 | nextUint16`, and `x = (p & 1023) × 0.5`,
    `y = (p >> 10 & 1023) × 0.5`, `z = (p >> 20 & 1023) × 0.5`.
- The writer **truncates** to 0.5° steps (`(uint)(deg × 2)`), and drops x/z within 0.5° of 0/360.
- So 22.5° and 45° are exact, while for example 359.9° becomes 359.5°.
- **IL**

**Changes from the pre-1.0 notes in M13 §1:**
- the sector is removed;
- rotation is packed into 0.5° steps (2 bytes for yaw-only pieces);
- flag bit 13 (small position) is new;
- the chunk header carries the version;
- everything else, including the data sections and varint counts, is unchanged.

Legacy `.db` (v31–39) **uses the same `ZDO.Load`**, with the `version < 40` branch.
- **Header:** `int32 version`, `double netTime`, `int64 myId`, `uint32 nextUid`,
  `int32 count`, then ZDOs back to back. **IL** (`ZNet.LoadOldWorld`, `ZDOMan.Load`)
- v < 31 uses an older length-prefixed format (`LoadOldFormat`). Don't support it.

### Piece identification
- **Prefab hash:** `GetStableHashCode` from `assembly_utils`.
  - Two accumulators start at 5381.
  - Over alternating characters: `h = (h << 5) + h ^ c`. It stops at `'\0'`.
  - The result is `h1 + h2 × 1566083941`, in int32 arithmetic.
  - The algorithm is **IL**. The DLL has no literal hash constants to cross-check against,
    so the values are verified only by the fixture.
  - Examples (computed): `woodwall` −523056075, `wood_floor` −1045925142,
    `piece_chest_wood` 328745978, `portal_wood` −661882940.
- **Data keys** are the stable hashes of the `ZDOVars` names. **IL**

  | Key | Section | Notes |
  |---|---|---|
  | `creator` (881008290) | long | The player ID, from `Piece.SetCreator`. 0 or absent means world-generated. |
  | `creatorIndex` | int | **New:** an index into `.fwl2` `playerHistory`. Personal data, so ignore it. |
  | `health` (−883022132) | float | Probably present only once damaged or set (**inf**). |
  | `support` (642166391) | float | |

- The "Has no creator" string mentioned in M13 §1 belongs to `Bed.Interact`, not to pieces.

### Browser notes
- **No decompression is needed for pieces.**
- If `.db2` is ever read:
  - The gzip blob can use `DecompressionStream('gzip')`, which every current browser
    supports.
  - For the Brotli blob: MDN now lists `'brotli'` as a `DecompressionStream` format, but
    per-browser support wasn't verified in this spike. Feature-detect it (the constructor
    throws `TypeError`).
  - The pure-JS fallbacks are Google's `brotli/js/decode.js` and the `brotli` npm package
    (`brotli/decompress`), both without a WASM build step.

### Self-consistency check (scratchpad only)
- A Python writer and reader produced and parsed a synthetic world:
  - a 4×6 hut, a 45° shed in another chunk, a 22.5° piece, and a pitched beam;
  - a ruin piece with no creator, a non-piece object, and a SmallPosition rock;
  - a 130-item int section, and a portal in the portal chunk;
  - a stale, incomplete `_main.6`.
- It also parsed the same scene as a v34 `.db`.
- Both gave identical piece counts and rotations. **This proves the tables are
  self-consistent, not that they match the game.**

### Open questions (validate on a real save)
1. Real filenames and sizes: does a small world really end up in one merged `size` 3 chunk?
2. Do all four `_main.N.*` files survive between sessions on macOS? Is the `.ok` always present?
3. The prefab hashes and `creator` values on real pieces.
4. Whether `health` is stored for undamaged pieces.
5. Whether 1.0 still leaves converted `.db`/`.fwl` files next to the new folder after conversion.
6. Cloud-save (`worlds/`) layout, and the server `-savedir` layout. Both are expected to be
   identical, but are untested.

## 8. Implications for the planner's data model

- Work in **metres**, with a **0.5 m base grid** and 1 m / 2 m snap levels.
- Each piece type carries:
  - footprint length and thickness;
  - **snap kind**: `centerline` (panel) or `face` (block);
  - material: support stats and colour;
  - height, for future 3D, elevations and stair rise;
  - cost.

  All of it comes straight from `valheim-pieces.json`.
- Wall runs are drawn as polylines on grid lines and auto-split into real pieces
  (e.g. a 10 m wood run = 5 × 2 m walls; a 10 m stone run = 2 × 4 m + 1 × 2 m blocks).
  That gives piece counts and material cost for free.
- Measurements:
  - **grid-line** (centre-to-centre) dimensions;
  - **outer footprint** dimensions;
  - **clear interior** dimensions;
  - room area;
  - a check that roof spans are whole-piece friendly.
- Overlays: furniture/station footprints, workbench/ward radii, stair run per storey.

## 9. Web research (wiki, patch notes, mods)

These points come from the Fandom wiki API, the Jotunn docs, Iron Gate's Steam news
and Thunderstore. They're cross-checked against the game data where possible.

- **Version:** 1.0 released 2026-09-09; the current patch is 1.0.20. It added the
  Deep North biome, 67° pieces, Timber (timberwood material, workbench) and Scalewood
  (wood material, workbench). Deep snow must be shovelled before you can build there.
- **Placement controls:**
  - Shift disables snapping (free placement).
  - Since 0.217.14 you can cycle the snap point manually with Q/E, plus a precision
    mode on Ctrl. The exact default binding is unverified.
  - Rotation is the scroll wheel, in 22.5° steps (community knowledge).
  - There's **no world grid**; everything is snap-to-snap.
- **Wall-on-floor:** confirmed by the extracted snap points (§2).
  - Panel walls straddle the floor edge.
  - Stone and marble blocks can sit with a face flush to the floor edge, on either
    side.
- **Cover and comfort rules that affect plans:**
  - Crafting needs a roof and 70 % cover. Beds and "Sheltered" need 80 %.
  - Cover is measured with 17 rays of 30 m each, so very large open halls can fail.
  - Comfort items count within 10 m.
  - The hearth gives fire within 12 m and +1 comfort within 8 m while sheltered.
- **Fire and smoke:**
  - Campfires and the hearth need ground or stone underneath (or a floor supported by
    stone / wood-iron).
  - Each smoke ball has a 0.42 m radius, so a vent gap needs about 1 m.
  - No chimney is needed with roughly 4 × 2 × 2 m of free space 0.75 m above the fire.
  - A fire chokes after 4 s with no way to vent smoke.
- **Doors and gates:**
  - Wood door: 2 m wide, framed, so no double doors.
  - Iron gate: 1.8 × 2.8.
  - Darkwood gate: 2 × 4.
  - Hexagonal gate: ~3.7 × 4.3.
  - Flametal gate: 1.5 × 4 snap (~5.5 m tall model).
- **Other radii:**
  - Player base: 20 m.
  - Raids need 3 base structures within 40 m.
  - Ward: 32 m.
- **Existing tools:**
  - **ValheimFloorPlan** (RetiredCoders mod, github.com/AlexDroz/ValheimFloorPlan):
    a browser 2D grid designer (4×4 to 28×28) plus a mod that levels terrain and
    places the foundation in-game. It's the closest prior art and worth a look.
  - **PlanBuild:** ghost "plan" pieces and a `.blueprint` format; also reads
    BuildShare `.vbuild`. A possible **export target** so a plan could be built
    in-game.
  - Grid-snapping mods (PerfectPlacement 0.5/1/2/4 m, Extra Snap Points) show that
    0.5 m is the de facto community fine grid.
  - No standalone, mod-free web planner was found.

Sources: valheim.fandom.com (Building, Building stability, Cover, Smoke, Hearth,
Workbench, Portal, Player base), valheim-modding.github.io/Jotunn piece list, Steam
news for app 892970, Thunderstore pages for the mods above.

## 10. Tech stack options (superseded: see docs/Roadmap.md)

| Option | Pros | Cons |
|---|---|---|
| **React + SVG** | Crisp at any zoom. Native text, dimension lines, hatching and patterns. DOM events give free hit-testing and selection. Trivial SVG/PNG export. Fine up to a few thousand elements. | Gets slow beyond roughly 5–10k nodes, which a house plan won't reach. |
| React + Canvas 2D (Konva) | Handles more objects, has a built-in transformer UI. | Text and dimensioning are more manual, and export is raster-first. |
| PixiJS (WebGL) | Very fast, good for huge maps. | Overkill for a building plan, and text and lines get fiddly. |
| **react-three-fiber with an orthographic camera** | The same scene can become 3D later; we already have heights and 3D snap points. | 2D drafting chrome (labels, dimension lines, grid) is harder. Heavier. |
| TypeGPU / raw WebGPU | Maximum control. | A renderer you'd write yourself, with no benefit for 2D drafting. Better kept for a later specialised view, e.g. stability heat-map shading. |

**Recommendation: React + TypeScript + Vite, with a renderer-independent model.**

- **Model:** pieces from `valheim-pieces.json`, wall runs, rooms, half-metre grid,
  snap rules, measurements and cost/stability calculations. Pure TS, unit-testable.
- **State:** Zustand plus undo/redo. Plans serialise to JSON (file + localStorage),
  with a shareable URL later.
- **View v1: SVG** top-down drafting, with pan/zoom, grid, wall tools,
  dimension/measure tool and footprint overlays.
- **View v2 (later): react-three-fiber.** It reads the same model and extrudes pieces
  using real heights, for an isometric preview or 3D, with no rewrite of the model.
