# Predator laptop — actual asset conversion

## Identity and artifacts

The source is **Laptop Predator.blend**, not AuroraCAD. Its original meshes, keyboard keys, mirrored hinge, chassis, touchpad, lid, and display geometry are preserved. No substitute laptop geometry was generated. A temporary UV bake plane was removed before export.

- Source: `C:/Users/admin/AppData/Local/Temp/anti-ai-staging/laptop/source/Laptop Predator.blend`
- Source SHA-256: `afd16b1c396cc133e6797acb4306c3347ac6263d7feaa9f97d2fe7a16e1d24fd`
- Trusted converter: `C:/Users/admin/.zcode/workspace/24f9ca06-625c-4ef5-98b4-80e41fa6b060/tools/assets/laptop_prepare.py`
- GLB: `C:/Users/admin/AppData/Local/Temp/anti-ai-converted/laptop-v1/predator-laptop.glb`
- GLB SHA-256: `4988414fa503e0799b5652cecb030dfd2782b4819aa3223868be550cc617e583`
- Inspection, detailed measurements, material graphs, screen polygon/UV coordinates, and conversion log are in that output directory as `inspection.json`, `conversion-report.json`, and `conversion.log`.

## Measurable result

Blender 5.3.0 conversion completed successfully, followed by reimport of the actual GLB and four validation renders.

| Measurement | Result |
|---|---:|
| GLB bytes | 21,636,500 |
| Original evaluated mesh objects / exported meshes | 18 / 18 |
| Original evaluated / exported triangles | 45,573 / 45,573 |
| Original evaluated vertices | 29,768 |
| Exported nodes / material primitives | 19 / 35 |
| Source materials / used exported materials | 15 / 11 |
| Embedded exported images | 7 |
| Cameras, lights, occlusion textures exported | 0 |

All exported mesh primitives retain normals and UV0. The source hinge Mirror modifier is evaluated, not replaced. Uniform normalization changes positions/scale only; no simplification or decimation was performed. Unused material slots do not become used GLB materials.

## Texture handling and material compatibility

All **12 original file-image datablocks are valid packed images**, including both metals' color, normal, roughness and displacement images, the keyboard spectrum, and the original HDR. Their old external paths are absent, but **no original image map is actually missing**. The Render Result datablock is an empty viewer, not a missing texture.

Original packed bytes were extracted to `packed-textures/`, both image and PackedImage paths corrected, and original decoded packed pixels retained. Valid packed originals take precedence over staged external derivatives. Both distinct truncated SheetMetal PNGs remain separately preserved in `staged-textures/`, including `SheetMetal001_2K_Color_jpg-SheetMetal001_2K_Roughness@channe__duplicate_65c15e45d494.png`. Neither was silently overwritten or misidentified as the packed original roughness map.

- Material.002's unsupported Base Color ColorRamp was baked **only through an emission channel** into a 2048×2048 PNG, preserving the original linear black/white ramp (black position 0.290909, white position 1.0). It contains no AO, lighting, or cast shadows.
- Both metals' original normal, metallic and roughness channels remain connected; the GLB exporter packs roughness/metallic channels into two embedded PNGs.
- Original keyboard spectrum emission remains; source transmission, IOR, specular and emissive-strength settings are exported through corresponding Khronos material extensions.
- Legacy Principled/Emission nodes loaded into Blender 5.3 with Weight=0 are compensated to Weight=1 to render their intended legacy shader response. Their source base color, roughness, metallic and emission values are otherwise retained.
- Two texture displacement output links are disconnected because GLB has no displacement channel. Packed displacement images are retained in the output, but not exported as geometry displacement. The original mesh shape is unchanged.
- Original HDR is packed and preserved but deliberately not embedded in GLB or used for validation; lighting belongs to the host runtime.
- Export settings include `export_format='GLB'`, `export_image_format='AUTO'`, normals/UVs enabled, Y-up enabled, cameras/lights/animation disabled, and no Draco compression.

Remaining log warnings are the legacy empty Render Result colorspace enum and two standard multi-image texture sampler warnings while packing the metal channels. Those source samplers share the original UV/mapping setup. No final missing-file error remains after correcting PackedImage paths. Blender 5.3 does not expose `export_occlusion`; that option is omitted, and the binary GLB is independently checked to contain no occlusionTexture.

## Coordinate convention

Source up is **+Z**; source front is **+Y**. Exported glTF up is **+Y** and front is **−Z**. The upright source lid is preserved, not arbitrarily tilted. Wrapper name is `Predator_Normalized_Root`.

Uniform scale: `8.150647304857404`. Source center/ground offset: `(0.4845256209, −0.0952779353, 0.1756908298)`.

Export mapping is:

```text
GLB X = (source X − 0.4845256209) × scale
GLB Y = (source Z − 0.1756908298) × scale
GLB Z = −(source Y + 0.0952779353) × scale
```

GLB bounds: approximately `X [−8, 8]`, `Y [0, 11.532514]`, `Z [−5.215575, 5.215575]`. Width is **16 local units**, model centered horizontally, ground at Y=0 within floating-point tolerance (minimum −4.47×10⁻⁸).

## Real screen for runtime interface

- Original lid/display object: **Cube.001**.
- Real display material: **Material.004**, source material slot **2**; exported material name retained.
- Source polygon indices **821 and 949** form two **coplanar front-facing** lower/upper screen regions. They are not opposing front/back faces.
- Screen plane: exported **Z ≈ 5.036453**, normal **(0, 0, −1)**.
- Combined exported display bounds: **X [−7.840205, 7.824139]**, **Y [1.636373, 10.682546]**.
- Combined screen center: **(−0.008033, 6.159459, 5.036453)**.
- Combined bounding size: **15.664343 × 9.046173**, original aspect approximately **1.7316**. Upper edge tapers slightly to X [−7.687260, 7.671193].

For a later runtime UI overlay, retain the original material/geometry and place an inset front-facing interface at **Z≈5.02645**, center **X≈−0.008033, Y≈6.159459**, normal −Z. Choose inset bounds to respect the upper taper. Existing original UV islands are not a clean rectangular 0..1 mapping; blindly replacing the display map by those UVs will distort a runtime interface. Exact original corners and UV coordinates are available in `conversion-report.json`.

Useful preserved object names: `Cube` chassis, `Cube.003` mirrored hinges, `Cube.015` keyboard assembly, `Plane` touchpad, `Circle` Predator lid mark.

## Validation and limits

Actual exported GLB was reimported for four 960×720 PNGs:

- `C:/Users/admin/AppData/Local/Temp/anti-ai-converted/laptop-v1/validation-front-threequarter.png`
- `C:/Users/admin/AppData/Local/Temp/anti-ai-converted/laptop-v1/validation-front.png`
- `C:/Users/admin/AppData/Local/Temp/anti-ai-converted/laptop-v1/validation-rear-threequarter.png`
- `C:/Users/admin/AppData/Local/Temp/anti-ai-converted/laptop-v1/validation-top-keyboard.png`

Neutral validation softboxes have shadows disabled and every mesh has shadow-ray visibility disabled. No AO or shadow map is baked. Images await the primary agent's visual review; this converter does not claim a visual pass. The GLB can retain cast/receive-shadow intent as extras, but the host runtime must explicitly disable Three.js castShadow/receiveShadow; GLB does not enforce that rendering policy.

No application source/configuration, existing blender_prepare.py, or packages were changed. No installs. Embedded camera removed; embedded text blocks were never executed. Source loading used `use_scripts=False`, and execution always used `--background --factory-startup --disable-autoexec --python-exit-code 1` with the trusted workspace script and absolute source/output arguments. Conversion artifacts remain in the approved temporary output; they have not been copied into app public assets.

## Reproduce

```bash
"C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" --background --factory-startup --disable-autoexec --python-exit-code 1 --python "C:/Users/admin/.zcode/workspace/24f9ca06-625c-4ef5-98b4-80e41fa6b060/tools/assets/laptop_prepare.py" -- --source "C:/Users/admin/AppData/Local/Temp/anti-ai-staging/laptop/source/Laptop Predator.blend" --textures "C:/Users/admin/AppData/Local/Temp/anti-ai-staging/laptop/textures" --output "C:/Users/admin/AppData/Local/Temp/anti-ai-converted/laptop-v1" --mode convert
```
