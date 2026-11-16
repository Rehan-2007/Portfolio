# Audited Minecraft crop conversion

## Result and scope

This is actual geometry decoded from the staged legacy Anvil world, **not a recreated or procedural house**. It imports only the specified crop, not the entire Minecraft world. No application files were changed and no source world scripts were executed.

- Trusted converter: `C:/Users/admin/.zcode/workspace/24f9ca06-625c-4ef5-98b4-80e41fa6b060/tools/assets/minecraft_prepare.py`
- Verified nested world: `C:/Users/admin/AppData/Local/Temp/anti-ai-staging/minecraft/source/7bd71f3c732a4748822500cc9d6bbde3-nested/test`
- Original textures: `C:/Users/admin/AppData/Local/Temp/anti-ai-staging/minecraft/textures`
- Output directory: `C:/Users/admin/AppData/Local/Temp/anti-ai-converted/minecraft-v1`
- Runtime asset: `minecraft-crop.glb`
- Machine-readable audit: `conversion.json` (block IDs/metadata/counts, source hashes, image hashes/dimensions, limits, verified GLB counts)
- Intermediate source-derived geometry: `mesh.json`
- Review-only renders: `review-front.png`, `review-back.png`

## Selection and missing fringe

The original `export.mc2obj` contains `{"dimension":0,"area":{"y":[49,113],"x":[-198,-291],"z":[606,510]}}`.

The converter normalizes inclusive bounds to **X −291…−198, Z 510…606** and expands **Y 49…118**. The highest non-air block is a decorative cobweb at **Y116**, so the original Y113 ceiling would cut decoration off. Requested crop dimensions are **94 × 70 × 97 blocks** (X,Y,Z).

Of 49 intersecting chunks, **42 are present**. The seven absent chunks are `(cx,cz)=(-19,31)…(-13,31)`, accounting only for **Z510–511** across the selection. These are absent records in `r.-1.0.mca`, not fabricated air chunks or filled terrain. The actual structure comes from the required chunks in `r.-1.1.mca`. Only these two regions are read; only required populated chunk payloads are decompressed. The other twelve world region files are not imported.

There are **33,074 non-air crop blocks**, of which **24,144 are above base Y49**. Above-base block bounds, with exclusive maxima, are `[-285,50,528]…[-205,117,597]`, i.e. **80 × 67 × 69 blocks**, including fence/yard/decorative elements as well as the building. The base terrain is retained, so the overall exported mesh measures **94 × 68 × 95 blocks** rather than just the house.

## Geometry, materials and validation

- **219,288 triangles**, verified independently from GLB index accessor counts; bounded below 250,000. No decimation or generic replacement was used.
- **109,644 exposed quads** before Blender triangulation.
- **122,907 fully occluded authored box faces removed**; overlapping boxes within each authored shape are unioned before boundary emission. Neighboring opaque shapes clip shared boundaries, including partial slab/stair contacts. Real interior room/cavity surfaces remain; this is not an exterior-only flood-fill shell. Masked/transparent surfaces cannot occlude opaque neighbors and are intentionally retained where visibility is possible.
- Coplanar full-block horizontal faces are greedily merged with original texture UV repeat at one tile per block. This lowers the geometry budget without moving source surfaces. No atlas or resampled substitute artwork is introduced.
- **49 material-group meshes, 49 materials and 49 embedded images**. Blender loads the supplied PNGs; supplied `_a.png` masks are combined by the GLB exporter with their original color artwork. Embedded RGBA images may be re-encoded; source images are unchanged. No PIL or additional dependencies are needed.
- Samplers are nearest-filtered (`magFilter=9728`, `minFilter=9984`) with default repeat wrapping. Partial-block UV projection is approximate, as detailed below.
- GLB is **16,199,724 bytes** (~15.45 MiB), with no cameras, lights or animations. Review-only cameras and a sun were created **after** GLB export and exist only for the PNG render process, not the exported asset. The PNGs contain review lighting/shadows; the GLB does not.
- All used world/selection hashes were rechecked after conversion and export and remained unchanged. Texture paths, dimensions and SHA-256 hashes are recorded in `conversion.json`.
- Blender **5.3.0** completed export and both 1000×900 review renders successfully. The current agent cannot receive image input, so render generation is verified but **visual fidelity has not been visually approved**. The PNGs are supplied for human/coordinator review.

## Legacy ID coverage and exact limitations

All source IDs encountered are represented; **unsupported source ID list is empty**. This does **not** mean all shapes/render details are exact or that the converter supports arbitrary Minecraft worlds. Unknown IDs stop conversion rather than silently creating replacement cubes. The audited crop contains the following IDs:

`1,2,3,4,5,17,30,33,35,42,43,44,49,50,51,53,67,68,69,72,85,87,96,97,98,101,107,109,113,123,125,126,131,134,135,136,139,143,145,154,160,162,163,173`.

Accurately represented primary geometry includes exposed solid cube faces, all six supplied plank variants, oriented oak/spruce/jungle/dark-oak logs, stone-brick variants, metadata top/bottom slabs and double slabs, metadata facing/upside-down stairs with neighbor-derived inner/outer corner quarters, connected fences/panes/bars/walls, open/closed and top/bottom trapdoors, metadata-positioned buttons, pressure plates and oriented wall sign boards. White wool and infested stone brick use the matching supplied artwork; only these actual metadata variants occur.

The following are explicit **approximations or unsupported details**, not claimed exact:

| ID / shape | Actual crop instances | Limitation |
| --- | ---: | --- |
| 33 piston | 138 | Every source piston has legacy metadata **6**, an invalid facing. Retained as piston-textured full cubes, not interpreted as valid directional extended machinery. Missing top artwork uses the supplied `piston_bottom.png`; no fabricated artwork. |
| 50 torch | 145 | Static alpha-textured crossed planes positioned by metadata. Wall torch tilt and emitted light not modeled. |
| 51 fire | 3 | Static supplied-texture cross planes; no animation or emitted light. |
| 68 wall sign | 3 | Oriented boards retained; NBT sign text is not rasterized. |
| 69 lever | 6 | Box mount/handle orientations retained; exact handle tilt and powered animation approximated. |
| 85 oak fence / 113 nether fence | 1,167 / 286 | Neighbor-connected posts/rails retained. Exact vanilla UV templates and every gate-connection orientation rule are not reproduced. |
| 107 fence gate | 151 | Metadata axis/open-bit box geometry; exact hinge hardware and direction-specific open hinge positioning approximated. |
| 131 tripwire hook | 12 | Metadata-oriented mount/hook cuboids; curved hook shape is approximate. No tripwire simulation. |
| 139 cobblestone wall | 81 | Connected posts/arms retained; vanilla post/cap reduction rules approximate. |
| 145 anvil | 23 | Oriented base/stem/top cuboids; bevels and precise waist profile omitted. |
| 154 hopper | 6 | Open rim, stepped bowl, metadata-facing spout; tapered funnel approximated by cuboids. |
| Stairs 53,67,109,134,135,136,163 | 3,242 | Facing, half and adjacent inner/outer corners supported; rare vanilla corner-suppression checks not implemented. |
| Partial-block UVs | — | Block-local projection, not exact vanilla per-shape UVs; log grain axis is respected. Anvil/hopper top artwork follows top-facing surfaces rather than a fully exact original model unwrap. |
| Alpha masks | — | Supplied masks are used. Blender exports these as **BLEND**, not binary MASK. Materials are double-sided, so runtime transparency sorting can differ from Minecraft and GPU rasterization cost may exceed the nominal one-sided triangle count. |
| Rendering/world data | — | No biomes, entities, tile-entity contents, lights, animations, collision/gameplay, or Minecraft engine shading. Textures are supplied artwork, not full world fidelity. |

## Coordinate convention and later application scale

No application scale is baked in: **one local unit = one Minecraft block**. The source origin is `(−244,49,558.5)`. Blender coordinates are `(sourceX+244, −(sourceZ−558.5), sourceY−49)`; glTF export uses Y-up. Effective GLB bounds are approximately **X −47…47, Y 0…68, Z −46.5…48.5**. The house/above-base extent is approximately 80 × 67 × 69 blocks; the retained crop terrain is wider.

A later application config should preserve aspect ratio and cap the **entire crop's** longest extent at ≤170 world units. For the current 95-block longest mesh extent this means a uniform factor **≤170/95 ≈ 1.78947**. This is guidance only; no app/config changes were made.

## Reproduction

Run from the trusted workspace, not from the staged input directory. The decode destination must be new or empty; use a fresh output directory when reproducing.

```bash
python -I 'C:/Users/admin/.zcode/workspace/24f9ca06-625c-4ef5-98b4-80e41fa6b060/tools/assets/minecraft_prepare.py' decode \
  --source 'C:/Users/admin/AppData/Local/Temp/anti-ai-staging/minecraft/source/7bd71f3c732a4748822500cc9d6bbde3-nested/test' \
  --textures 'C:/Users/admin/AppData/Local/Temp/anti-ai-staging/minecraft/textures' \
  --output 'C:/Users/admin/AppData/Local/Temp/anti-ai-converted/minecraft-v1'

'/c/Program Files/Blender Foundation/Blender 5.3/blender.exe' \
  --background --factory-startup --disable-autoexec --python-exit-code 1 \
  --python 'C:/Users/admin/.zcode/workspace/24f9ca06-625c-4ef5-98b4-80e41fa6b060/tools/assets/minecraft_prepare.py' -- export \
  --textures 'C:/Users/admin/AppData/Local/Temp/anti-ai-staging/minecraft/textures' \
  --output 'C:/Users/admin/AppData/Local/Temp/anti-ai-converted/minecraft-v1' --render
```

The converter uses stdlib NBT/gzip/zlib parsing under isolated Python `-I`, followed by the installed Blender in factory-startup/disabled-autoexec mode. It loads PNG data only and never loads the source world's scripts or a source `.blend` file.
